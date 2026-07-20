import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const STORE_PATH = path.join(DATA_DIR, "companies.json");

function readAll() {
  if (!fs.existsSync(STORE_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(companies) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(companies, null, 2), "utf-8");
}

export function listCompanies() {
  return readAll();
}

export function addCompany({ corpCode, corpName, stockCode, group }) {
  const companies = readAll();
  if (companies.some((c) => c.corpCode === corpCode)) {
    throw new Error("이미 추가된 기업입니다");
  }
  const entry = {
    id: corpCode,
    corpCode,
    corpName,
    stockCode: stockCode || "",
    group: group || corpName,
    addedAt: new Date().toISOString(),
  };
  companies.push(entry);
  writeAll(companies);
  return entry;
}

export function removeCompany(corpCode) {
  const companies = readAll();
  const next = companies.filter((c) => c.corpCode !== corpCode);
  writeAll(next);
  return next;
}
