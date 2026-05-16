---
name: github-docs
description: "Use for GitHub workflow tasks and project documentation. Triggers: creating PRs, writing commit messages, updating README, writing AGENTS.md or CLAUDE.md, documenting architecture decisions, writing changelogs, creating GitHub issues, writing contribution guides, documenting API endpoints or modules."
metadata:
  author: la-sentadita-hub
  version: "1.0.0"
---

# GitHub & Documentation Skill — La Sentadita Hub

## Repository

- **Repo:** `jesuschristiandev/la_sentadita_hub`
- **Main branch:** `main`
- **Feature branch pattern:** `claude/<feature-slug>-<id>` or `feat/<slug>`
- **Current dev branch:** `claude/fullstack-skills-security-TFlru`

## Commit Message Convention

Follow **Conventional Commits**:

```
<type>(<scope>): <short description in Spanish or English>

[optional body]
[optional footer: closes #123]
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `security`

Scopes (match project modules): `auth`, `employees`, `schedule`, `shifts`, `notifications`, `ui`, `db`, `api`, `config`

Examples:
```
feat(schedule): agregar validación de turnos solapados
fix(auth): corregir redirección después de login
security(db): habilitar RLS en tabla de empleados
test(schedule): agregar tests para cálculo de horas semanales
```

**Rules:**
- Subject ≤ 72 characters
- Subject in imperative mood ("add feature", not "added feature")
- No period at end of subject
- Body explains WHY, not WHAT (the diff shows WHAT)

## PR Description Template

```markdown
## ¿Qué cambia?
<!-- 2-3 bullets sobre los cambios principales -->

## ¿Por qué?
<!-- Contexto del problema o feature -->

## Cómo probar
- [ ] `pnpm test:unit` pasa
- [ ] `pnpm test:vitest` pasa
- [ ] `pnpm lint` sin errores
- [ ] Probado en el navegador: <describe el flujo>

## Screenshots (si aplica)
```

## AGENTS.md Maintenance

The project root has `AGENTS.md` — keep it current when:
- Adding new modules or domains
- Changing the tech stack
- Adding new conventions or constraints
- Modifying the DB schema significantly

AGENTS.md structure for this project:
```markdown
# La Sentadita Hub — Agent Context

## Project Overview
[Brief description]

## Stack
[Current stack with versions]

## Module Structure
[Domain modules and their responsibilities]

## Key Conventions
[Coding conventions agents must follow]

## Database Schema Overview
[Tables, relationships, RLS policies]
```

## README Maintenance

- Keep setup instructions current (node version, pnpm version, env vars needed).
- Link to `docs/` for deeper documentation.
- Don't duplicate content from AGENTS.md in README.

## Documentation in `docs/`

Use `docs/` for:
- Architecture decision records (ADRs): `docs/adr/NNN-decision-title.md`
- Module documentation: `docs/modules/<module-name>.md`
- API documentation: `docs/api/<endpoint-group>.md`

ADR template:
```markdown
# ADR-001: [Decision Title]

## Status
Accepted | Deprecated | Superseded by ADR-XXX

## Context
[Why this decision was needed]

## Decision
[What was decided]

## Consequences
[Trade-offs and implications]
```

## GitHub Issues

When creating issues:
- Title: concise, actionable (verb + object)
- Labels: `bug`, `feature`, `security`, `performance`, `docs`, `chore`
- Include steps to reproduce for bugs
- Include acceptance criteria for features

## Git Workflow

```bash
# Start feature
git checkout -b feat/my-feature main

# Commit with conventional commits
git add -p  # Stage hunks, not whole files
git commit -m "feat(scope): description"

# Push
git push -u origin feat/my-feature

# After PR merge, clean up
git checkout main && git pull && git branch -d feat/my-feature
```

**Never:**
- Force push to `main`
- Commit secrets or `.env` files
- Merge without passing CI
- Skip the PR review process for non-trivial changes
