import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import FinancialTrendChart from "../components/FinancialTrendChart.jsx";
import FinancialTable from "../components/FinancialTable.jsx";
import QuarterlyFinancialTable from "../components/QuarterlyFinancialTable.jsx";
import FinancialAnalysis from "../components/FinancialAnalysis.jsx";
import CompanyProfile from "../components/CompanyProfile.jsx";
import NewsFeed from "../components/NewsFeed.jsx";
import RefreshButton from "../components/RefreshButton.jsx";

const EMPTY_DIVISION = { years: [], periods: [], analysis: null };

function hasValidData(list) {
  return (list ?? []).some((item) => !item.error);
}

export default function CompanyDetail() {
  const { corpCode } = useParams();
  const [company, setCompany] = useState(null);
  const [financials, setFinancials] = useState({ cfs: EMPTY_DIVISION, ofs: EMPTY_DIVISION });
  const [fsDiv, setFsDiv] = useState("cfs");
  const [profile, setProfile] = useState(null);
  const [news, setNews] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const { companies } = await api.listCompanies();
      const found = companies.find((c) => c.corpCode === corpCode);
      setCompany(found ?? null);

      try {
        const [annualRes, quarterlyRes, analysisRes] = await Promise.all([
          api.getFinancials(corpCode, 5),
          api.getQuarterlyFinancials(corpCode, 4),
          api.getFinancialAnalysis(corpCode, 5, 4),
        ]);

        const merged = {
          cfs: {
            years: annualRes.cfs.years,
            periods: quarterlyRes.cfs.periods,
            analysis: analysisRes.cfs,
          },
          ofs: {
            years: annualRes.ofs.years,
            periods: quarterlyRes.ofs.periods,
            analysis: analysisRes.ofs,
          },
        };
        setFinancials(merged);
        // 연결재무제표가 있으면 기본으로 보여주고, 없으면 개별로 자동 전환한다.
        setFsDiv(hasValidData(merged.cfs.years) ? "cfs" : "ofs");
      } catch (err) {
        setError(err.message);
      }

      try {
        const profileRes = await api.getCompanyProfile(corpCode);
        setProfile(profileRes);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [corpCode]);

  const loadNews = useCallback(async () => {
    if (!company) return;
    setLoadingNews(true);
    try {
      const { items } = await api.getCompanyNews(company.corpName, 30);
      setNews(items);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingNews(false);
    }
  }, [company]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const cfsAvailable = useMemo(() => hasValidData(financials.cfs.years), [financials]);
  const ofsAvailable = useMemo(() => hasValidData(financials.ofs.years), [financials]);
  const selected = financials[fsDiv] ?? EMPTY_DIVISION;

  if (!company) {
    return (
      <div className="text-sm text-slate-500">
        <Link to="/" className="text-blue-600 hover:underline">
          ← 대시보드로
        </Link>
        <p className="mt-4">기업 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          ← 대시보드로
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-bold">{company.corpName}</h1>
          <span className="text-xs text-slate-400">{company.group}</span>
          {company.stockCode && (
            <span className="text-xs rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
              {company.stockCode}
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-1.5">
        <button
          onClick={() => setFsDiv("cfs")}
          disabled={!cfsAvailable}
          className={`text-sm rounded-md px-3 py-1.5 font-medium disabled:opacity-40 ${
            fsDiv === "cfs" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          연결재무제표
        </button>
        <button
          onClick={() => setFsDiv("ofs")}
          disabled={!ofsAvailable}
          className={`text-sm rounded-md px-3 py-1.5 font-medium disabled:opacity-40 ${
            fsDiv === "ofs" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          개별재무제표
        </button>
        {!cfsAvailable && <span className="self-center text-xs text-slate-400">연결재무제표 미작성</span>}
        {!ofsAvailable && <span className="self-center text-xs text-slate-400">개별재무제표 데이터 없음</span>}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-slate-800">재무 추이</h2>
        <FinancialTrendChart years={selected.years} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-slate-800">재무제표 상세</h2>
        <FinancialTable years={selected.years} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-slate-800">최근 분기 실적</h2>
        <QuarterlyFinancialTable periods={selected.periods} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-slate-800">재무분석 (성장성·안정성·수익성)</h2>
        <FinancialAnalysis analysis={selected.analysis} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-slate-800">기업정보 (지배구조·계열사·임원·약정사항)</h2>
        <CompanyProfile profile={profile} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">관련 뉴스</h2>
          <RefreshButton onRefresh={loadNews} loading={loadingNews} lastUpdated={lastUpdated} />
        </div>
        <div className="mt-2">
          <NewsFeed items={news} />
        </div>
      </section>
    </div>
  );
}
