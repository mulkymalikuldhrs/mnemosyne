# Contributing to Nanggroe IoT

Thank you for your interest in contributing to **Nanggroe IoT** — the Modular IoT & Robotics Platform! We welcome contributions from developers, roboticists, and AI enthusiasts of all skill levels.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Code Style & Guidelines](#code-style--guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)
- [Contact](#contact)

## Code of Conduct

Be respectful, inclusive, and constructive. We are building robotics software for everyone, and every contributor deserves to feel welcome.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nanggroe-iot.git
   cd nanggroe-iot
   ```
3. **Install** dependencies:
   ```bash
   bun install
   ```
4. **Set up** your environment:
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```
5. **Initialize** the database:
   ```bash
   bun run db:push
   bun run db:generate
   ```
6. **Start** the development server:
   ```bash
   bun run dev
   ```

## How to Contribute

### Ways to Contribute

- **Bug fixes** — Find and fix issues in existing code
- **Feature development** — Add new capabilities to the platform
- **Hardware adapters** — Write HAL adapters for new devices (sensors, controllers, etc.)
- **Robot templates** — Create project templates for new robot types
- **Documentation** — Improve guides, API docs, and inline comments
- **Testing** — Write and improve tests for better reliability
- **Translations** — Help make Nanggroe IoT accessible in more languages

### Suggested Workflow

1. Check existing [Issues](https://github.com/mulkymalikuldhrs/nanggroe-iot/issues) for something to work on
2. If no issue exists, create one to discuss your proposed change
3. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. Make your changes with clear, well-documented code
5. Test your changes thoroughly
6. Submit a Pull Request

## Development Setup

### Prerequisites

- **Bun** runtime (v1.3+)
- **Node.js** (v18+, for compatibility)
- **Git** for version control

### Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: Prisma ORM with SQLite
- **State**: Zustand (client) + TanStack Query (server)

### Useful Commands

| Command | Description |
|---|---|
| `bun run dev` | Start development server |
| `bun run lint` | Run ESLint checks |
| `bun run db:push` | Push schema changes to database |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:migrate` | Run database migrations |
| `bun run db:reset` | Reset database |

## Code Style & Guidelines

- **TypeScript everywhere** — No plain JS files; use strict typing
- **ES6+ imports** — Use `import`/`export` syntax consistently
- **shadcn/ui first** — Use existing UI components before building custom ones
- **Tailwind classes** — Prefer utility classes over custom CSS
- **Prisma schema** — All database models go in `prisma/schema.prisma`; primitive types cannot be lists
- **API routes** — Use Next.js API routes (not server actions)
- **Client/Server boundary** — Mark client components with `'use client'`

### File Organization

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/       # React components
│   └── ui/           # shadcn/ui base components (do not modify directly)
├── lib/              # Utility functions and shared logic
├── hooks/            # Custom React hooks
├── stores/           # Zustand stores
└── types/            # TypeScript type definitions
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description

[optional body]
```

### Types

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons) |
| `refactor` | Code refactoring without behavior change |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Build, CI, or tooling changes |

### Examples

```
feat(hal): add BME280 temperature/humidity sensor adapter
fix(mission): resolve waypoint calculation overflow on large areas
docs(api): update telemetry endpoint documentation
refactor(agents): simplify Hermes command dispatcher
```

## Pull Request Process

1. **One feature per PR** — Keep PRs focused and reviewable
2. **Update documentation** — If your change affects behavior, update relevant docs
3. **Add to CHANGELOG** — Notable changes should be documented (when applicable)
4. **Lint passes** — Run `bun run lint` and fix any issues before submitting
5. **Describe your change** — Fill out the PR template with:
   - What the change does
   - Why it's needed
   - How to test it
   - Any screenshots (for UI changes)

### PR Review

- Maintainers will review your PR within a reasonable timeframe
- Address review feedback by pushing additional commits
- Once approved, a maintainer will merge your PR

## Reporting Bugs

1. Check if the bug is already reported in [Issues](https://github.com/mulkymalikuldhrs/nanggroe-iot/issues)
2. If not, create a new issue with:
   - **Clear title** summarizing the problem
   - **Steps to reproduce** the bug
   - **Expected behavior** vs **actual behavior**
   - **Environment details** (OS, Bun version, browser)
   - **Screenshots or logs** if applicable

## Feature Requests

1. Open a [new issue](https://github.com/mulkymalikuldhrs/nanggroe-iot/issues/new) with the label `enhancement`
2. Describe the feature and the use case it solves
3. Explain why it fits the Nanggroe IoT platform vision
4. Optionally, propose an implementation approach

## Contact

- **Creator & Lead Developer**: Mulky Malikul Dhaher — mulkymalikuldhaher@email.com
- **Issues**: [GitHub Issues](https://github.com/mulkymalikuldhrs/nanggroe-iot/issues)

---

*Thank you for helping build the future of autonomous robotics with Nanggroe IoT!*
