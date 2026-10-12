@echo off
setlocal

rem Run Cafe Bazaar Pishkhan deployment CLI tool from repository root
cd /d "%~dp0web"
npx tsx scripts/deploy-bazaar.ts %*
