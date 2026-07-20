import { Router } from "express";
import { getAnnualFinancialsBoth, getRecentPeriodsBoth } from "../services/dartService.js";
import { analyzeFinancials } from "../services/financialAnalysis.js";

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
      const { cfs, ofs } = await getRecentPeriodsBoth(dartApiKey, corpCode, count);
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
          getAnnualFinancialsBoth(dartApiKey, corpCode, annualYears(yearsCount)),
          getRecentPeriodsBoth(dartApiKey, corpCode, quarterCount),
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
      const { cfs, ofs } = await getAnnualFinancialsBoth(dartApiKey, corpCode, annualYears(yearsCount));
      res.json({ corpCode, cfs: { years: cfs }, ofs: { years: ofs } });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}
