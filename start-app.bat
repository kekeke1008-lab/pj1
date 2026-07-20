@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "거래처 재무뉴스 모니터링 서버" cmd /k npm run dev

echo 서버가 준비될 때까지 기다리는 중...
set count=0

:waitloop
curl -s -o nul http://localhost:5173 >nul 2>&1
if %errorlevel%==0 goto ready
set /a count+=1
if %count% GEQ 30 goto slow
timeout /t 1 /nobreak >nul
goto waitloop

:ready
start "" http://localhost:5173
exit /b

:slow
echo.
echo 서버 시작이 예상보다 오래 걸리고 있습니다.
echo 새로 열린 "거래처 재무뉴스 모니터링 서버" 창에 오류 메시지가 없는지 확인해주세요.
echo (포트 4000/5173이 이미 사용 중이면 그 창에서 EADDRINUSE 오류가 보일 수 있습니다.)
pause
start "" http://localhost:5173
