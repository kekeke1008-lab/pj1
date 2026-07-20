import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function Settings() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [groupLabel, setGroupLabel] = useState("");
  const [companies, setCompanies] = useState([]);

  const loadCompanies = useCallback(async () => {
    const { companies } = await api.listCompanies();
    setCompanies(companies);
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const { results } = await api.searchCorps(query.trim());
      setResults(results);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(corp) {
    try {
      await api.addCompany({
        corpCode: corp.corp_code,
        corpName: corp.corp_name,
        stockCode: corp.stock_code,
        group: groupLabel.trim() || corp.corp_name,
      });
      await loadCompanies();
    } catch (err) {
      setSearchError(err.message);
    }
  }

  async function handleRemove(corpCode) {
    await api.removeCompany(corpCode);
    await loadCompanies();
  }

  const grouped = companies.reduce((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-800">거래처(법인) 검색해서 추가</h2>
        <p className="mt-1 text-xs text-slate-500">
          DART에 공시된 법인명으로 검색합니다. CJ그룹, 동국계열처럼 여러 법인이 있는 경우
          계열사별로 각각 검색해서 추가하고, 아래 "그룹 라벨"로 같은 이름으로 묶어주세요.
        </p>

        <form onSubmit={handleSearch} className="mt-3 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: CJ제일제당"
            className="flex-1 min-w-[180px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <input
            value={groupLabel}
            onChange={(e) => setGroupLabel(e.target.value)}
            placeholder="그룹 라벨 (예: CJ그룹) - 비우면 법인명 사용"
            className="flex-1 min-w-[220px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {searching ? "검색 중..." : "검색"}
          </button>
        </form>

        {searchError && <p className="mt-3 text-sm text-red-600">{searchError}</p>}

        {results.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            {results.map((corp) => (
              <li key={corp.corp_code} className="flex items-center justify-between py-2">
                <div>
                  <span className="text-sm font-medium text-slate-800">{corp.corp_name}</span>
                  {corp.stock_code && (
                    <span className="ml-2 text-xs text-slate-400">{corp.stock_code}</span>
                  )}
                </div>
                <button
                  onClick={() => handleAdd(corp)}
                  className="text-xs rounded-md border border-slate-300 px-2.5 py-1 hover:bg-slate-100"
                >
                  추가
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-800">추적 중인 거래처</h2>
        {companies.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">아직 추가된 거래처가 없습니다.</p>
        ) : (
          Object.entries(grouped).map(([group, list]) => (
            <div key={group} className="mt-4">
              <h3 className="text-xs font-semibold text-slate-500">{group}</h3>
              <ul className="mt-1 divide-y divide-slate-100">
                {list.map((c) => (
                  <li key={c.corpCode} className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-700">
                      {c.corpName}
                      {c.stockCode && (
                        <span className="ml-2 text-xs text-slate-400">{c.stockCode}</span>
                      )}
                    </span>
                    <button
                      onClick={() => handleRemove(c.corpCode)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
