# Setup Guide

Step-by-step instructions to set up the project locally for development.

## System Requirements

### Required

- **Node.js**: v18 or higher
  - Check: `node --version`
  - Download: https://nodejs.org/
- **npm**: v9 or higher
  - Check: `npm --version`
- **Git**: Latest version
  - Check: `git --version`

### Recommended

- VS Code with TypeScript support
- 4GB+ RAM
- 500MB+ disk space

## Installation

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd <project-directory>
```

### Step 2: Install Dependencies

```bash
npm install
```

Or with other package managers:
```bash
yarn install
pnpm install
```

### Step 3: Environment Setup

```bash
# Create .env from template
cp .env.example .env

# Edit with your configuration
code .env
```

## Verification

Run these commands to verify setup:

```bash
# Check Node version
node --version      # Should be v18+

# Check dependencies installed
npm list --depth=0

# Check TypeScript
npx tsc --version

# Run linting
npm run lint

# Run type checking
npx tsc --noEmit

# Run tests
npm run test
```

All commands should complete without critical errors.

## Development Commands

```bash
npm run dev              # Start development server
npm run build            # Build project
npm run lint             # Check code quality
npm run lint:fix         # Auto-fix issues
npm run format           # Format code
npm run test             # Run tests
npm run test:watch       # Watch mode tests
npm run test:coverage    # Check coverage
```

## Troubleshooting

### npm install fails

```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Node version issues

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 18
nvm install 18
nvm use 18
```

### TypeScript errors

```bash
# Reinstall and check
npm install
npx tsc --version
```

### Port already in use

```bash
# Use different port
PORT=3001 npm run dev
```

## Project Context

After setup, read these files to understand the project:

- **AGENTS.md** - Project goals, status, and priorities
- **CODE_STANDARDS.md** - Coding guidelines and standards
- **CONTRIBUTING.md** - How to contribute
- **README.md** - Project overview

## Next Steps

1. Read `AGENTS.md` for project context
2. Read `CODE_STANDARDS.md` for coding guidelines
3. Check `CONTRIBUTING.md` for workflow
4. Create a feature branch and make your first change
5. Run `npm run lint` and `npm run test` before committing

Welcome! 🚀
