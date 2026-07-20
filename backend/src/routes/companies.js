import { Router } from "express";
import { searchCorps } from "../services/corpCodeStore.js";
import { listCompanies, addCompany, removeCompany } from "../services/companiesStore.js";

export function companiesRouter({ dartApiKey }) {
  const router = Router();

  router.get("/search", async (req, res) => {
    const query = String(req.query.q ?? "");
    if (!dartApiKey) {
      return res.status(400).json({ error: "DART_API_KEY가 설정되지 않았습니다 (.env 확인)" });
    }
    if (!query.trim()) {
      return res.json({ results: [] });
    }
    try {
      const results = await searchCorps(dartApiKey, query);
      res.json({ results });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  router.get("/", (_req, res) => {
    res.json({ companies: listCompanies() });
  });

  router.post("/", (req, res) => {
    const { corpCode, corpName, stockCode, group } = req.body ?? {};
    if (!corpCode || !corpName) {
      return res.status(400).json({ error: "corpCode, corpName은 필수입니다" });
    }
    try {
      const entry = addCompany({ corpCode, corpName, stockCode, group });
      res.status(201).json({ company: entry });
    } catch (err) {
      res.status(409).json({ error: err.message });
    }
  });

  router.delete("/:corpCode", (req, res) => {
    const companies = removeCompany(req.params.corpCode);
    res.json({ companies });
  });

  return router;
}
