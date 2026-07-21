import { Router } from "express";
import { searchNews } from "../services/naverService.js";
import { listCompanies } from "../services/companiesStore.js";

export function newsRouter({ naverClientId, naverClientSecret }) {
  const router = Router();

  function ensureKeys(res) {
    if (!naverClientId || !naverClientSecret) {
      res
        .status(400)
        .json({ error: "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 설정되지 않았습니다 (.env 확인)" });
      return false;
    }
    return true;
  }

  router.get("/all", async (_req, res) => {
    if (!ensureKeys(res)) return;
    const companies = listCompanies();

    // 네이버 검색 API 초당 호출 제한(429)을 피하면서도 거래처가 많을 때(10곳 이상)
    // 전부 순차 호출하면 체감 로딩이 느려지므로, 소규모 배치 단위로 병렬 처리한다.
    // (성공한 결과는 naverService의 5분 캐시에 저장되므로, 캐시가 살아있는 동안의
    // 재조회는 지연 없이 즉시 반환된다.)
    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 150;
    const perCompany = [];

    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((c) => searchNews(naverClientId, naverClientSecret, c.corpName, 10))
      );
      results.forEach((result, idx) => {
        const c = batch[idx];
        if (result.status === "fulfilled") {
          perCompany.push(result.value.map((item) => ({ ...item, corpName: c.corpName, group: c.group })));
        } else {
          console.error(`[뉴스] ${c.corpName} 조회 실패: ${result.reason?.message}`);
        }
      });
      if (i + BATCH_SIZE < companies.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    const merged = perCompany.flat().sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    res.json({ items: merged });
  });

  router.get("/:corpName", async (req, res) => {
    if (!ensureKeys(res)) return;
    try {
      const items = await searchNews(
        naverClientId,
        naverClientSecret,
        req.params.corpName,
        Number(req.query.display) || 20
      );
      res.json({ items });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  return router;
}
