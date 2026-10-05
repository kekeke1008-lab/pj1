import AdmZip from "adm-zip";

// EBITDA = 영업이익 + 감가상각비 + 무형자산상각비.
// 감가상각비는 DART 표준 재무제표 API에는 없고(회사가 현금흐름표에 따로 표시한 경우만 존재),
// 사업보고서 원문의 주석(XBRL 태그)에 들어 있어서 원문 문서를 받아 해당 태그를 읽는다.
// 사업보고서 1건에는 당기·전기 2개 연도가 들어 있다. 단, 이 주석 태그는 최근 사업보고서
// (확인 결과 FY2025 제출분)부터 달려 있고 FY2024 이전 보고서에는 없다. 이전 연도는 본문 텍스트에
// 연결/개별 표가 뒤섞여 있어 값을 잘못 읽을 위험이 커서, 신뢰할 수 있는 최근 2개 연도만 제공한다.

const DART_BASE = "https://opendart.fss.or.kr/api";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map(); // key -> { fetchedAt, promise }

const TAG = /<T[EU]\b([^>]*)>([^<]*)</g;
const ATTR = /(\w+)="([^"]*)"/g;

const WANTED = {
  "ifrs-full_DepreciationPropertyPlantAndEquipment": "ppe",
  "ifrs-full_DepreciationInvestmentProperty": "investmentProperty",
  "ifrs-full_DepreciationRightofuseAssets": "rightOfUse",
  "ifrs-full_AmortisationIntangibleAssetsOtherThanGoodwill": "intangible",
  "ifrs-full_DepreciationAndAmortisationExpense": "total",
  "ifrs-full_AdjustmentsForDepreciationExpense": "cfDepreciation",
  "ifrs-full_AdjustmentsForAmortisationExpense": "cfAmortisation",
};

async function findAnnualReportNo(apiKey, corpCode, fiscalYear) {
  const url = new URL(`${DART_BASE}/list.json`);
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("bgn_de", `${fiscalYear + 1}0101`);
  url.searchParams.set("end_de", `${fiscalYear + 1}0630`);
  url.searchParams.set("pblntf_ty", "A");
  const json = await (await fetch(url)).json();
  return (json.list ?? []).find((i) => i.report_nm?.startsWith("사업보고서"))?.rcept_no ?? null;
}

async function downloadReportXml(apiKey, rceptNo) {
  const url = new URL(`${DART_BASE}/document.xml`);
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("rcept_no", rceptNo);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`문서 다운로드 실패: HTTP ${res.status}`);
  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
  const main = zip.getEntries().sort((a, b) => b.header.size - a.header.size)[0];
  return main.getData().toString("utf-8");
}

/** 원문에서 (연결/개별, 연도)별 감가·상각 관련 사실값을 뽑는다. 금액은 원 단위. */
export function parseDepreciationFacts(content) {
  const facts = {}; // "CFS|2025" -> { ppe, rightOfUse, ... }
  TAG.lastIndex = 0;
  let m;
  while ((m = TAG.exec(content)) !== null) {
    const attrs = {};
    ATTR.lastIndex = 0;
    let a;
    while ((a = ATTR.exec(m[1])) !== null) attrs[a[1]] = a[2];

    const key = WANTED[attrs.ACODE];
    if (!key) continue;
    const ctx = attrs.ACONTEXT ?? "";
    // 연결/개별 구분 축 하나뿐인 합계 값만 사용한다(자산 종류별 세부 값은 제외).
    if ((ctx.match(/Axis/g) ?? []).length !== 1) continue;
    const period = ctx.match(/^[CP]FY(\d{4})dFY/);
    if (!period) continue;
    const fsDiv = ctx.includes("ConsolidatedMember") ? "CFS" : ctx.includes("SeparateMember") ? "OFS" : null;
    if (!fsDiv) continue;

    const digits = m[2].replace(/[^\d.]/g, "");
    if (!digits) continue;
    // ADECIMAL(-3 = 천원, -6 = 백만원)으로 표시 단위를 원 단위로 환산한다.
    const decimals = Number(attrs.ADECIMAL);
    const scale = Number.isFinite(decimals) && decimals < 0 ? 10 ** -decimals : 1;
    const bucket = (facts[`${fsDiv}|${period[1]}`] ??= {});
    bucket[key] ??= Number(digits) * scale;
  }
  return facts;
}

function totalDepreciation(f) {
  const parts = (f.ppe ?? 0) + (f.investmentProperty ?? 0) + (f.rightOfUse ?? 0) + (f.intangible ?? 0);
  if (parts > 0) return parts;
  const cf = (f.cfDepreciation ?? 0) + (f.cfAmortisation ?? 0);
  if (cf > 0) return cf;
  return f.total > 0 ? f.total : null;
}

async function loadDepreciationByYear(apiKey, corpCode, latestYear) {
  const result = { CFS: {}, OFS: {} };
  const rceptNo = await findAnnualReportNo(apiKey, corpCode, latestYear);
  if (!rceptNo) return result;

  const facts = parseDepreciationFacts(await downloadReportXml(apiKey, rceptNo));
  for (const [k, f] of Object.entries(facts)) {
    const [fsDiv, year] = k.split("|");
    const total = totalDepreciation(f);
    if (total !== null) result[fsDiv][year] = total;
  }
  return result;
}

/** { CFS: {2025: 원, 2024: 원, ...}, OFS: {...} } — 24시간 캐시(동일 요청은 진행 중인 작업을 공유) */
export function getDepreciationByYear(apiKey, corpCode, latestYear) {
  const key = `${corpCode}:${latestYear}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.promise;

  const promise = loadDepreciationByYear(apiKey, corpCode, latestYear).catch((err) => {
    cache.delete(key); // 실패는 캐시하지 않는다
    throw err;
  });
  cache.set(key, { fetchedAt: Date.now(), promise });
  return promise;
}

/** 연간 재무 배열(연결 또는 개별)에 감가상각비·EBITDA를 붙인다. 원문에서 못 찾으면 현금흐름표 값으로 보완. */
export function attachEbitda(years, depreciationByYear) {
  return years.map((y) => {
    if (y.error) return y;
    const da = depreciationByYear?.[String(y.year)] ?? y.cfDepreciation ?? null;
    if (da === null || y.operatingProfit === undefined) return y;
    return { ...y, depreciationAmortization: da, ebitda: y.operatingProfit + da };
  });
}
