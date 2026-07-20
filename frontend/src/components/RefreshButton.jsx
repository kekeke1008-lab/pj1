export default function RefreshButton({ onRefresh, loading, lastUpdated }) {
  return (
    <div className="flex items-center gap-2">
      {lastUpdated && (
        <span className="text-xs text-slate-400">
          업데이트: {lastUpdated.toLocaleTimeString("ko-KR")}
        </span>
      )}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="text-sm px-3 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50"
      >
        {loading ? "새로고침 중..." : "새로고침"}
      </button>
    </div>
  );
}
