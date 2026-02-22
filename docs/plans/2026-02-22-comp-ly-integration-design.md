# Comp.ly Integration Design

**Date:** 2026-02-22
**Status:** Approved

## Overview

Merge the Comp.ly repository (documentation compliance automation by Vrun) into the existing Comply project (code infrastructure compliance). The result is a unified platform that handles both code scanning and document compliance analysis.

## Approach

Copy & adapt (Approach A): merge all code into the existing backend (`backend/`) and frontend (`comply-landing/`) codebases. Single deployment, single app.

## Database Strategy

- **SQLite** (existing): scans, violations, remediation plans, approved fixes, QA results, chat messages, GitHub tokens
- **Firestore** (from Comp.ly): consultancies, workspaces, documents, workspace-scoped integrations

## Backend Integration

### New Routers

| Router | Endpoints |
|--------|-----------|
| `consultancies.py` | `POST /api/v1/consultancies`, `GET /api/v1/consultancies/{id}` |
| `workspaces.py` | `GET/POST /api/v1/workspaces`, `GET /api/v1/workspaces/{id}` |
| `documents.py` | `POST /api/v1/workspaces/{id}/documents/analyze`, `GET /api/v1/workspaces/{id}/documents` |
| `workspace_scans.py` | `POST /api/v1/workspaces/{id}/scans`, `GET /api/v1/workspaces/{id}/scans/{scanId}` |
| `plans.py` | `POST .../plans/{planId}/approve` |

### New Core Modules

- `encryption.py` — Fernet encryption for GitHub tokens
- Firebase Admin init merged with existing
- Firestore client initialization

### Legal MCP Server

Copy `open-legal-compliance-mcp/` as standalone Node.js service.

## Frontend Integration

### New Pages

| Page | Purpose |
|------|---------|
| `/dashboard/workspaces` | List workspaces |
| `/dashboard/workspaces/new` | Create workspace |
| `/dashboard/workspaces/[id]` | Workspace detail (docs + scans) |
| `/dashboard/workspaces/[id]/scans/[scanId]` | Workspace scan results |

### New Libraries

- `firestore.ts` — Firestore CRUD helpers
- `storage.ts` — Firebase Storage upload/delete
- API client functions for new endpoints

### Landing Page Updates

- HeroSection: add documentation compliance messaging
- HowItWorksSection: add workspace/document flow

## Auth Reconciliation

Both use Firebase Auth. Keep existing `security.py` middleware. Adapt Comp.ly's `CurrentUser` dependency to add `consultancyId` lookup from Firestore.

## Data Flow

```
User → Dashboard
  ├── Code Scan (existing, SQLite)
  │   └── Select repo → Scan → Violations → Fix → PR
  └── Workspace (new, Firestore)
      ├── Create/Join Consultancy
      ├── Create Workspace (client, frameworks, cloud)
      ├── Connect GitHub → Scan repos
      └── Upload Documents → Analyze against regulations
```
