import { formatDate } from "../utils/format.js";

export default function NewsFeed({ items, emptyMessage = "표시할 뉴스가 없습니다" }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item, idx) => (
        <li key={`${item.link}-${idx}`} className="py-3">
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-slate-800 hover:text-blue-600 hover:underline"
          >
            {item.title}
          </a>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            {item.corpName && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                {item.corpName}
              </span>
            )}
            <span>{formatDate(item.pubDate)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
