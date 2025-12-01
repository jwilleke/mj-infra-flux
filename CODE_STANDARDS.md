# Code Standards

This document outlines the coding standards and best practices for this project.

## Overview

We follow the **DRY (Don't Repeat Yourself) principle** - every piece of knowledge should have a single, unambiguous, authoritative representation. If you see repeated logic more than twice, refactor it into reusable components.

## Language & Environment

- **Language:** English (US) for all code and documentation
- **Runtime:** Node.js with TypeScript
- **Target:** ES2020

## TypeScript Configuration

We use strict TypeScript settings (`strict: true`) to catch potential bugs at compile time. Key settings:

- Strict null checks enabled
- No implicit `any` types
- No unused variables or parameters
- All functions must have explicit return types (unless inferable)
- No implicit returns

See `tsconfig.json` for full configuration.

## Code Formatting

### Prettier

Automatic code formatting using Prettier ensures consistency across the codebase.

**Key settings:**

- Single quotes for strings
- 2-space indentation
- 100-character line width
- Trailing commas disabled
- Unix line endings (LF)

Run formatting:

```bash
npm run format
```

### EditorConfig

EditorConfig settings (`.editorconfig`) ensure consistent editor behavior across different tools and IDEs.

## Linting

### ESLint

We use ESLint with TypeScript support to catch code quality issues.

**Key rules:**

- Prefer `const` over `let` and `var`
- Unused variables must be prefixed with `_`
- `console` calls trigger warnings (use proper logging instead)
- Single quotes required (unless string contains quotes)
- Semicolons required
- Explicit function return types (with exceptions)
- No floating promises - always `await` async operations
- Proper async/await usage

Run linting:

```bash
npm run lint
```

Auto-fix fixable issues:

```bash
npm run lint:fix
```

## Naming Conventions

- **Files:** Use kebab-case for file names (e.g., `user-service.ts`, `auth-controller.ts`)
- **Classes:** Use PascalCase (e.g., `UserService`, `AuthController`)
- **Functions/Variables:** Use camelCase (e.g., `getUserById`, `isActive`)
- **Constants:** Use UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Private members:** Prefix with underscore (e.g., `_internalState`, `_validateInput()`)

## Code Organization

### File Structure

```
src/
├── controllers/     # HTTP request handlers
├── services/       # Business logic
├── models/         # Data models and types
├── middleware/     # Express middleware
├── utils/          # Utility functions
├── types/          # TypeScript type definitions
└── index.ts        # Entry point
```

### Function Length

- Keep functions focused and single-purpose
- Prefer functions under 50 lines
- Extract complex logic into separate functions

### Comments

- Avoid obvious comments
- Explain *why*, not *what* - the code shows what it does
- Use JSDoc for public APIs and complex functions

Example:

```typescript
/**
 * Validates user email format
 * @param email - The email to validate
 * @returns true if valid RFC 5322 format
 */
function validateEmail(email: string): boolean {
  // Implementation...
}
```

## Error Handling

- Always handle promise rejections
- Use typed errors when possible
- Provide meaningful error messages
- Log errors appropriately

## Testing

- Write tests for all public functions
- Use test naming convention: `describe()` for groups, `it()` for specs
- Aim for >80% code coverage
- Test behavior, not implementation details

## Git Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Example:

```
feat(auth): add JWT token refresh mechanism

Adds automatic token refresh when access token expires.
Implements exponential backoff for retry logic.

Closes #123
```

## Pre-commit Hooks

Husky is configured to run linting before commits. Commits with linting errors will be rejected.

Run the pre-commit hook manually:

```bash
npm run lint
```

## Package Standards

- Keep dependencies minimal and well-maintained
- Regularly audit for security vulnerabilities: `npm audit`
- Document why each dependency is needed
- Use exact versions for critical dependencies

## Environment Variables

- Store sensitive data in `.env` files (never commit)
- Document required environment variables in `.env.example`
- Use meaningful variable names: `DATABASE_URL`, not `DB`

## Performance Considerations

- Avoid N+1 queries in loops
- Use async/await properly to prevent blocking
- Cache expensive operations when appropriate
- Profile before optimizing

## Documentation

- Keep README up to date
- Document complex algorithms
- Add examples for public APIs
- Update AGENTS.md when making significant changes

## Review Checklist

Before submitting code for review:

- [ ] Code passes linting (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Tests pass and coverage is adequate
- [ ] TypeScript compiles without errors
- [ ] No console.log statements in production code
- [ ] Commit message follows conventions
- [ ] AGENTS.md updated if applicable
- [ ] No hardcoded secrets or credentials
