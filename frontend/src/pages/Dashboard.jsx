import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import CompanyCard from "../components/CompanyCard.jsx";
import NewsFeed from "../components/NewsFeed.jsx";
import RefreshButton from "../components/RefreshButton.jsx";

const AUTO_REFRESH_MS = 10 * 60 * 1000;

export default function Dashboard() {
  const [companies, setCompanies] = useState([]);
  const [financialsByCorp, setFinancialsByCorp] = useState({});
  const [news, setNews] = useState([]);
  const [newsFilter, setNewsFilter] = useState("전체");
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const loadCompanies = useCallback(async () => {
    const { companies } = await api.listCompanies();
    setCompanies(companies);
    return companies;
  }, []);

  const loadFinancials = useCallback(async (companyList) => {
    setLoadingFinancials(true);
    const entries = await Promise.all(
      companyList.map(async (c) => {
        try {
          const { cfs, ofs } = await api.getFinancials(c.corpCode, 2);
          const hasValidCfs = cfs.years.some((y) => !y.error);
          return [c.corpCode, hasValidCfs ? cfs.years : ofs.years];
        } catch {
          return [c.corpCode, []];
        }
      })
    );
    setFinancialsByCorp(Object.fromEntries(entries));
    setLoadingFinancials(false);
  }, []);

  const loadNews = useCallback(async () => {
    setLoadingNews(true);
    setError(null);
    try {
      const { items } = await api.getAllNews();
      setNews(items);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingNews(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const list = await loadCompanies();
      if (list.length > 0) {
        loadFinancials(list);
        loadNews();
      }
    })();
  }, [loadCompanies, loadFinancials, loadNews]);

  useEffect(() => {
    if (companies.length === 0) return;
    const id = setInterval(loadNews, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [companies, loadNews]);

  const newsCountByCorp = useMemo(() => {
    const counts = {};
    for (const item of news) {
      counts[item.corpName] = (counts[item.corpName] ?? 0) + 1;
    }
    return counts;
  }, [news]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const c of companies) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group).push(c);
    }
    return [...map.entries()];
  }, [companies]);

  const companyNames = useMemo(() => ["전체", ...new Set(companies.map((c) => c.corpName))], [
    companies,
  ]);

  const filteredNews = useMemo(
    () => (newsFilter === "전체" ? news : news.filter((n) => n.corpName === newsFilter)),
    [news, newsFilter]
  );

  if (companies.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-slate-500">아직 추적 중인 기업이 없습니다.</p>
        <Link
          to="/settings"
          className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          설정에서 담당 거래처를 추가해보세요 →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        {groups.map(([groupName, list]) => (
          <div key={groupName} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-slate-500">{groupName}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => (
                <CompanyCard
                  key={c.corpCode}
                  company={c}
                  financials={financialsByCorp[c.corpCode]}
                  newsCount={newsCountByCorp[c.corpName]}
                  loading={loadingFinancials && !financialsByCorp[c.corpCode]}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">뉴스 피드</h2>
          <RefreshButton onRefresh={loadNews} loading={loadingNews} lastUpdated={lastUpdated} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {companyNames.map((name) => (
            <button
              key={name}
              onClick={() => setNewsFilter(name)}
              className={`text-xs rounded-full px-2.5 py-1 ${
                newsFilter === name
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-2">
          <NewsFeed items={filteredNews} />
        </div>
      </section>
    </div>
  );
}
