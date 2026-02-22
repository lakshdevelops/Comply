# Comply Implementation Design

**Date:** 2026-02-21
**Status:** Approved

## Agents (4 real, 1 reused)

| Agent | LLM? | Purpose |
|-------|-------|---------|
| Auditor | Yes | Scans files against ruleset, outputs violations |
| Strategist | Yes | Enriches violations with regulatory context, outputs remediation plans |
| Code Generator | Yes | Produces production-ready fixes for approved plans |
| Legal Advisor | Yes | On-demand regulation explainer |
| QA step | Auditor reused | Re-runs Auditor on generated code to catch regressions |
| PR creation | No — service function | GitHub API calls to branch, commit, open PR |

## Tech Decisions

| Decision | Choice |
|----------|--------|
| LLM | Gemini Python SDK (`google-generativeai`) |
| Repo access | GitHub API only, no cloning |
| File scope | Per-file analysis (cross-file limitation documented) |
| Orchestration | LangGraph StateGraph (scan pipeline + PR pipeline) |
| State persistence | SQLite |
| Regulatory data | Static JSON files on disk |
| GitHub auth | OAuth via NextAuth GitHub provider |
| Dashboard | New pages in existing Next.js app |
| Demo data | Sample Terraform/K8s files with intentional violations |
| Containerization | Docker Compose |

## Backend Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app
│   ├── config.py                # Env var settings
│   ├── database.py              # SQLite setup
│   ├── models/
│   │   ├── schemas.py           # Pydantic models
│   │   └── db_models.py         # SQLite table definitions
│   ├── agents/
│   │   ├── gemini_client.py     # Gemini SDK wrapper
│   │   ├── auditor.py           # Auditor prompt + invocation
│   │   ├── strategist.py        # Strategist prompt + invocation
│   │   ├── code_generator.py    # Code gen prompt + invocation
│   │   └── legal_advisor.py     # Legal advisor prompt + invocation
│   ├── graphs/
│   │   ├── scan_pipeline.py     # Auditor → Strategist
│   │   └── pr_pipeline.py       # CodeGen → QA (Auditor) → loop/PR
│   ├── services/
│   │   ├── github_service.py    # File reading + PR creation via API
│   │   └── regulation_service.py
│   └── routes/
│       ├── scan.py              # POST /scan
│       ├── fixes.py             # POST /approve, POST /create-prs
│       └── legal.py             # POST /explain
├── data/
│   ├── rules.json
│   └── regulatory_texts.json
└── requirements.txt
```

## Frontend (New Dashboard Pages)

```
src/app/dashboard/
├── page.tsx                     # Repo connect + scan history
├── scan/[id]/page.tsx           # Violations + remediation plans
└── components/
    ├── RepoConnect.tsx
    ├── ViolationCard.tsx
    ├── ScanProgress.tsx
    └── PrStatus.tsx
```

## Pipelines

**Scan (automated):** Auditor → Strategist → save to SQLite → display on dashboard

**PR (user-triggered):** Code Generator → QA (Auditor reuse, max 3 loops) → PR creation via GitHub API

## Known Limitations

1. Per-file analysis — no cross-file violation detection
2. Gemini SDK — agents can't autonomously explore repos (upgrade path: Gemini CLI)
3. No continuous monitoring webhook (future iteration)
4. No PDF report export (future iteration)
