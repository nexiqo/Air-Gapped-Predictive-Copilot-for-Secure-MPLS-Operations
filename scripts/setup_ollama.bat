@echo off
echo ============================================================
echo  NOC Copilot - Offline LLaMA Setup
echo ============================================================
echo.

:: Check if Ollama is already installed
where ollama >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo [OK] Ollama is already installed.
    goto :pull_model
)

echo [INFO] Downloading Ollama for Windows...
powershell -Command "Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile '%TEMP%\OllamaSetup.exe'"
echo [INFO] Running Ollama installer...
start /wait "" "%TEMP%\OllamaSetup.exe" /S

:: Refresh PATH
set PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama

:pull_model
echo.
echo [INFO] Starting Ollama service...
start "" ollama serve
timeout /t 3 /nobreak >nul

echo [INFO] Pulling llama3 model (this may take a few minutes)...
ollama pull llama3

echo.
echo ============================================================
echo  Setup complete! llama3 model is ready for offline use.
echo  Run: npm run dev   (frontend)
echo  Run: python -m uvicorn backend.main:app --port 8000 (backend)
echo ============================================================
pause
