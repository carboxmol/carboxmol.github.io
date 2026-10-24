# ==============================================================================
# CarboxMol Windows PowerShell Installer
# Carbox Architecture Team
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  CarboxMol — Interactive Crystallography Workbench (Windows Setup)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Check Python
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCmd) {
    Write-Host "Error: Python 3.9+ is not found in PATH." -ForegroundColor Red
    Write-Host "Please install Python from https://www.python.org or Microsoft Store." -ForegroundColor Yellow
    Exit 1
}

Write-Host "[1/3] Detected Python: $(python --version)" -ForegroundColor Green

# 2. Upgrade pip and install package
Write-Host "[2/3] Installing CarboxMol & dependencies..." -ForegroundColor Green
python -m pip install --upgrade pip
python -m pip install "git+https://github.com/carbox/carbox.git"

# 3. Completion message
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  CarboxMol Successfully Installed on Windows!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  To launch the 3D Workbench:" -ForegroundColor Yellow
Write-Host "    carboxmol 4LGN" -ForegroundColor White
Write-Host ""
Write-Host "  To survey a PDB structure:" -ForegroundColor Yellow
Write-Host "    carbox 4LGN" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
