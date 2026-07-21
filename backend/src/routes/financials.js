import { Router } from "express";
import { getAnnualFinancialsBoth, getRecentPeriodsBoth } from "../services/dartService.js";
import { analyzeFinancials } from "../services/financialAnalysis.js";

// 재무제표는 실시간으로 바뀌는 데이터가 아니라(분기/연 단위로만 갱신) 매 페이지 로딩마다
// DART를 다시 조회할 필요가 없다. 대시보드에서 거래처 10여 곳을 한번에 조회하면 DART
// 호출이 수십 건씩 발생해 체감 로딩이 느려지므로, 응답을 캐싱해 재방문 시 즉시 반환한다.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간
const cache = new Map(); // key -> { fetchedAt, data }

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.data;
  }
  const data = await loader();
  cache.set(key, { fetchedAt: Date.now(), data });
  return data;
}

export function financialsRouter({ dartApiKey }) {
  const router = Router();

  function ensureKey(res) {
    if (!dartApiKey) {
      res.status(400).json({ error: "DART_API_KEY가 설정되지 않았습니다 (.env 확인)" });
      return false;
    }
    return true;
  }

  function annualYears(count) {
    const currentYear = new Date().getFullYear();
    // DART publishes the annual report (사업보고서) for year Y around March of Y+1,
    // so the most recent fully-available year is typically last year.
    return Array.from({ length: count }, (_, i) => currentYear - 1 - i).reverse();
  }

  router.get("/:corpCode/quarterly", async (req, res) => {
    if (!ensureKey(res)) return;
    const { corpCode } = req.params;
    const count = Math.min(Number(req.query.count) || 4, 8);

    try {
      const { cfs, ofs } = await cached(`quarterly:${corpCode}:${count}`, () =>
        getRecentPeriodsBoth(dartApiKey, corpCode, count)
      );
      res.json({ corpCode, cfs: { periods: cfs }, ofs: { periods: ofs } });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get("/:corpCode/analysis", async (req, res) => {
    if (!ensureKey(res)) return;
    const { corpCode } = req.params;
    const yearsCount = Math.min(Number(req.query.years) || 5, 5);
    const quarterCount = Math.min(Number(req.query.quarters) || 4, 8);

    try {
      const [{ cfs: cfsYears, ofs: ofsYears }, { cfs: cfsQuarters, ofs: ofsQuarters }] =
        await Promise.all([
          cached(`annual:${corpCode}:${yearsCount}`, () =>
            getAnnualFinancialsBoth(dartApiKey, corpCode, annualYears(yearsCount))
          ),
          cached(`quarterly:${corpCode}:${quarterCount}`, () =>
            getRecentPeriodsBoth(dartApiKey, corpCode, quarterCount)
          ),
        ]);

      res.json({
        corpCode,
        cfs: analyzeFinancials({ years: cfsYears, quarters: cfsQuarters }),
        ofs: analyzeFinancials({ years: ofsYears, quarters: ofsQuarters }),
      });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get("/:corpCode", async (req, res) => {
    if (!ensureKey(res)) return;
    const { corpCode } = req.params;
    const yearsCount = Math.min(Number(req.query.years) || 3, 5);

    try {
      const { cfs, ofs } = await cached(`annual:${corpCode}:${yearsCount}`, () =>
        getAnnualFinancialsBoth(dartApiKey, corpCode, annualYears(yearsCount))
      );
      res.json({ corpCode, cfs: { years: cfs }, ofs: { years: ofs } });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}
