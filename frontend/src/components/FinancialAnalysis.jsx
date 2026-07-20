const SECTIONS = [
  { key: "growth", title: "성장성", accent: "border-blue-200 bg-blue-50" },
  { key: "stability", title: "안정성", accent: "border-emerald-200 bg-emerald-50" },
  { key: "profitability", title: "수익성", accent: "border-amber-200 bg-amber-50" },
];

export default function FinancialAnalysis({ analysis }) {
  if (!analysis || !analysis.narrative) {
    return <p className="text-sm text-slate-400 py-6 text-center">분석할 재무 데이터가 없습니다</p>;
  }

  const { basisYear, basisPeriod, narrative } = analysis;

  return (
    <div>
      {basisYear && (
        <p className="mb-3 text-xs text-slate-400">
          분석 기준: {basisYear}년 {basisPeriod}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {SECTIONS.map((section) => (
          <div key={section.key} className={`rounded-lg border p-3 ${section.accent}`}>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">{section.title}</h3>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {(narrative[section.key] ?? []).map((line, idx) => (
                <li key={idx} className="leading-snug">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        위 판단 기준(부채비율 200%, 유동비율 100% 등)은 업종 특성을 반영하지 않은 일반적인 경험칙이며, 참고용입니다.
      </p>
    </div>
  );
}
