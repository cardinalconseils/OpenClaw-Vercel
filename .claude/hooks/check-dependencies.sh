#!/bin/bash
# Verify project dependencies are installed

set -e

MISSING=0

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "MISSING: Node.js (requires 20+)"
  MISSING=$((MISSING + 1))
else
  NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 20 ]; then
    echo "WARNING: Node.js $NODE_VERSION detected, requires 20+"
  fi
fi

# Check npm
if ! command -v npm &> /dev/null; then
  echo "MISSING: npm"
  MISSING=$((MISSING + 1))
fi

# Check git
if ! command -v git &> /dev/null; then
  echo "MISSING: git"
  MISSING=$((MISSING + 1))
fi

# Check node_modules
if [ -f package.json ] && [ ! -d node_modules ]; then
  echo "WARNING: node_modules not found. Run: npm install"
fi

if [ $MISSING -gt 0 ]; then
  echo ""
  echo "$MISSING required dependency(ies) missing."
  exit 1
fi

echo "All dependencies present."
