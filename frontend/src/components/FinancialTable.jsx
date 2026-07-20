import { formatKRW, formatPercent } from "../utils/format.js";

const ROWS = [
  { key: "revenue", label: "매출액" },
  { key: "operatingProfit", label: "영업이익" },
  { key: "netIncome", label: "당기순이익" },
  { key: "totalAssets", label: "자산총계" },
  { key: "totalLiabilities", label: "부채총계" },
  { key: "totalEquity", label: "자본총계" },
];

export default function FinancialTable({ years }) {
  const validYears = years.filter((y) => !y.error);
  if (validYears.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">재무제표 데이터가 없습니다</p>;
  }

  return (
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
          {ROWS.map((row) => (
            <tr key={row.key} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-600">{row.label}</td>
              {validYears.map((y) => (
                <td key={y.year} className="py-2 pr-4">
                  {formatKRW(y[row.key])}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-b border-slate-100">
            <td className="py-2 pr-4 text-slate-600">부채비율</td>
            {validYears.map((y) => (
              <td key={y.year} className="py-2 pr-4">
                {formatPercent(
                  y.totalLiabilities !== undefined && y.totalEquity
                    ? (y.totalLiabilities / y.totalEquity) * 100
                    : null
                )}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-2 pr-4 text-slate-600">영업이익률</td>
            {validYears.map((y) => (
              <td key={y.year} className="py-2 pr-4">
                {formatPercent(
                  y.operatingProfit !== undefined && y.revenue
                    ? (y.operatingProfit / y.revenue) * 100
                    : null
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
