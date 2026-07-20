import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { parseStringPromise } from "xml2js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const CACHE_PATH = path.join(DATA_DIR, "corpCode.cache.json");
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // DART updates this list infrequently

let memoryCache = null; // { fetchedAt, corps: [{corp_code, corp_name, stock_code}] }

function loadFromDisk() {
  if (!fs.existsSync(CACHE_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    if (Array.isArray(raw.corps)) return raw;
  } catch {
    return null;
  }
  return null;
}

function saveToDisk(cache) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf-8");
}

async function downloadCorpCodes(apiKey) {
  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`DART corpCode.xml request failed: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  // DART returns a zip file on success, or a small XML error payload on failure.
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new Error(
      `DART corpCode 응답이 zip이 아닙니다: ${buffer.toString("utf-8").slice(0, 300)}`
    );
  }

  const entry = zip.getEntries()[0];
  const xml = entry.getData().toString("utf-8");
  const parsed = await parseStringPromise(xml);
  const list = parsed?.result?.list ?? [];

  const corps = list.map((item) => ({
    corp_code: item.corp_code?.[0] ?? "",
    corp_name: item.corp_name?.[0] ?? "",
    stock_code: (item.stock_code?.[0] ?? "").trim(),
    modify_date: item.modify_date?.[0] ?? "",
  }));

  return { fetchedAt: Date.now(), corps };
}

async function getCorpCodeCache(apiKey) {
  if (memoryCache && Date.now() - memoryCache.fetchedAt < MAX_CACHE_AGE_MS) {
    return memoryCache;
  }

  const disk = loadFromDisk();
  if (disk && Date.now() - disk.fetchedAt < MAX_CACHE_AGE_MS) {
    memoryCache = disk;
    return memoryCache;
  }

  const fresh = await downloadCorpCodes(apiKey);
  memoryCache = fresh;
  saveToDisk(fresh);
  return fresh;
}

/**
 * Searches the cached DART corp list by (partial, case-insensitive) name match.
 * Listed companies (non-empty stock_code) are surfaced first since RM portfolios
 * are usually looking for the publicly filing entity.
 */
export async function searchCorps(apiKey, query, limit = 20) {
  const { corps } = await getCorpCodeCache(apiKey);
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches = corps.filter((c) => c.corp_name.toLowerCase().includes(q));
  matches.sort((a, b) => {
    const aListed = a.stock_code ? 0 : 1;
    const bListed = b.stock_code ? 0 : 1;
    if (aListed !== bListed) return aListed - bListed;
    return a.corp_name.localeCompare(b.corp_name, "ko");
  });

  return matches.slice(0, limit);
}

export async function getCorpByCode(apiKey, corpCode) {
  const { corps } = await getCorpCodeCache(apiKey);
  return corps.find((c) => c.corp_code === corpCode) ?? null;
}
