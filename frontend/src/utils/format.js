export function formatKRW(amount) {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return "-";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const eok = abs / 1e8; // 억원 단위
  const jo = Math.floor(eok / 10000);
  const remainderEok = Math.round(eok - jo * 10000);
  if (jo > 0) {
    return `${sign}${jo}조 ${remainderEok.toLocaleString("ko-KR")}억원`;
  }
  return `${sign}${Math.round(eok).toLocaleString("ko-KR")}억원`;
}

export function formatPercent(value, digits = 1) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${value.toFixed(digits)}%`;
}

export function yoyChange(curr, prev) {
  if (curr === undefined || prev === undefined || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
