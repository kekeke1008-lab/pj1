import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { companiesRouter } from "./routes/companies.js";
import { financialsRouter } from "./routes/financials.js";
import { newsRouter } from "./routes/news.js";
import { companyProfileRouter } from "./routes/companyProfile.js";
import { createAuthMiddleware } from "./middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = process.env.PORT || 4000;
const dartApiKey = process.env.DART_API_KEY || "";
const naverClientId = process.env.NAVER_CLIENT_ID || "";
const naverClientSecret = process.env.NAVER_CLIENT_SECRET || "";
const appPassword = process.env.APP_PASSWORD || "";

if (!dartApiKey || !naverClientId || !naverClientSecret) {
  console.warn(
    "[설정 필요] backend/.env에 DART_API_KEY / NAVER_CLIENT_ID / NAVER_CLIENT_SECRET을 입력해주세요.\n" +
      " - DART 키 발급: https://opendart.fss.or.kr (회원가입 > 오픈API 이용신청)\n" +
      " - 네이버 키 발급: https://developers.naver.com/apps (애플리케이션 등록 > 검색 API 추가)\n" +
      "키가 없어도 서버는 켜지지만, 기업 검색/재무조회/뉴스조회 API는 오류를 반환합니다."
  );
}
if (!appPassword) {
  console.warn("[알림] APP_PASSWORD가 설정되지 않아 로그인 없이 접근 가능합니다 (로컬 개발 시 정상).");
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

const { login, requireAuth } = createAuthMiddleware(appPassword);
app.use(requireAuth);

app.get("/login", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "login.html"));
});
app.post("/api/login", login);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    dartConfigured: Boolean(dartApiKey),
    naverConfigured: Boolean(naverClientId && naverClientSecret),
  });
});

app.use("/api/companies", companiesRouter({ dartApiKey }));
app.use("/api/financials", financialsRouter({ dartApiKey }));
app.use("/api/news", newsRouter({ naverClientId, naverClientSecret }));
app.use("/api/company-profile", companyProfileRouter({ dartApiKey }));

// 배포(프로덕션) 환경에서는 프론트엔드 빌드 결과물을 백엔드가 같이 서빙한다.
// (로컬 개발 시에는 frontend/dist가 없으므로 이 블록은 자연히 건너뛴다.)
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Finance/News tracker backend listening on http://localhost:${PORT}`);
});
