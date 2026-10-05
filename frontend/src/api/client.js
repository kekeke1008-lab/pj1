async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `요청 실패 (HTTP ${res.status})`);
  }
  return body;
}

export const api = {
  health: () => request("/health"),

  searchCorps: (q) => request(`/companies/search?q=${encodeURIComponent(q)}`),
  listCompanies: () => request("/companies"),
  addCompany: (payload) =>
    request("/companies", { method: "POST", body: JSON.stringify(payload) }),
  removeCompany: (corpCode) => request(`/companies/${corpCode}`, { method: "DELETE" }),

  // withEbitda: 사업보고서 원문에서 감가상각비를 읽어 EBITDA를 붙인다(첫 조회가 느려 상세 페이지에서만 사용).
  getFinancials: (corpCode, years = 3, withEbitda = false) =>
    request(`/financials/${corpCode}?years=${years}${withEbitda ? "&withEbitda=1" : ""}`),
  getQuarterlyFinancials: (corpCode, count = 4) =>
    request(`/financials/${corpCode}/quarterly?count=${count}`),
  getFinancialAnalysis: (corpCode, years = 5, quarters = 4) =>
    request(`/financials/${corpCode}/analysis?years=${years}&quarters=${quarters}`),

  getCompanyProfile: (corpCode) => request(`/company-profile/${corpCode}`),

  getAllNews: () => request("/news/all"),
  getCompanyNews: (corpName, display = 20) =>
    request(`/news/${encodeURIComponent(corpName)}?display=${display}`),
};
