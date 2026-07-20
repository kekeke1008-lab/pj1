import { formatKRW, formatPercent } from "../utils/format.js";

const ROWS = [
  { key: "revenue", label: "매출액" },
  { key: "operatingProfit", label: "영업이익" },
  { key: "netIncome", label: "당기순이익" },
  { key: "totalAssets", label: "자산총계" },
  { key: "totalLiabilities", label: "부채총계" },
  { key: "totalEquity", label: "자본총계" },
];

export default function QuarterlyFinancialTable({ periods }) {
  const valid = (periods ?? []).filter((p) => !p.error);
  if (valid.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">최근 분기 데이터가 없습니다</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">항목</th>
              {valid.map((p) => (
                <th key={`${p.year}-${p.period}`} className="py-2 pr-4 font-medium">
                  {p.year} {p.period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-slate-600">{row.label}</td>
                {valid.map((p) => (
                  <td key={`${p.year}-${p.period}`} className="py-2 pr-4">
                    {formatKRW(p[row.key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="py-2 pr-4 text-slate-600">부채비율</td>
              {valid.map((p) => (
                <td key={`${p.year}-${p.period}`} className="py-2 pr-4">
                  {formatPercent(
                    p.totalLiabilities !== undefined && p.totalEquity
                      ? (p.totalLiabilities / p.totalEquity) * 100
                      : null
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        매출액·영업이익·당기순이익은 1분기를 제외하면 연초부터 해당 분기말까지의 누적 금액입니다
        (DART 분기·반기보고서 기준).
      </p>
    </div>
  );
}
