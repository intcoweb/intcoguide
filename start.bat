@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动安徽英科医疗厂区导航网页版...
start "GLU-Guide-Server" node server.js
timeout /t 2 /nobreak >nul
start "" http://localhost:8000
echo 已在浏览器打开 http://localhost:8000
pause
