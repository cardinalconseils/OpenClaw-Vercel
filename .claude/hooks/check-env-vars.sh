#!/bin/bash
# Validate .env against .env.example

set -e

if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy from .env.example:"
  echo "  cp .env.example .env"
  exit 1
fi

if [ ! -f .env.example ]; then
  echo "ERROR: .env.example not found."
  exit 1
fi

MISSING=0

while IFS= read -r line; do
  # Skip comments and empty lines
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "$line" ]] && continue

  # Extract variable name
  VAR_NAME=$(echo "$line" | cut -d'=' -f1)

  if ! grep -q "^${VAR_NAME}=" .env; then
    echo "MISSING: $VAR_NAME (defined in .env.example but not in .env)"
    MISSING=$((MISSING + 1))
  fi
done < .env.example

if [ $MISSING -gt 0 ]; then
  echo ""
  echo "$MISSING variable(s) missing from .env"
  exit 1
fi

echo "All environment variables present."
