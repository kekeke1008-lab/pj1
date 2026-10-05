import { formatKRW, formatPercent, formatMultiple } from "../utils/format.js";

function truncate(text, max = 160) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export default function PrintSummary({ company, fsDiv, selected, profile, news }) {
  const validYears = (selected?.years ?? []).filter((y) => !y.error).slice(-3);
  const narrative = selected?.analysis?.narrative;
  const basisYear = selected?.analysis?.basisYear;
  const basisPeriod = selected?.analysis?.basisPeriod;

  const topShareholders = (profile?.largestShareholders ?? []).slice(0, 3);
  const affiliateCount = (profile?.affiliateInvestments ?? []).filter(
    (a) => a.isManagementParticipation
  ).length;
  const executiveCount = profile?.executives?.length ?? 0;
  const commitmentSnippets = profile?.commitments?.snippets ?? [];

  const topNews = (news ?? []).slice(0, 5);

  return (
    <div id="print-summary" className="hidden">
      <div className="p-8 text-black" style={{ fontSize: "11px" }}>
        <div className="mb-4 border-b-2 border-black pb-2">
          <h1 className="text-lg font-bold">
            {company?.corpName} 여신검토 요약 ({fsDiv === "ofs" ? "개별" : "연결"}재무제표 기준)
          </h1>
          <p className="text-xs text-gray-600">
            {company?.group} · {company?.stockCode || "비상장"} · 생성일시{" "}
            {new Date().toLocaleString("ko-KR")}
          </p>
        </div>

        <section className="mb-3">
          <h2 className="mb-1 font-bold">재무 스냅샷 (최근 3개년)</h2>
          {validYears.length === 0 ? (
            <p className="text-gray-500">재무 데이터 없음</p>
          ) : (
            <table className="w-full border-collapse" style={{ fontSize: "10px" }}>
              <thead>
                <tr>
                  <th className="border border-gray-400 px-2 py-1 text-left">항목</th>
                  {validYears.map((y) => (
                    <th key={y.year} className="border border-gray-400 px-2 py-1 text-left">
                      {y.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["매출액", "revenue"],
                  ["영업이익", "operatingProfit"],
                  ["당기순이익", "netIncome"],
                  ["총차입금", "grossBorrowings"],
                  ["순차입금", "netBorrowings"],
                  ["EBITDA", "ebitda"],
                  ["영업활동 현금흐름", "operatingCF"],
                ].map(([label, key]) => (
                  <tr key={key}>
                    <td className="border border-gray-400 px-2 py-1">{label}</td>
                    {validYears.map((y) => (
                      <td key={y.year} className="border border-gray-400 px-2 py-1">
                        {formatKRW(y[key])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="border border-gray-400 px-2 py-1">부채비율</td>
                  {validYears.map((y) => (
                    <td key={y.year} className="border border-gray-400 px-2 py-1">
                      {formatPercent(
                        y.totalLiabilities !== undefined && y.totalEquity
                          ? (y.totalLiabilities / y.totalEquity) * 100
                          : null
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1">차입금의존도</td>
                  {validYears.map((y) => (
                    <td key={y.year} className="border border-gray-400 px-2 py-1">
                      {formatPercent(
                        y.grossBorrowings !== undefined && y.totalAssets
                          ? (y.grossBorrowings / y.totalAssets) * 100
                          : null
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-gray-400 px-2 py-1">순차입금/EBITDA</td>
                  {validYears.map((y) => (
                    <td key={y.year} className="border border-gray-400 px-2 py-1">
                      {formatMultiple(
                        y.netBorrowings !== undefined && y.ebitda > 0 ? y.netBorrowings / y.ebitda : null
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </section>

        <section className="mb-3">
          <h2 className="mb-1 font-bold">
            재무분석 요약 {basisYear ? `(기준: ${basisYear}년 ${basisPeriod})` : ""}
          </h2>
          {!narrative ? (
            <p className="text-gray-500">분석 데이터 없음</p>
          ) : (
            <ul className="list-disc pl-4">
              <li>{narrative.growth?.[0]}</li>
              <li>{narrative.stability?.[0]}</li>
              <li>{narrative.stability?.[2]}</li>
              {(narrative.stability ?? []).slice(3).map((line, idx) => (
                <li key={`st-${idx}`}>{line}</li>
              ))}
              <li>{narrative.profitability?.[0]}</li>
              <li>{narrative.profitability?.[1]}</li>
            </ul>
          )}
        </section>

        <section className="mb-3">
          <h2 className="mb-1 font-bold">지배구조 · 계열사 · 임원</h2>
          <p>
            최대주주: {topShareholders[0] ? `${topShareholders[0].name} (${topShareholders[0].ownershipPctEnd}%)` : "정보 없음"}
            {topShareholders.length > 1 &&
              `, ${topShareholders
                .slice(1)
                .map((s) => `${s.name} ${s.ownershipPctEnd}%`)
                .join(", ")}`}
          </p>
          <p>
            경영참여 목적 계열회사 {affiliateCount}개 · 등기임원 {executiveCount}명
          </p>
        </section>

        <section className="mb-3">
          <h2 className="mb-1 font-bold">우발채무 · 약정사항</h2>
          {commitmentSnippets.length === 0 ? (
            <p className="text-gray-500">공시된 약정사항 문단을 찾지 못함</p>
          ) : (
            <ul className="list-disc pl-4">
              {commitmentSnippets.map((s, idx) => (
                <li key={idx}>
                  <span className="font-semibold">{s.label}:</span> {truncate(s.text, 140)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-1 font-bold">최근 뉴스</h2>
          {topNews.length === 0 ? (
            <p className="text-gray-500">최근 뉴스 없음</p>
          ) : (
            <ul className="list-disc pl-4">
              {topNews.map((n, idx) => (
                <li key={idx}>
                  {n.title} ({new Date(n.pubDate).toLocaleDateString("ko-KR")})
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-4 border-t border-gray-400 pt-2 text-gray-500" style={{ fontSize: "9px" }}>
          데이터 출처: 금융감독원 전자공시시스템(DART), 네이버 뉴스검색. 본 요약본은 참고용이며, 정확한 확인은 원문
          공시자료를 기준으로 해주세요.
        </p>
      </div>
    </div>
  );
}
