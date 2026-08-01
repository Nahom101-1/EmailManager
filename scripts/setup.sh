#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${BLUE}[LifeOS]${NC} $*"; }
success() { echo -e "${GREEN}[LifeOS]${NC} $*"; }
warn()    { echo -e "${YELLOW}[LifeOS]${NC} $*"; }

OS=$(uname -s)
ARCH=$(uname -m)

# ── Detect RAM ───────────────────────────────────────────────────────────────
if [ "$OS" = "Darwin" ]; then
  RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
  RAM_GB=$(( RAM_BYTES / 1024 / 1024 / 1024 ))
elif [ "$OS" = "Linux" ]; then
  RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}' || echo 0)
  RAM_GB=$(( RAM_KB / 1024 / 1024 ))
else
  RAM_GB=8
fi

# ── Detect NVIDIA VRAM ───────────────────────────────────────────────────────
NVIDIA_VRAM=0
if command -v nvidia-smi &>/dev/null; then
  NVIDIA_VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 || echo 0)
fi

# ── Pick model ───────────────────────────────────────────────────────────────
if [ "$ARCH" = "arm64" ] && [ "$OS" = "Darwin" ]; then
  DEVICE_DESC="Apple Silicon (${RAM_GB}GB unified memory)"
  if   [ "$RAM_GB" -ge 32 ]; then MODEL="llama3.1:8b"
  elif [ "$RAM_GB" -ge 16 ]; then MODEL="llama3.1:8b"
  elif [ "$RAM_GB" -ge 8  ]; then MODEL="llama3.2:3b"
  else                              MODEL="llama3.2:1b"
  fi
elif [ "$NVIDIA_VRAM" -ge 8000 ]; then
  DEVICE_DESC="NVIDIA GPU (${NVIDIA_VRAM}MB VRAM)"
  MODEL="llama3.1:8b"
elif [ "$NVIDIA_VRAM" -ge 4000 ]; then
  DEVICE_DESC="NVIDIA GPU (${NVIDIA_VRAM}MB VRAM)"
  MODEL="llama3.2:3b"
elif [ "$RAM_GB" -ge 16 ]; then
  DEVICE_DESC="CPU (${RAM_GB}GB RAM)"
  MODEL="llama3.2:3b"
else
  DEVICE_DESC="CPU (${RAM_GB}GB RAM)"
  MODEL="llama3.2:1b"
fi

info "Device: $DEVICE_DESC"
info "Recommended model: $MODEL"
echo ""

# ── Install Ollama if missing ────────────────────────────────────────────────
if command -v ollama &>/dev/null; then
  success "Ollama already installed ($(ollama --version 2>&1 | head -1))"
else
  info "Installing Ollama..."
  if [ "$OS" = "Darwin" ] && command -v brew &>/dev/null; then
    brew install ollama
  else
    curl -fsSL https://ollama.ai/install.sh | sh
  fi
  success "Ollama installed"
fi

# ── Start Ollama daemon if not running ───────────────────────────────────────
if ! curl -s http://localhost:11434/api/tags &>/dev/null; then
  info "Starting Ollama daemon..."
  ollama serve &>/dev/null &
  sleep 3
fi

# ── Pull model ───────────────────────────────────────────────────────────────
info "Pulling $MODEL (this may take a few minutes on first run)..."
ollama pull "$MODEL"
success "Model ready: $MODEL"

# ── Write env vars ───────────────────────────────────────────────────────────
ENV_FILE=".env.local"
# Remove old OLLAMA_ lines if present
if [ -f "$ENV_FILE" ]; then
  sed -i.bak '/^OLLAMA_/d' "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
fi
{
  echo "OLLAMA_MODEL=$MODEL"
  echo "OLLAMA_URL=http://localhost:11434"
} >> "$ENV_FILE"

success "Written to $ENV_FILE"
echo ""
echo "  Web app:  npm run dev"
echo "  CLI:      npm run cli"
echo ""
success "Setup complete!"
