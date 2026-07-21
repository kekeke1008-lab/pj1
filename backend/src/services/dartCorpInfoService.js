import AdmZip from "adm-zip";

const DART_BASE = "https://opendart.fss.or.kr/api";

async function callDart(endpoint, params) {
  const url = new URL(`${DART_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DART API HTTP ${res.status}`);
  const json = await res.json();
  if (json.status && json.status !== "000") {
    if (json.status === "013") return []; // 조회된 데이터 없음
    throw new Error(`DART API 오류 [${json.status}]: ${json.message}`);
  }
  return json.list ?? [];
}

function num(str) {
  const n = Number((str ?? "").replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

/** 등기임원 현황 (성명/직위/담당업무/재직기간 등) */
export async function getExecutives(apiKey, corpCode, year) {
  const rows = await callDart("exctvSttus.json", {
    crtfc_key: apiKey,
    corp_code: corpCode,
    bsns_year: year,
    reprt_code: "11011",
  });
  return rows.map((r) => ({
    name: r.nm,
    position: r.ofcps,
    // DART는 등기 여부를 "등기임원/미등기임원"이 아니라 사내이사/사외이사/감사 등
    // 구체적인 등기 구분으로 내려주므로, 이진값으로 뭉개지 말고 원문 그대로 보여준다.
    registrationType: r.rgist_exctv_at,
    isFullTime: r.fte_at === "상근",
    chargeJob: r.chrg_job,
    mainCareer: r.main_career,
    tenurePeriod: r.hffc_pd,
  }));
}

/** 최대주주 및 특수관계인 지분 현황 */
export async function getLargestShareholders(apiKey, corpCode, year) {
  const rows = await callDart("hyslrSttus.json", {
    crtfc_key: apiKey,
    corp_code: corpCode,
    bsns_year: year,
    reprt_code: "11011",
  });
  return rows.map((r) => ({
    name: r.nm,
    relation: r.relate,
    sharesEnd: num(r.trmend_posesn_stock_co),
    ownershipPctEnd: num(r.trmend_posesn_stock_qota_rt),
    note: r.rm,
  }));
}

/** 타법인 출자 현황(계열회사·지분투자) — 투자목적 "경영참여"는 사실상 계열/종속회사에 해당 */
export async function getAffiliateInvestments(apiKey, corpCode, year) {
  const rows = await callDart("otrCprInvstmntSttus.json", {
    crtfc_key: apiKey,
    corp_code: corpCode,
    bsns_year: year,
    reprt_code: "11011",
  });
  return rows
    .map((r) => ({
      name: r.inv_prm,
      purpose: r.invstmnt_purps,
      isManagementParticipation: r.invstmnt_purps === "경영참여",
      ownershipPctEnd: num(r.trmend_blce_qota_rt),
      bookValueEnd: num(r.trmend_blce_acntbk_amount),
    }))
    .sort((a, b) => (b.ownershipPctEnd ?? 0) - (a.ownershipPctEnd ?? 0));
}

// ---- 우발채무/약정사항 (여신한도, 지급보증, 소송) ----
// 이 항목은 DART가 구조화 API로 제공하지 않아, 실제 제출된 사업보고서 원문(document.xml)에서
// 관련 문단을 직접 찾아 텍스트로 추출한다.

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchLatestBusinessReportRceptNo(apiKey, corpCode, year) {
  const bgnDe = `${year + 1}0101`;
  const endDe = `${year + 1}0630`; // 사업보고서 제출기한(3월말)에 여유를 둔 안전 범위
  const url = new URL(`${DART_BASE}/list.json`);
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("corp_code", corpCode);
  url.searchParams.set("bgn_de", bgnDe);
  url.searchParams.set("end_de", endDe);
  url.searchParams.set("pblntf_ty", "A"); // 정기공시(사업보고서 등)
  const res = await fetch(url);
  const json = await res.json();
  const list = json.list ?? [];
  const annual = list.find((item) => item.report_nm?.startsWith("사업보고서"));
  return annual?.rcept_no ?? null;
}

async function fetchReportDocumentText(apiKey, rceptNo) {
  const url = new URL(`${DART_BASE}/document.xml`);
  url.searchParams.set("crtfc_key", apiKey);
  url.searchParams.set("rcept_no", rceptNo);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`문서 다운로드 실패: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buffer);
  // 여러 첨부 XML 중 본문 사업보고서는 가장 큰 파일인 경우가 대부분이다.
  const mainEntry = zip.getEntries().sort((a, b) => b.header.size - a.header.size)[0];
  return mainEntry.getData().toString("utf-8");
}

// { 라벨, 검색 키워드(고유할수록 좋음), 앞/뒤로 가져올 문맥 길이 }
const SECTIONS = [
  { label: "여신 약정 한도 (수입신용장·당좌차월 등)", keyword: "수입신용장한도약정", before: 300, after: 60 },
  { label: "지급보증 현황", keyword: "지급보증한 금융보증", before: 250, after: 250 },
  { label: "소송 등 우발부채", keyword: "법적소송우발부채", before: 0, after: 500 },
];

/** 약정사항/우발채무 노트에서 여신한도·지급보증·소송 관련 문단을 추출한다. */
export async function getCommitmentsAndLitigation(apiKey, corpCode, year) {
  const rceptNo = await fetchLatestBusinessReportRceptNo(apiKey, corpCode, year);
  if (!rceptNo) return { available: false, snippets: [] };

  const rawContent = await fetchReportDocumentText(apiKey, rceptNo);
  // 태그를 먼저 전체 제거한 뒤 검색해야, 슬라이싱 경계에서 태그가 잘려 속성값이
  // 그대로 텍스트로 노출되는 문제(예: ACONTEXT="..." 잔여물)를 피할 수 있다.
  const cleanContent = stripTags(rawContent);

  const snippets = [];
  for (const section of SECTIONS) {
    const idx = cleanContent.indexOf(section.keyword);
    if (idx === -1) continue;
    const text = cleanContent
      .slice(Math.max(0, idx - section.before), idx + section.keyword.length + section.after)
      .trim();
    snippets.push({ label: section.label, text });
  }

  return { available: true, rceptNo, snippets };
}
