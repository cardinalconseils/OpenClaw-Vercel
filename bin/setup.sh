#!/bin/bash
# OpenClaw — Service Matchmaker
# Project setup script

set -e

echo "========================================="
echo "  OpenClaw — Service Matchmaker Setup"
echo "========================================="
echo ""

# Create .env from .env.example
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
    echo "  → Edit .env with your API keys"
  fi
else
  echo ".env already exists, skipping"
fi

# Create required directories
mkdir -p src/{api,lib/{voice,state,ai/prompts,tools/handlers},types}
mkdir -p tests
mkdir -p .claude/temp
mkdir -p .planning/{codebase,phases}
echo "Created directory structure"

# Install pre-commit hook
if [ -d .git ]; then
  if [ -f .claude/hooks/pre-commit.sh ]; then
    cp .claude/hooks/pre-commit.sh .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo "Installed pre-commit hook (secret scanning)"
  fi
fi

# Make hook scripts executable
chmod +x .claude/hooks/*.sh 2>/dev/null || true
chmod +x bin/*.sh 2>/dev/null || true

# Install dependencies if package.json exists
if [ -f package.json ] && [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Run: claude"
echo "  3. Run: /gsd:new-project (or /gsd:progress if already initialized)"
echo ""
