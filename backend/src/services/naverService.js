const NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json";
const CACHE_TTL_MS = 5 * 60 * 1000;
// 제목만 비교하면 같은 보도자료를 매체마다 다르게 풀어쓴 기사를 놓친다
// (예: "부산공장에 CUD 도입" vs "알록달록 색이 길 안내"). 제목+본문 요약을
// 합친 토큰으로 비교하되, 겹치는 화제라도 며칠 뒤 나온 후속 기사까지
// 지워버리지 않도록 발행 시각이 가까운 경우에만 중복으로 판단한다.
// (실제 중복/비중복 기사 샘플로 튜닝: 중복 쌍 overlap 0.24~0.64, 비중복 쌍 0.03~0.12)
const SIMILARITY_THRESHOLD = 0.22;
// 제목이 사실상 동일한데 본문 요약이 크게 다른 경우(같은 제목, 다른 매체 재작성 설명),
// 제목+본문 합산 토큰에서는 제목의 겹침 신호가 희석돼 위 임계값을 못 넘길 수 있다.
// 그래서 제목만 따로 비교해 더 높은 임계값으로도 중복을 잡아낸다.
const TITLE_ONLY_THRESHOLD = 0.6;
const DUPLICATE_WINDOW_MS = 48 * 60 * 60 * 1000;

// 한국어 조사가 단어 뒤에 그대로 붙어("부산공장에" vs "부산공장은") 같은 단어를
// 다른 토큰으로 갈라놓는 문제를 완화하기 위한 간단한 조사 제거(형태소 분석기 대체 휴리스틱).
// 긴 조사부터 매칭해야 짧은 조사가 먼저 걸려 잘못 잘리는 것을 막을 수 있다.
const JOSA_SUFFIXES = [
  "으로부터", "에서부터", "이라고는", "이라고", "라고는", "라고",
  "에서는", "으로는", "이라는", "라는", "이지만", "지만",
  "에게서", "한테서", "이나마", "이라도", "라도",
  "에서", "으로", "에는", "에도", "까지", "부터", "에게", "께서", "한테",
  "처럼", "만큼", "보다", "마저", "조차", "밖에", "이며", "이나", "이란",
  "이다", "다는", "이랑", "랑", "며", "나", "란",
  "이", "가", "은", "는", "을", "를", "의", "에", "로", "과", "와", "도", "만",
];

function stripJosa(token) {
  for (const suf of JOSA_SUFFIXES) {
    if (token.length - suf.length >= 2 && token.endsWith(suf)) {
      return token.slice(0, -suf.length);
    }
  }
  return token;
}

const cache = new Map(); // query -> { fetchedAt, items }

const HTML_ENTITIES = {
  "&quot;": '"',
  "&amp;": "&",
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

function stripTags(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;|&amp;|&#39;|&apos;|&lt;|&gt;/g, (m) => HTML_ENTITIES[m]);
}

function textTokens(text) {
  const normalized = text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase()
    .trim();
  return new Set(
    normalized
      .split(/\s+/)
      .filter((t) => t.length > 1)
      .map(stripJosa)
      .filter((t) => t.length > 1)
  );
}

// Jaccard(합집합 대비 교집합)는 두 텍스트 길이가 다르면 과소평가되기 쉬워,
// 짧은 쪽 기준 포함비율(overlap coefficient)을 사용한다 — 실제 샘플에서
// 재작성된 기사들의 핵심 키워드 겹침을 더 안정적으로 잡아낸다.
function overlapCoefficient(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / Math.min(a.size, b.size);
}

// 여러 매체가 같은 보도자료를 서로 다른 제목으로 재보도하는 경우가 많아,
// 링크(정확 일치)와 제목+본문 요약 토큰 유사도(퍼지 매치)로 중복 기사를 걸러낸다.
export function dedupeNews(items) {
  const seenLinks = new Set();
  const kept = [];
  const keptSignatures = []; // { titleTokens, combinedTokens, publishedAt }

  for (const item of items) {
    const linkKey = (item.link || "").split("?")[0];
    if (linkKey && seenLinks.has(linkKey)) continue;

    const titleTok = textTokens(item.title);
    const combinedTok = textTokens(`${item.title} ${item.description}`);
    const publishedAt = Date.parse(item.pubDate);

    const isDuplicate = keptSignatures.some((sig) => {
      if (!Number.isNaN(publishedAt) && !Number.isNaN(sig.publishedAt)) {
        if (Math.abs(publishedAt - sig.publishedAt) > DUPLICATE_WINDOW_MS) return false;
      }
      return (
        overlapCoefficient(titleTok, sig.titleTokens) >= TITLE_ONLY_THRESHOLD ||
        overlapCoefficient(combinedTok, sig.combinedTokens) >= SIMILARITY_THRESHOLD
      );
    });
    if (isDuplicate) continue;

    if (linkKey) seenLinks.add(linkKey);
    kept.push(item);
    keptSignatures.push({ titleTokens: titleTok, combinedTokens: combinedTok, publishedAt });
  }

  return kept;
}

export async function searchNews(clientId, clientSecret, query, display = 20) {
  const cached = cache.get(query);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }

  // 중복 보도가 걸러지고도 display만큼 남도록 넉넉히 받아온 뒤 자른다 (네이버 최대 100건).
  const fetchCount = Math.min(display * 2, 100);

  const url = new URL(NAVER_NEWS_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(fetchCount));
  url.searchParams.set("sort", "date");

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Naver News API HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const rawItems = (json.items ?? []).map((item) => ({
    title: stripTags(item.title),
    description: stripTags(item.description),
    link: item.originallink || item.link,
    pubDate: item.pubDate,
  }));

  const items = dedupeNews(rawItems).slice(0, display);

  cache.set(query, { fetchedAt: Date.now(), items });
  return items;
}
