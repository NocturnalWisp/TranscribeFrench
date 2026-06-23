$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"
$venvPip = Join-Path $scriptDir ".venv\Scripts\pip.exe"

$python313 = "C:\Python313\python.exe"
if (-not (Test-Path $python313)) {
    $python313 = (py -3.13 -c "import sys; print(sys.executable)" 2>$null)
}

if (-not $python313 -or -not (Test-Path $python313)) {
    Write-Error "Python 3.13 is required for CUDA PyTorch. Install it from https://www.python.org/downloads/"
    exit 1
}

Write-Host "Using Python: $python313"

if (Test-Path (Join-Path $scriptDir ".venv")) {
    Write-Host "Removing existing virtual environment..."
    Remove-Item -Recurse -Force (Join-Path $scriptDir ".venv")
}

& $python313 -m venv (Join-Path $scriptDir ".venv")
& $venvPython -m pip install --upgrade pip
& $venvPip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
& $venvPip install -r (Join-Path $scriptDir "requirements.txt")

Write-Host ""
Write-Host "Setup complete. Run transcription with:"
Write-Host "  .\.venv\Scripts\python.exe transcribe.py path\to\audio.mp3"
Write-Host ""
Write-Host "Or use the wrapper:"
Write-Host "  .\transcribe.ps1 path\to\audio.mp3"
