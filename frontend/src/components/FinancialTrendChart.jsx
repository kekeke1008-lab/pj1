import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function toEok(value) {
  return value === undefined || value === null ? null : Math.round(value / 1e8);
}

export default function FinancialTrendChart({ years }) {
  const validYears = years.filter((y) => !y.error);
  if (validYears.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">재무 추이 데이터가 없습니다</p>;
  }

  const data = validYears.map((y) => ({
    year: `${y.year}`,
    매출액: toEok(y.revenue),
    영업이익: toEok(y.operatingProfit),
    당기순이익: toEok(y.netIncome),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => v.toLocaleString("ko-KR")}
            width={70}
            label={{ value: "억원", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <Tooltip formatter={(v) => `${Number(v).toLocaleString("ko-KR")}억원`} />
          <Legend />
          <Line type="monotone" dataKey="매출액" stroke="#2563eb" strokeWidth={2} />
          <Line type="monotone" dataKey="영업이익" stroke="#16a34a" strokeWidth={2} />
          <Line type="monotone" dataKey="당기순이익" stroke="#d97706" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
