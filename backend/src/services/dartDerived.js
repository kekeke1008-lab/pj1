// DART 표준 재무제표(fnlttSinglAcntAll) 행에서 총차입금·현금성자산·현금흐름 항목을 뽑는다.
// 계정과목 "이름"은 회사마다 제각각(단기차입금/차입금/유동성장기사채및차입금 ...)이지만
// 표준 계정코드(account_id, ifrs-full_…)는 일관돼서 이름 대신 코드로 매칭한다.
// 계정코드가 없는 회사("-표준계정코드 미사용-")만 이름으로 보완한다.

// 이자 지급 이후 차입 성격 부채: 단기/장기 차입금, 유동성장기부채, 사채, 리스부채
const BORROWING_ID =
  /(ShorttermBorrowings|CurrentPortionOfLongtermBorrowings|CurrentLoansReceived|CurrentBorrowingsAnd|CurrentBondsIssued|CurrentPortionOfBonds|NoncurrentPortionOfNoncurrentLoansReceived|NoncurrentPortionOfNoncurrentBondsIssued|LongtermBorrowings|^ifrs-full_BondsIssued$|LeaseLiabilities)/;
// 공백을 제거한 뒤 비교한다 ("단기 차입금", "비유동차입금의 비유동성 부분" 같은 표기 대응).
const BORROWING_NAME =
  /^(단기|장기)차입금|^(단기|장기)?사채|^유동성(장기)?(차입금|부채|사채)|^비유동(차입금|사채)|^(유동|비유동)?리스부채/;
const NO_STD_CODE = "-표준계정코드 미사용-";

// 이름 보완은 표준 코드가 없거나 회사 확장 코드(dart_/entity)인 행에만 적용한다.
// (표준 코드가 이미 다른 항목을 가리키는 행까지 이름으로 합치면 이중 집계될 수 있다.)
function isNonStandardId(id) {
  return id === NO_STD_CODE || id.startsWith("dart_") || id.startsWith("entity");
}

const CASH_ID = /^ifrs-full_CashAndCashEquivalents$/;
const SHORT_DEPOSIT_ID = /^ifrs-full_ShorttermDepositsNotClassifiedAsCashEquivalents$/;

function toNumber(str) {
  const n = Number(String(str ?? "").replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

/**
 * @param rows fnlttSinglAcntAll 응답의 list
 * @param {boolean} includeCashFlow 연간 보고서일 때만 현금흐름 항목을 포함한다.
 *   (분기·반기 보고서의 현금흐름은 누적 기준이라 연간 값과 섞어 보여주면 오해하기 쉽다.)
 */
export function extractDerivedMetrics(rows, includeCashFlow = true) {
  const borrowingKeys = new Set();
  let grossBorrowings = 0;
  let hasBorrowing = false;
  let cash = 0;
  let hasCash = false;

  const cf = {
    operatingCF: null,
    investingCF: null,
    financingCF: null,
    capex: null,
    interestPaid: null,
    taxPaid: null,
    cfDepreciation: null,
  };

  for (const row of rows) {
    const id = row.account_id ?? "";
    const name = (row.account_nm ?? "").trim();
    const amount = toNumber(row.thstrm_amount);
    if (amount === null) continue;

    if (row.sj_div === "BS") {
      const isBorrowing =
        (BORROWING_ID.test(id) && !/Nominal/.test(id)) ||
        (isNonStandardId(id) && BORROWING_NAME.test(name.replace(/\s+/g, "")));
      if (isBorrowing) {
        const dedupeKey = `${id}|${name}`;
        if (!borrowingKeys.has(dedupeKey)) {
          borrowingKeys.add(dedupeKey);
          grossBorrowings += amount;
          hasBorrowing = true;
        }
      } else if (CASH_ID.test(id) || SHORT_DEPOSIT_ID.test(id)) {
        cash += amount;
        hasCash = true;
      }
    } else if (includeCashFlow && row.sj_div === "CF") {
      if (/CashFlowsFromUsedInOperatingActivities$/.test(id) && cf.operatingCF === null) {
        cf.operatingCF = amount;
      } else if (/CashFlowsFromUsedInInvestingActivities$/.test(id) && cf.investingCF === null) {
        cf.investingCF = amount;
      } else if (/CashFlowsFromUsedInFinancingActivities$/.test(id) && cf.financingCF === null) {
        cf.financingCF = amount;
      } else if (
        /^ifrs-full_Purchase(OfPropertyPlantAndEquipment|OfIntangibleAssets)ClassifiedAsInvestingActivities$/.test(id)
      ) {
        // Capex = 유형자산 + 무형자산 취득 (샘플 의견서의 정의와 동일). 회사별로 지출을
        // 양수/음수로 다르게 표기하므로 지출액(양수)으로 통일한다.
        cf.capex = (cf.capex ?? 0) + Math.abs(amount);
      } else if (/^ifrs-full_InterestPaidClassifiedAs/.test(id)) {
        cf.interestPaid = (cf.interestPaid ?? 0) + Math.abs(amount);
      } else if (
        /^ifrs-full_IncomeTaxesPaidRefundClassifiedAs/.test(id) ||
        (isNonStandardId(id) && /^법인세(의)?(지급|납부|환급|회수)/.test(name.replace(/\s+/g, "")))
      ) {
        // 부호 표기가 회사·연도마다 제각각이다(같은 "법인세의 지급"이 2022년은 음수, 2024년은 양수).
        // 영업에서 창출된 현금흐름과 영업활동현금흐름의 차이로 검산해 보면 모두 '납부'이므로 절대값을 쓴다.
        cf.taxPaid = (cf.taxPaid ?? 0) + Math.abs(amount);
      } else if (/^ifrs-full_Adjustments(ForDepreciationExpense|ForAmortisationExpense)$/.test(id) ||
                 /^dart_AdjustmentsForDepreciationRightofuseAssets$/.test(id)) {
        cf.cfDepreciation = (cf.cfDepreciation ?? 0) + Math.abs(amount);
      }
    }
  }

  const derived = {};
  if (hasCash) derived.cashEquivalents = cash;
  if (hasBorrowing) {
    derived.grossBorrowings = grossBorrowings;
    if (hasCash) derived.netBorrowings = grossBorrowings - cash;
  }
  if (includeCashFlow) {
    for (const [k, v] of Object.entries(cf)) {
      if (v !== null) derived[k] = v;
    }
  }
  return derived;
}
