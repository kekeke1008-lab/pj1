import { Router } from "express";
import {
  getExecutives,
  getLargestShareholders,
  getAffiliateInvestments,
  getCommitmentsAndLitigation,
} from "../services/dartCorpInfoService.js";

// 지배구조/임원/약정사항은 자주 바뀌지 않고, 특히 우발채무 항목은 원문 문서(수 MB)를
// 매번 다시 받는 비용이 커서 재무제표보다 더 긴 캐시(6시간)를 둔다.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.data;
  const data = await loader();
  cache.set(key, { fetchedAt: Date.now(), data });
  return data;
}

export function companyProfileRouter({ dartApiKey }) {
  const router = Router();

  router.get("/:corpCode", async (req, res) => {
    if (!dartApiKey) {
      return res.status(400).json({ error: "DART_API_KEY가 설정되지 않았습니다 (.env 확인)" });
    }
    const { corpCode } = req.params;
    const year = new Date().getFullYear() - 1; // 최근 확정 사업보고서 기준

    try {
      const [executives, largestShareholders, affiliateInvestments, commitments] = await Promise.all([
        cached(`exec:${corpCode}:${year}`, () => getExecutives(dartApiKey, corpCode, year)),
        cached(`shr:${corpCode}:${year}`, () => getLargestShareholders(dartApiKey, corpCode, year)),
        cached(`aff:${corpCode}:${year}`, () => getAffiliateInvestments(dartApiKey, corpCode, year)),
        cached(`commit:${corpCode}:${year}`, () => getCommitmentsAndLitigation(dartApiKey, corpCode, year)),
      ]);

      res.json({ corpCode, year, executives, largestShareholders, affiliateInvestments, commitments });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}
