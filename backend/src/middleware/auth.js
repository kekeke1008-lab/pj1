import crypto from "node:crypto";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30일

// 개인 1인 사용 앱이라 DB 없이 메모리에 유효 세션 토큰만 들고 있는다.
// (서버 재시작 시 초기화되어 재로그인이 필요해질 수 있음 — 무료 호스팅에서는 정상적인 동작)
const validSessions = new Set();

export function createAuthMiddleware(appPassword) {
  function login(req, res) {
    if (!appPassword) return res.json({ ok: true });
    if (req.body?.password !== appPassword) {
      return res.status(401).json({ error: "비밀번호가 올바르지 않습니다" });
    }
    const token = crypto.randomBytes(24).toString("hex");
    validSessions.add(token);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_MS,
    });
    res.json({ ok: true });
  }

  function requireAuth(req, res, next) {
    if (!appPassword) return next(); // 비밀번호 미설정(로컬 개발) 시 인증 생략

    const publicPaths = ["/login", "/api/login", "/api/health"];
    if (publicPaths.includes(req.path) || req.path.startsWith("/login-assets")) {
      return next();
    }

    const token = req.cookies?.[SESSION_COOKIE];
    if (token && validSessions.has(token)) return next();

    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    res.redirect("/login");
  }

  return { login, requireAuth };
}
