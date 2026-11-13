#!/usr/bin/env bash
set -euo pipefail
MODEL="${OLLAMA_MODEL:-qwen3.5:4b}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed on this Mac."
  echo "Install it from https://ollama.com/download, open the Ollama app once, then run this script again."
  exit 1
fi

# On macOS the desktop app normally owns the local server. Open it if available.
if [[ "$(uname -s)" == "Darwin" ]]; then
  open -a Ollama >/dev/null 2>&1 || true
fi

echo "Waiting for the local Ollama server..."
for _ in {1..20}; do
  if curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  echo "Ollama is installed but its local server is not responding on port 11434. Open Ollama and retry."
  exit 1
fi

echo "Downloading ${MODEL}..."
ollama pull "$MODEL"

echo
echo "Testing ${MODEL}..."
ollama run "$MODEL" "Rewrite this in very simple English, one sentence: The committee deferred consideration of the item pending a staff report." </dev/null

echo
echo "Ready. The website can use http://127.0.0.1:11434 with model ${MODEL}."
