@echo off
setlocal

set JAVABIN=C:\Program Files\Android\Android Studio\jbr\bin\java.exe
set BUNDLE_DIR=%~dp0build\app\outputs\bundle\release
set JAR=%BUNDLE_DIR%\bundlesigner-0.1.13.jar
set AAB=%BUNDLE_DIR%\app-release.aab
set KEYSTORE=%~dp0android\app\upload-keystore.jks

if not exist "%AAB%" (
    echo [ERROR] %AAB% not found. Run "flutter build appbundle --release" first.
    exit /b 1
)

if not exist "%JAR%" (
    echo [ERROR] %JAR% not found.
    exit /b 1
)

echo [INFO] Generating Cafe Bazaar signed bin file...
"%JAVABIN%" -jar "%JAR%" genbin -v --bundle "%AAB%" --bin "%BUNDLE_DIR%" --v2-signing-enabled true --v3-signing-enabled false --ks "%KEYSTORE%" --ks-key-alias upload --ks-pass pass:afsanehsaz_keystore_pass_2026 --key-pass pass:afsanehsaz_keystore_pass_2026

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCESS] Successfully generated: %BUNDLE_DIR%\app-release.bin
    echo Upload both app-release.aab and app-release.bin to the Cafe Bazaar Developer Console.
) else (
    echo.
    echo [ERROR] Failed to sign bundle.
)
