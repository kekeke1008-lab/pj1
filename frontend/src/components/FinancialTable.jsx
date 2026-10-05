import { formatKRW, formatPercent, formatMultiple } from "../utils/format.js";

const ratio = (num, den) => (num !== undefined && den ? (num / den) * 100 : null);
const multiple = (num, den) => (num !== undefined && den > 0 ? num / den : null);
const fcf = (y) => (y.operatingCF !== undefined && y.capex !== undefined ? y.operatingCF - y.capex : undefined);

// 표 구성: section은 구분 행, 나머지는 연도별 값을 만들어내는 행
const ROWS = [
  { label: "매출액", get: (y) => formatKRW(y.revenue) },
  { label: "영업이익", get: (y) => formatKRW(y.operatingProfit) },
  { label: "당기순이익", get: (y) => formatKRW(y.netIncome) },
  { label: "자산총계", get: (y) => formatKRW(y.totalAssets) },
  { label: "부채총계", get: (y) => formatKRW(y.totalLiabilities) },
  { label: "자본총계", get: (y) => formatKRW(y.totalEquity) },
  { label: "자본금", get: (y) => formatKRW(y.capitalStock) },
  { label: "유형자산", get: (y) => formatKRW(y.propertyPlantEquipment) },
  { label: "부채비율", get: (y) => formatPercent(ratio(y.totalLiabilities, y.totalEquity)) },
  { label: "영업이익률", get: (y) => formatPercent(ratio(y.operatingProfit, y.revenue)) },

  { section: "차입 · 유동성" },
  { label: "현금성자산", get: (y) => formatKRW(y.cashEquivalents) },
  { label: "총차입금", get: (y) => formatKRW(y.grossBorrowings) },
  { label: "순차입금", get: (y) => formatKRW(y.netBorrowings) },
  { label: "차입금의존도", get: (y) => formatPercent(ratio(y.grossBorrowings, y.totalAssets)) },

  { section: "EBITDA" },
  { label: "감가·무형자산상각비", get: (y) => formatKRW(y.depreciationAmortization) },
  { label: "EBITDA", get: (y) => formatKRW(y.ebitda) },
  { label: "EBITDA마진", get: (y) => formatPercent(ratio(y.ebitda, y.revenue)) },
  { label: "총차입금/EBITDA", get: (y) => formatMultiple(multiple(y.grossBorrowings, y.ebitda)) },
  { label: "순차입금/EBITDA", get: (y) => formatMultiple(multiple(y.netBorrowings, y.ebitda)) },

  { section: "현금흐름" },
  { label: "영업활동 현금흐름", get: (y) => formatKRW(y.operatingCF) },
  { label: "투자활동 현금흐름", get: (y) => formatKRW(y.investingCF) },
  { label: "재무활동 현금흐름", get: (y) => formatKRW(y.financingCF) },
  { label: "Capex (유·무형자산 취득)", get: (y) => formatKRW(y.capex) },
  { label: "FCF (영업CF − Capex)", get: (y) => formatKRW(fcf(y)) },
  { label: "이자 지급", get: (y) => formatKRW(y.interestPaid) },
  { label: "법인세 납부", get: (y) => formatKRW(y.taxPaid) },
];

export default function FinancialTable({ years }) {
  const validYears = years.filter((y) => !y.error);
  if (validYears.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">재무제표 데이터가 없습니다</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">항목</th>
              {validYears.map((y) => (
                <th key={y.year} className="py-2 pr-4 font-medium">
                  {y.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) =>
              row.section ? (
                <tr key={row.section} className="bg-slate-50">
                  <td colSpan={validYears.length + 1} className="py-1.5 pl-1 text-xs font-semibold text-slate-500">
                    {row.section}
                  </td>
                </tr>
              ) : (
                <tr key={row.label} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-600">{row.label}</td>
                  {validYears.map((y) => (
                    <td key={y.year} className="py-2 pr-4">
                      {row.get(y)}
                    </td>
                  ))}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400 leading-relaxed">
        총차입금 = 단기·장기차입금 + 사채 + 리스부채 / 현금성자산 = 현금및현금성자산 + 단기금융상품 / EBITDA = 영업이익 +
        감가상각비·무형자산상각비(사업보고서 주석 기준, 최근 2개 사업연도만 제공되며 이전 연도는 "-") / 이자 지급·법인세 납부는
        현금흐름표 기준입니다. 유형자산은 재무상태표 표시 기준이라 사용권자산을 별도 표시한 연도(2021년 이전 등)에는 합산 기준
        자료와 차이가 있을 수 있습니다. 법인세 납부는 부호 표기가 회사·연도마다 달라 납부액(절대값)으로 맞췄습니다.
      </p>
    </div>
  );
}
