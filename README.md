# Comply

AI-powered regulatory compliance automation for cloud infrastructure. Comply scans Infrastructure-as-Code repositories, detects regulatory violations, generates remediation plans, produces production-ready code fixes, and opens GitHub pull requests — all orchestrated by a multi-agent system built on LangGraph.

## Supported Frameworks

DORA | GDPR | ISO 27001 | SOC 2 | HIPAA | PCI-DSS

## Supported IaC Formats

Terraform | Kubernetes | CloudFormation (AWS, Azure, GCP)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                         │
│              (React 19 / TypeScript / Tailwind CSS)              │
│                   SSE EventSource Streaming                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │  REST + SSE
┌──────────────────────────▼──────────────────────────────────────┐
│                      FastAPI Backend                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │               LangGraph Orchestration                      │  │
│  │                                                            │  │
│  │  Scan Pipeline:                                            │  │
│  │    [Auditor] ──► [Strategist] ──► END                      │  │
│  │                                                            │  │
│  │  PR Pipeline (with QA loop):                               │  │
│  │    [Code Generator] ──► [QA Re-scan] ──► Router            │  │
│  │         ▲                                  │               │  │
│  │         │              ┌───────────────────┤               │  │
│  │         │              ▼                   ▼               │  │
│  │    [Strategist]    (violations?)       (clean/3x)          │  │
│  │     (replan)           │                   │               │  │
│  │         ▲              │                   ▼               │  │
│  │         └──────────────┘                 [END]             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐   │
│  │  GitHub   │  │  Stripe  │  │ Firebase │  │ Regulation    │   │
│  │  Service  │  │ Billing  │  │   Auth   │  │ Service       │   │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  SQLite (local/dev)      │
              │  Firestore (enterprise)  │
              └─────────────────────────┘
```

## Agentic Orchestration

The core of Comply is a multi-agent system with four specialized agents, composed into two LangGraph state-machine pipelines:

### Agents

| Agent | Role | Output |
|-------|------|--------|
| **Auditor** | Scans repo files against compliance rulesets | Structured JSON violations (rule_id, severity, file, line, regulation_ref) |
| **Strategist** | Generates remediation plans enriched with regulatory article context | Plain-language plans with regulation citations, priority, effort estimates |
| **Code Generator** | Applies approved plans to produce corrected files | Production-ready code preserving existing functionality |
| **Legal Advisor** | Chat-based regulatory Q&A | Plain-language explanations (jargon-free) |

### Pipeline 1 — Scan

Linear pipeline: **Auditor** detects violations, **Strategist** produces remediation plans.

### Pipeline 2 — PR Creation (Iterative QA Loop)

The PR pipeline generates code fixes and validates them through an automated QA loop:

1. **Code Generator** applies approved remediation plans
2. **QA Re-scan** runs the Auditor against the corrected files
3. **Conditional Router** decides:
   - Clean scan or 3 iterations reached: create PR and finish
   - New violations found: **Strategist** replans, loop back to Code Generator

Key design decisions:
- **Immutable originals** — original repo files and approved plans never mutate; working copies evolve per iteration
- **Iteration cap** (max 3 QA cycles) prevents infinite loops
- **Full QA history** stored per iteration for compliance audit trail
- **Smart fix merging** preserves original content through iterations

### Real-Time Streaming

All long-running operations stream agent progress via SSE with typed events (`agent_start`, `reasoning_chunk`, `violation_found`, `plan_ready`, `agent_complete`, `qa_violations`, `pr_complete`). The frontend renders live agent reasoning traces as they work.

### Audit Trail

Every agent decision is recorded in a `reasoning_log` table — agent name, action, output, and full streaming text — enabling full auditability of the remediation process.

## Tech Stack

### Backend
- **Runtime:** Python 3.12
- **Framework:** FastAPI
- **Orchestration:** LangGraph / LangChain Core
- **LLM:** Google Gemini 2.0 Flash
- **Database:** SQLite (WAL mode) / Firebase Firestore
- **Auth:** Firebase Admin SDK
- **Integrations:** PyGithub, Stripe, Google Cloud Storage

### Frontend
- **Framework:** Next.js 16 / React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Auth:** Firebase SDK
- **Payments:** Stripe.js

### Infrastructure
- **Containerization:** Docker / Docker Compose
- **Database:** SQLite (dev/self-hosted), Firestore (SaaS)

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker & Docker Compose (optional)

### Quick Start with Docker

```bash
docker compose up --build
```

Backend available at `http://localhost:8000`, frontend at `http://localhost:3000`.

### Manual Setup

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Configure your environment variables
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd comply-landing
npm install
cp .env.example .env.local  # Configure your environment variables
npm run dev
```

### Environment Variables

The backend requires the following environment variables:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `DATABASE_URL` | SQLite database path |

## Project Structure

```
Comply/
├── backend/
│   └── app/
│       ├── agents/           # LLM agent implementations
│       │   ├── auditor.py
│       │   ├── strategist.py
│       │   ├── code_generator.py
│       │   ├── legal_advisor.py
│       │   └── gemini_client.py
│       ├── graphs/           # LangGraph pipeline definitions
│       │   ├── scan_pipeline.py
│       │   └── pr_pipeline.py
│       ├── routes/           # FastAPI route handlers
│       ├── services/         # External service integrations
│       ├── models/           # Pydantic schemas
│       ├── core/             # Configuration
│       └── database.py       # SQLite schema
├── comply-landing/           # Next.js frontend
├── open-legal-compliance-mcp/# MCP server for legal API access
├── docker-compose.yml
└── docs/
```

## Open Legal Compliance MCP Server

Comply includes an MCP (Model Context Protocol) server that provides access to legal and regulatory data from multiple jurisdictions — US federal/state law, EU regulations, UK legislation, Canadian law, SEC filings, and more. See [`open-legal-compliance-mcp/README.md`](open-legal-compliance-mcp/README.md) for details.

## License

Proprietary. All rights reserved.
