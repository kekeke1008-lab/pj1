import { formatKRW } from "../utils/format.js";

function Section({ title, children }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function EmptyRow({ children }) {
  return <p className="text-sm text-slate-400 py-3">{children}</p>;
}

export default function CompanyProfile({ profile }) {
  if (!profile) {
    return <p className="text-sm text-slate-400 py-6 text-center">기업정보를 불러오는 중...</p>;
  }

  const { largestShareholders, affiliateInvestments, executives, commitments } = profile;
  const affiliates = (affiliateInvestments ?? []).filter((a) => a.isManagementParticipation);
  const otherInvestments = (affiliateInvestments ?? []).filter((a) => !a.isManagementParticipation);

  return (
    <div>
      <Section title="지배구조 (최대주주 및 특수관계인)">
        {!largestShareholders?.length ? (
          <EmptyRow>공시된 최대주주 현황이 없습니다</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1.5 pr-4 font-medium">성명(법인명)</th>
                  <th className="py-1.5 pr-4 font-medium">관계</th>
                  <th className="py-1.5 pr-4 font-medium">기말 지분율</th>
                  <th className="py-1.5 pr-4 font-medium">기말 보유주식수</th>
                </tr>
              </thead>
              <tbody>
                {largestShareholders.map((s, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-4">{s.name}</td>
                    <td className="py-1.5 pr-4 text-slate-500">{s.relation}</td>
                    <td className="py-1.5 pr-4">{s.ownershipPctEnd ?? "-"}%</td>
                    <td className="py-1.5 pr-4">{s.sharesEnd?.toLocaleString("ko-KR") ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`계열회사 현황 (경영참여 목적 출자, ${affiliates.length}개)`}>
        {!affiliates.length ? (
          <EmptyRow>경영참여 목적의 출자 내역이 없습니다</EmptyRow>
        ) : (
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 sticky top-0 bg-white">
                  <th className="py-1.5 pr-4 font-medium">회사명</th>
                  <th className="py-1.5 pr-4 font-medium">기말 지분율</th>
                  <th className="py-1.5 pr-4 font-medium">기말 장부가액</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((a, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-4">{a.name}</td>
                    <td className="py-1.5 pr-4">{a.ownershipPctEnd ?? "-"}%</td>
                    <td className="py-1.5 pr-4">{a.bookValueEnd ? formatKRW(a.bookValueEnd) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {otherInvestments.length > 0 && (
          <p className="mt-1.5 text-xs text-slate-400">
            이 외 단순투자 목적 출자 {otherInvestments.length}건은 표시하지 않았습니다.
          </p>
        )}
      </Section>

      <Section title={`임원 현황 (${executives?.length ?? 0}명)`}>
        {!executives?.length ? (
          <EmptyRow>공시된 임원 현황이 없습니다</EmptyRow>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1.5 pr-4 font-medium">성명</th>
                  <th className="py-1.5 pr-4 font-medium">직위</th>
                  <th className="py-1.5 pr-4 font-medium">등기구분/상근</th>
                  <th className="py-1.5 pr-4 font-medium">담당업무</th>
                  <th className="py-1.5 pr-4 font-medium">재직기간</th>
                </tr>
              </thead>
              <tbody>
                {executives.map((e, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-4">{e.name}</td>
                    <td className="py-1.5 pr-4">{e.position}</td>
                    <td className="py-1.5 pr-4 text-slate-500">
                      {e.registrationType || "-"} · {e.isFullTime ? "상근" : "비상근"}
                    </td>
                    <td className="py-1.5 pr-4">{e.chargeJob}</td>
                    <td className="py-1.5 pr-4 text-slate-500">{e.tenurePeriod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="우발채무 및 약정사항 (여신한도·지급보증·소송)">
        {!commitments?.available || !commitments.snippets?.length ? (
          <EmptyRow>사업보고서에서 관련 문단을 찾지 못했습니다</EmptyRow>
        ) : (
          <div className="space-y-3">
            {commitments.snippets.map((s, idx) => (
              <div key={idx} className="rounded-md bg-slate-50 p-3">
                <p className="mb-1 text-xs font-medium text-slate-500">{s.label}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{s.text}</p>
              </div>
            ))}
            <p className="text-xs text-slate-400">
              사업보고서 원문에서 관련 키워드 주변 문단을 그대로 발췌한 내용으로, 문맥이 잘려 보일 수 있습니다.
              정확한 확인은 DART 원문 공시를 참고하세요.
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}
