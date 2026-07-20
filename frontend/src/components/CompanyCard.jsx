import { Link } from "react-router-dom";
import { formatKRW, yoyChange } from "../utils/format.js";

function ChangeBadge({ value }) {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  return (
    <span
      className={`text-xs font-medium rounded px-1.5 py-0.5 ${
        positive ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
      }`}
    >
      {positive ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function CompanyCard({ company, financials, newsCount, loading }) {
  const validYears = (financials ?? []).filter((y) => !y.error);
  const latest = validYears[validYears.length - 1];
  const prev = validYears[validYears.length - 2];

  return (
    <Link
      to={`/company/${company.corpCode}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400">{company.group}</p>
          <h3 className="font-semibold text-slate-800">{company.corpName}</h3>
        </div>
        {newsCount !== undefined && (
          <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
            뉴스 {newsCount}
          </span>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">재무 데이터 불러오는 중...</p>
      ) : latest ? (
        <div className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">매출액</span>
            <span className="flex items-center gap-1.5">
              {formatKRW(latest.revenue)}
              <ChangeBadge value={yoyChange(latest.revenue, prev?.revenue)} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">영업이익</span>
            <span className="flex items-center gap-1.5">
              {formatKRW(latest.operatingProfit)}
              <ChangeBadge value={yoyChange(latest.operatingProfit, prev?.operatingProfit)} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">당기순이익</span>
            <span className="flex items-center gap-1.5">
              {formatKRW(latest.netIncome)}
              <ChangeBadge value={yoyChange(latest.netIncome, prev?.netIncome)} />
            </span>
          </div>
          <p className="text-xs text-slate-400 pt-1">{latest.year}년 기준</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">재무 데이터 없음</p>
      )}
    </Link>
  );
}
