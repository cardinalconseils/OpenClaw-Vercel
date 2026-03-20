#!/bin/bash
# Pre-commit hook: Block hardcoded secrets and .env files

set -e

# Check for .env files being committed
ENV_FILES=$(git diff --cached --name-only | grep -E '\.env(\.|$)' || true)
if [ -n "$ENV_FILES" ]; then
  echo "ERROR: Attempting to commit .env file(s):"
  echo "$ENV_FILES"
  echo "Remove with: git reset HEAD <file>"
  exit 1
fi

# Check for common secret patterns
SECRET_PATTERNS=(
  'TELNYX_API_KEY=\S+'
  'TELNYX_API_SECRET=\S+'
  'GOOGLE_MAPS_API_KEY=\S+'
  'ANTHROPIC_API_KEY=\S+'
  'SUPABASE_SERVICE_ROLE_KEY=\S+'
  'sk-[a-zA-Z0-9]{20,}'
  'key_[a-zA-Z0-9]{20,}'
)

for pattern in "${SECRET_PATTERNS[@]}"; do
  MATCHES=$(git diff --cached -U0 | grep -E "^\+" | grep -E "$pattern" || true)
  if [ -n "$MATCHES" ]; then
    echo "ERROR: Possible hardcoded secret detected:"
    echo "$MATCHES"
    echo "Use environment variables instead."
    exit 1
  fi
done

echo "Pre-commit checks passed."
