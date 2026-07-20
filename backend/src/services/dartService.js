const DART_BASE = "https://opendart.fss.or.kr/api";

// 사업보고서(연간) 계정과목 라벨 -> 우리 화면에서 쓰는 필드명
// 회사/업종마다 계정명 표기가 달라(예: 매출액 vs 수익(매출액)) 여러 별칭을 매핑한다.
const ACCOUNT_MAP = {
  매출액: "revenue",
  "수익(매출액)": "revenue",
  영업수익: "revenue",
  영업이익: "operatingProfit",
  "영업이익(손실)": "operatingProfit",
  당기순이익: "netIncome",
  "당기순이익(손실)": "netIncome",
  자산총계: "totalAssets",
  부채총계: "totalLiabilities",
  자본총계: "totalEquity",
  유동자산: "currentAssets",
  유동부채: "currentLiabilities",
};

// 재무상태표(BS) 항목과 손익 항목(IS/CIS)을 구분해서 매칭한다.
// 같은 account_nm이 자본변동표(SCE) 등 다른 표에도 중복 등장해 다른 금액을
// 갖는 경우가 있어, 표 종류를 제한하지 않으면 엉뚱한 값을 집어올 수 있다.
const BS_FIELDS = new Set([
  "totalAssets",
  "totalLiabilities",
  "totalEquity",
  "currentAssets",
  "currentLiabilities",
]);
const INCOME_FIELDS = new Set(["revenue", "operatingProfit", "netIncome"]);
const INCOME_SJ_PRIORITY = { IS: 0, CIS: 1 };

async function callDart(endpoint, params) {
  const url = new URL(`${DART_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`DART API HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.status && json.status !== "000") {
    // 013 = 조회된 데이터가 없습니다 (해당 연도 보고서가 아직 없거나 폐지 등)
    if (json.status === "013") return { status: json.status, list: [] };
    throw new Error(`DART API 오류 [${json.status}]: ${json.message}`);
  }
  return json;
}

function extractMetrics(rows) {
  const picked = {}; // field -> { sjDiv, amount }

  for (const row of rows) {
    const field = ACCOUNT_MAP[row.account_nm?.trim()];
    if (!field) continue;

    const sjDiv = row.sj_div;
    if (BS_FIELDS.has(field) && sjDiv !== "BS") continue;
    if (INCOME_FIELDS.has(field) && !(sjDiv in INCOME_SJ_PRIORITY)) continue;

    // 분기/반기 보고서의 손익 항목은 thstrm_amount(당분기 3개월 단독)와
    // thstrm_add_amount(연초부터의 누적)를 별도로 제공한다. 연도별/분기별
    // 비교는 누적 기준이 맞으므로, 존재하면 누적값을 우선 사용한다.
    const rawAmount =
      INCOME_FIELDS.has(field) && row.thstrm_add_amount
        ? row.thstrm_add_amount
        : row.thstrm_amount;
    const amount = Number((rawAmount ?? "0").replace(/,/g, ""));
    if (Number.isNaN(amount)) continue;

    const existing = picked[field];
    const better =
      !existing ||
      (INCOME_FIELDS.has(field) && INCOME_SJ_PRIORITY[sjDiv] < INCOME_SJ_PRIORITY[existing.sjDiv]);
    if (better) picked[field] = { sjDiv, amount };
  }

  return Object.fromEntries(Object.entries(picked).map(([field, v]) => [field, v.amount]));
}

// 연결(CFS)과 개별(OFS)은 서로 다른 재무제표이므로 폴백하지 않고 각각 독립적으로 조회한다.
async function fetchDivisionRows(apiKey, corpCode, year, reportCode, fsDiv) {
  const json = await callDart("fnlttSinglAcntAll.json", {
    crtfc_key: apiKey,
    corp_code: corpCode,
    bsns_year: year,
    reprt_code: reportCode,
    fs_div: fsDiv,
  });
  return json.list ?? [];
}

/**
 * Fetches key annual financial metrics for a corp across the given years,
 * for both consolidated (CFS) and standalone (OFS) financial statements.
 * Small/unlisted corps that don't prepare consolidated statements will simply
 * have empty/error entries in the cfs array.
 */
export async function getAnnualFinancialsBoth(apiKey, corpCode, years) {
  const cfs = [];
  const ofs = [];

  for (const year of years) {
    for (const [fsDiv, bucket] of [
      ["CFS", cfs],
      ["OFS", ofs],
    ]) {
      try {
        const rows = await fetchDivisionRows(apiKey, corpCode, year, "11011", fsDiv);
        if (rows.length === 0) {
          bucket.push({ year, error: "해당 연도 재무제표가 없습니다" });
        } else {
          bucket.push({ year, fsDiv, ...extractMetrics(rows) });
        }
      } catch (err) {
        bucket.push({ year, error: err.message });
      }
    }
  }

  return { cfs, ofs };
}

// 분기(1분기/반기/3분기)와 사업보고서(연간)를 최신순으로 순회하는 순서.
// DART는 Q2를 별도 분기보고서가 아닌 반기보고서로, Q4는 사업보고서(연간 누적)로 제출한다.
const QUARTER_SEQUENCE = [
  { reportCode: "11013", label: "1분기" },
  { reportCode: "11012", label: "반기" },
  { reportCode: "11014", label: "3분기" },
  { reportCode: "11011", label: "사업보고서(연간)" },
];

function* periodsDescending(fromYear) {
  for (let year = fromYear; year >= fromYear - 5; year--) {
    for (let i = QUARTER_SEQUENCE.length - 1; i >= 0; i--) {
      yield { year, ...QUARTER_SEQUENCE[i] };
    }
  }
}

/**
 * Walks backward from the current period looking for the most recent `count`
 * filed reports (quarterly/half-year/annual) for both CFS and OFS, skipping
 * periods that haven't been filed yet (DART status 013). Income-statement
 * figures in quarterly/half-year reports are DART's year-to-date cumulative
 * totals, not standalone quarter figures — callers should label this.
 */
export async function getRecentPeriodsBoth(apiKey, corpCode, count = 4) {
  const now = new Date();
  const cfs = [];
  const ofs = [];
  let attempts = 0;

  for (const period of periodsDescending(now.getFullYear())) {
    if (cfs.length >= count && ofs.length >= count) break;
    if (attempts >= 16) break;
    attempts++;

    for (const [fsDiv, bucket] of [
      ["CFS", cfs],
      ["OFS", ofs],
    ]) {
      if (bucket.length >= count) continue;
      let rows;
      try {
        rows = await fetchDivisionRows(apiKey, corpCode, period.year, period.reportCode, fsDiv);
      } catch {
        continue; // 네트워크/기타 오류는 해당 기간만 건너뛴다
      }
      if (rows.length === 0) continue; // 아직 제출되지 않은 기간이거나 해당 재무제표 미작성

      const metrics = extractMetrics(rows);
      bucket.push({
        year: period.year,
        period: period.label,
        isCumulative: period.reportCode !== "11013",
        fsDiv,
        ...metrics,
      });
    }
  }

  return { cfs: cfs.reverse(), ofs: ofs.reverse() }; // 오래된 순 -> 최신 순
}

export async function getCompanyOverview(apiKey, corpCode) {
  const json = await callDart("company.json", {
    crtfc_key: apiKey,
    corp_code: corpCode,
  });
  return json;
}
