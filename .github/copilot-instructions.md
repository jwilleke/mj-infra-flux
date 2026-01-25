# amdWiki AI Coding Agent Instructions

**READ [AGENTS.md](../AGENTS.md) FIRST** - Comprehensive AI agent context for the project.

When running terminal commands, ensure the shell sources ~/.bash_profile or equivalent to include /usr/local/bin in PATH for npm/Node tools.

## Key Documentation

- [AGENTS.md](../AGENTS.md) - AI agent context and project coordination
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development workflow and standards
- [docs/SEMVER.md](../docs/SEMVER.md) - Semantic versioning guidelines

## Architecture Overview

**amdWiki** is a JSPWiki-inspired file-based wiki built with Node.js/Express following a modular manager pattern. Pages are stored as Markdown files with YAML frontmatter.

Key patterns: Manager-based architecture (23 managers), WikiContext for request context, Provider pattern for storage abstraction, WikiDocument DOM pipeline for parsing.

See [AGENTS.md](../AGENTS.md) for detailed architecture patterns and tech stack.


