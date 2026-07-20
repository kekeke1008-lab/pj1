function pct(numerator, denominator) {
  if (numerator === undefined || denominator === undefined || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function round1(value) {
  return value === null || value === undefined ? null : Math.round(value * 10) / 10;
}

// 분기/반기 보고서의 순이익은 연초 누적치라 12개월치 이익이 아니다. 이를 그대로
// 기말 자기자본/총자산(스톡, 연 단위 지표와 비교되는 값)과 나누면 ROE/ROA가
// 실제보다 훨씬 낮게 나온다. 최근 분기 기준으로도 연 단위와 비교 가능하도록
// 12개월로 연환산한 순이익을 사용한다.
const MONTHS_BY_PERIOD_LABEL = { "1분기": 3, 반기: 6, "3분기": 9, "사업보고서(연간)": 12 };

function monthsInPeriod(period) {
  return MONTHS_BY_PERIOD_LABEL[period?.period] ?? 12;
}

/** 최근(가장 최신) 유효 기간의 재무비율을 계산한다. */
export function computeRatios(period) {
  if (!period) return {};
  const months = monthsInPeriod(period);
  const annualizedNetIncome =
    period.netIncome === undefined ? undefined : period.netIncome * (12 / months);

  return {
    operatingMargin: round1(pct(period.operatingProfit, period.revenue)),
    netMargin: round1(pct(period.netIncome, period.revenue)),
    roe: round1(pct(annualizedNetIncome, period.totalEquity)),
    roa: round1(pct(annualizedNetIncome, period.totalAssets)),
    debtRatio: round1(pct(period.totalLiabilities, period.totalEquity)),
    equityRatio: round1(pct(period.totalEquity, period.totalAssets)),
    currentRatio: round1(pct(period.currentAssets, period.currentLiabilities)),
    isAnnualized: months < 12,
  };
}

function yoy(curr, prev) {
  if (curr === undefined || prev === undefined) return null;
  if (prev === 0) return null;
  return round1(((curr - prev) / Math.abs(prev)) * 100);
}

function cagr(first, last, periodCount) {
  if (first === undefined || last === undefined || periodCount <= 0) return null;
  if (first <= 0 || last <= 0) return null; // 부호가 바뀌는 구간은 CAGR 정의 불가
  return round1((Math.pow(last / first, 1 / periodCount) - 1) * 100);
}

/** years는 오래된 순으로 정렬된 연간(사업보고서) 배열이어야 한다. */
export function computeGrowth(years) {
  const valid = (years ?? []).filter((y) => !y.error);
  if (valid.length === 0) return null;

  const latest = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  const first = valid[0];
  const spanYears = valid.length - 1;

  return {
    latestYear: latest.year,
    revenueYoY: prev ? yoy(latest.revenue, prev.revenue) : null,
    operatingProfitYoY: prev ? yoy(latest.operatingProfit, prev.operatingProfit) : null,
    netIncomeYoY: prev ? yoy(latest.netIncome, prev.netIncome) : null,
    revenueCagr: spanYears >= 2 ? cagr(first.revenue, latest.revenue, spanYears) : null,
    cagrYears: spanYears >= 2 ? spanYears : null,
    netIncomeFlippedToProfit: prev ? prev.netIncome <= 0 && latest.netIncome > 0 : false,
    netIncomeFlippedToLoss: prev ? prev.netIncome > 0 && latest.netIncome <= 0 : false,
    operatingProfitFlippedToProfit: prev
      ? prev.operatingProfit <= 0 && latest.operatingProfit > 0
      : false,
    operatingProfitFlippedToLoss: prev
      ? prev.operatingProfit > 0 && latest.operatingProfit <= 0
      : false,
  };
}

function describeDebtRatio(value) {
  if (value === null) return null;
  if (value < 100) return `부채비율 ${value}%로 자기자본이 부채보다 많아 재무구조가 안정적인 편입니다.`;
  if (value < 200) return `부채비율 ${value}%로 통상적인 관리 가능 범위 내에 있습니다.`;
  return `부채비율 ${value}%로 200%를 상회해 재무 레버리지가 높은 편이므로 이자보상능력 등을 함께 점검할 필요가 있습니다.`;
}

function describeEquityRatio(value) {
  if (value === null) return null;
  if (value >= 50) return `자기자본비율 ${value}%로 자산의 절반 이상을 자기자본으로 조달하고 있습니다.`;
  if (value >= 30) return `자기자본비율 ${value}%로 보통 수준의 자본 구성을 보이고 있습니다.`;
  return `자기자본비율 ${value}%로 낮은 편이라 외부 차입 의존도가 높습니다.`;
}

function describeCurrentRatio(value) {
  if (value === null) return null;
  if (value >= 150) return `유동비율 ${value}%로 단기 지급능력이 우수합니다.`;
  if (value >= 100) return `유동비율 ${value}%로 단기 채무를 유동자산으로 충당 가능한 수준입니다.`;
  return `유동비율 ${value}%로 100%를 밑돌아 단기 유동성 관리에 유의할 필요가 있습니다.`;
}

function describeYoY(label, value, unitNote = "") {
  if (value === null) return `${label} 증감률은 전기 값이 없어 계산할 수 없습니다.`;
  if (value > 0) return `${label} 전년 대비 ${value}% 증가했습니다.${unitNote}`;
  if (value < 0) return `${label} 전년 대비 ${Math.abs(value)}% 감소했습니다.${unitNote}`;
  return `${label} 전년과 비슷한 수준을 유지했습니다.${unitNote}`;
}

function describeMargin(label, value) {
  if (value === null) return `${label}은 매출액 정보가 없어 계산할 수 없습니다.`;
  if (value < 0) return `${label} ${value}%로 적자 상태입니다.`;
  return `${label} ${value}%입니다.`;
}

/**
 * 성장성/안정성/수익성 관점의 한국어 간단 분석 문구를 생성한다.
 * 절대적인 좋다/나쁘다 판단은 업종별 벤치마크 없이는 어려우므로,
 * 일반적으로 통용되는 경험적 기준(부채비율 200% 등)과 추세(전년比) 중심으로 서술한다.
 */
export function generateNarrative({ years, quarters, ratios, growth }) {
  const result = { growth: [], stability: [], profitability: [] };

  // 성장성
  if (growth) {
    if (growth.operatingProfitFlippedToLoss) {
      result.growth.push("영업이익이 전년 흑자에서 올해 적자로 전환됐습니다.");
    } else if (growth.operatingProfitFlippedToProfit) {
      result.growth.push("영업이익이 전년 적자에서 올해 흑자로 전환됐습니다.");
    } else {
      result.growth.push(describeYoY("영업이익은", growth.operatingProfitYoY));
    }

    if (growth.netIncomeFlippedToLoss) {
      result.growth.push("당기순이익이 전년 흑자에서 올해 적자로 전환됐습니다.");
    } else if (growth.netIncomeFlippedToProfit) {
      result.growth.push("당기순이익이 전년 적자에서 올해 흑자로 전환됐습니다.");
    } else {
      result.growth.push(describeYoY("당기순이익은", growth.netIncomeYoY));
    }

    result.growth.unshift(describeYoY("매출액은", growth.revenueYoY));

    if (growth.revenueCagr !== null) {
      result.growth.push(
        `최근 ${growth.cagrYears}개년 매출액 연평균성장률(CAGR)은 ${growth.revenueCagr}%입니다.`
      );
    }
  } else {
    result.growth.push("성장성을 분석할 연간 재무 데이터가 부족합니다.");
  }

  // 안정성
  if (ratios && (ratios.debtRatio !== null || ratios.equityRatio !== null)) {
    const debt = describeDebtRatio(ratios.debtRatio);
    const equity = describeEquityRatio(ratios.equityRatio);
    if (debt) result.stability.push(debt);
    if (equity) result.stability.push(equity);

    const latestQuarter = (quarters ?? []).filter((q) => !q.error).slice(-1)[0];
    const currentRatioValue = latestQuarter
      ? computeRatios(latestQuarter).currentRatio
      : ratios.currentRatio;
    const current = describeCurrentRatio(currentRatioValue);
    if (current) result.stability.push(current);
  } else {
    result.stability.push("안정성을 분석할 재무상태표 데이터가 부족합니다.");
  }

  // 수익성
  if (ratios) {
    const annualizedNote = ratios.isAnnualized ? " (분기 순이익 연환산 기준)" : "";
    result.profitability.push(describeMargin("영업이익률은", ratios.operatingMargin));
    result.profitability.push(describeMargin("순이익률은", ratios.netMargin));
    if (ratios.roe !== null) {
      result.profitability.push(`자기자본이익률(ROE)은 ${ratios.roe}%입니다.${annualizedNote}`);
    }
    if (ratios.roa !== null) {
      result.profitability.push(`총자산이익률(ROA)은 ${ratios.roa}%입니다.${annualizedNote}`);
    }
  } else {
    result.profitability.push("수익성을 분석할 재무 데이터가 부족합니다.");
  }

  return result;
}

/** years(연간, 오래된순), quarters(분기, 오래된순)를 받아 분석 결과 전체를 만든다. */
export function analyzeFinancials({ years, quarters }) {
  const validYears = (years ?? []).filter((y) => !y.error);
  const validQuarters = (quarters ?? []).filter((q) => !q.error);
  const latestPeriod = validQuarters.slice(-1)[0] ?? validYears.slice(-1)[0];

  const ratios = latestPeriod ? computeRatios(latestPeriod) : null;
  const growth = computeGrowth(years);
  const narrative = generateNarrative({ years, quarters, ratios, growth });

  return {
    basisYear: latestPeriod?.year ?? null,
    basisPeriod: latestPeriod?.period ?? "사업보고서(연간)",
    ratios,
    growth,
    narrative,
  };
}
