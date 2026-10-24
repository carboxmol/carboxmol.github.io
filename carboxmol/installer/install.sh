#!/usr/bin/env bash
# ==============================================================================
# CarboxMol Cross-Platform Installer (macOS & Linux)
# Carbox Architecture Team
# ==============================================================================
set -e

echo "======================================================================"
echo "  CarboxMol — Interactive Crystallography Workbench Installer"
echo "  Carbox Architecture Team"
echo "======================================================================"

# 1. Detect OS and Architecture
OS="$(uname -s)"
ARCH="$(uname -m)"
echo "[1/4] Detected Platform: $OS ($ARCH)"

# 2. Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3.9+ is required to install CarboxMol."
    if [ "$OS" = "Darwin" ]; then
        echo "Please install Python using Homebrew: brew install python"
    else
        echo "Please install Python: sudo apt install python3 python3-pip (or dnf install python3)"
    fi
    exit 1
fi

PY_VER="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
echo "[2/4] Found Python: $PY_VER"

# 3. Install CarboxMol via pip
echo "[3/4] Installing CarboxMol & Carbox packages..."
python3 -m pip install --upgrade pip
python3 -m pip install "carbox @ git+https://github.com/carbox/carbox.git" || {
    echo "Direct git install failed, installing local wheel or development link..."
    python3 -m pip install -e .
}

# 4. Verify installation
echo "[4/4] Verifying CLI installation..."
if command -v carboxmol &> /dev/null; then
    echo "======================================================================"
    echo "  CarboxMol Successfully Installed!"
    echo "======================================================================"
    echo "  To launch the 3D Crystallographic Workbench:"
    echo "    $ carboxmol 4LGN"
    echo ""
    echo "  To run high-throughput mining on a PDB file:"
    echo "    $ carbox 4LGN"
    echo "======================================================================"
else
    echo "Note: Make sure your Python bin directory is on your PATH (e.g. ~/.local/bin)."
    echo "You can run directly via: python3 -m carboxmol.cli 4LGN"
fi
