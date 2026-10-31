# Architecture & Implementation Plan

## 1. Repository assessment (starting point)

The repository was empty: there was no existing code, no design-system files and no assets. Everything here was built from scratch. BSA brand assets were not provided, so the design tokens are neutral placeholders kept in one file.

## 2. Architecture

```
            ┌──────────────────────────────── Browser (React SPA) ─────────────────────────────┐
            │ features/*  ──► app/project.tsx (React Query)  ──►  DataAdapter                   │
            │   UI checks capabilities via domain/permissions (convenience only)               │
            │                                         │                                        │
            │                    ┌────────────────────┴───────────────────┐                    │
            │             DemoAdapter                               RemoteAdapter              │
            │   applyCommand() locally on synthetic        HTTPS + bearer token (PKCE SSO)     │
            │   data in localStorage (NOT secure)                        │                     │
            └────────────────────────────────────────────────────────────┼─────────────────────┘
                                                                         ▼
                                    Supabase Edge Function  /functions/v1/api   (Deno)
                                    verify JWT → person → membership → applyCommand()
                                    (same domain code) → optimistic save → audit
                                                                         │ service role
                                                                         ▼
                              Postgres: projects, project_members, project_state(jsonb),
                              audit_events (append-only), source_files, ai_requests — all RLS
                              Storage: private bucket project-sources/<project>/<source>/…
                              AI provider (server-side only, policy-filtered, fixed tasks)
```

**Key decision: a command-based domain core.** Every write is a typed `Command`, validated by zod (`src/domain/schemas.ts`) and applied by a single pure handler, `applyCommand()` (`src/domain/commands.ts`). That handler enforces permissions and all governance rules: approval locks, verification evidence, CBA completeness, separation of recommender and approver, and target approval. The same code runs in the browser in demo mode and on the server in secure mode, so demo behavior matches production behavior and the rules cannot drift apart.

**Persistence.** Each project's aggregate is stored as a single `jsonb` document with a revision number for optimistic concurrency. Membership lives in a relational table and is the authorization source of truth; it is also mirrored into the aggregate. Browsers may *read* their projects through RLS but cannot write content tables at all. This prevents bypassing domain rules through the auto-generated REST API.

**Traceability graph.** A single many-to-many `Relationship` collection connects statements, themes, Win Themes, principles, drivers and decisions. Each relationship carries type, explanation, confidence, origin (human, AI or rules), proposer, reviewer, status and dates. The matrix, explorer, evidence panels, gap reports and exports are all derived from it.

## 3. File architecture

| Path | Responsibility |
|---|---|
| `src/domain/types.ts` | Domain model (projects, sources, statements, relationships, themes, Win Themes, principles, drivers, decisions, audit) |
| `src/domain/schemas.ts` | zod command contract and input limits (typed API contract) |
| `src/domain/commands.ts` | Command handler: authorization, business rules, versioning, audit |
| `src/domain/permissions.ts` | Role → capability matrix (mirrored by RLS) |
| `src/domain/cba.ts` | Choosing by Advantages validation and totals; informal scores kept separate |
| `src/domain/drivers.ts` | Combined status, completeness, measurement state, lock fingerprint |
| `src/domain/traceability.ts` | Evidence resolution, gap analysis, matrix rows, graph and focus |
| `src/domain/metrics.ts` | Dashboard model and filters |
| `src/data/*` | Adapters (demo/remote), PKCE auth, config, synthetic seed |
| `src/services/ai/*` | Provider interface, rule-based provider, remote AI provider, output schema |
| `src/exporters/*` | CSV (injection-safe), XLSX, PDF report and decision record, PPTX decks (Owner presentation, driver briefing), Word/PDF documents from a shared outline (`outline.ts`, `documents.ts`, `deliverables.ts`) |
| `src/components/*` | Design-system primitives, dialogs and confirmations, evidence, comments, versions |
| `src/layout/AppShell.tsx` | Navigation (Home · Understand · Interpret · Align · Reports · More tools), breadcrumbs, search, project and persona switchers, demo banner |
| `src/layout/StageLayout.tsx`, `stages.tsx` | Stage header, step navigation and Thinking Partner drawer for Understand, Interpret and More tools |
| `src/features/*` | Pages for each primary section (`home`, `understand`, `interpret`, `align`, `more`, plus the Compass 1.x feature folders they reuse) |
| `src/features/workshop/*` | Owner Workshop: slide deck, inline editing with autosave and recovery, undo/redo, facilitator panel, dialogs, audience window |
| `src/domain/workshop.ts`, `wording.ts`, `normalize.ts` | Meeting summary model, canonical wording, data upgrades |
| `src/domain/alignment.ts` | Owner alignment status, readiness for an aligned direction, direction snapshots |
| `supabase/migrations/*` | Schema, RLS, storage bucket, append-only audit, admin invariant |
| `supabase/functions/_shared/api.ts` | Framework-independent API handler (unit-tested) |
| `supabase/functions/api/index.ts` | Deno entry: token verification, CORS, Postgres store, AI adapter |

## 4. Major dependencies

| Purpose | Library | Notes |
|---|---|---|
| UI | React 19, React Router 8, Tailwind CSS 4 | Tokens in `src/styles/index.css` |
| Server state | TanStack Query 5 | Adapter calls, cache and conflict refresh |
| Validation | zod 4 | Shared client and server contract |
| Accessible primitives | Radix Dialog, Dropdown Menu | Focus management, keyboard support |
| Graph | @xyflow/react 12 | Relationship Explorer |
| Exports | jsPDF + jspdf-autotable, pptxgenjs, write-excel-file | Lazy-loaded. `write-excel-file` was chosen over exceljs, which has vulnerable transitive dependencies |
| Icons and fonts | lucide-react, Inter and JetBrains Mono (self-hosted via Fontsource) | No external CDNs |
| Tests | Vitest, Testing Library, Playwright 1.63 | |

Advisory: `pptxgenjs` depends on `image-size`, which has denial-of-service advisories for crafted images. The app never passes images (and therefore never untrusted images) to pptxgenjs.

## 5. Staged implementation status

| Stage | Scope | Status | Verification |
|---|---|---|---|
| 1 Foundation | Scaffolding, tokens, shell, navigation, typed models, synthetic data, overview | **Complete** | typecheck, build, route smoke test with no console errors or overflow at 1440 and 1366 px |
| 2 Source Intelligence | Sources, manual statements, file metadata validation, evidence viewer, transcription verification, traceability | **Complete** (demo) | unit and e2e |
| 3 Alignment & Vision | Themes (group, merge, split, move, promote), matrix, explorer, Win Theme and principle editors, review and versioning | **Complete** | unit and e2e |
| 4 Design Drivers | Register views, details, targets, owners, status, verification | **Complete** | unit and e2e |
| 5 Decision Lab | CBA, alternatives, cost separation, informal scoring, history, approvals | **Complete** | unit and e2e |
| 6 Dashboards & Reporting | Dashboard, filters, PDF, PPTX, CSV/XLSX | **Complete** | unit and e2e downloads; PDF and PPTX rendered and inspected |
| 7 Secure backend | Schema, RLS, storage, audit, API, auth client, migration path | **Implemented; partially verified** | RLS on PostgreSQL 16 (15 checks); API handler unit tests. Not yet run on a live Supabase project |
| 8 AI & hardening | Provider interface, structured output validation, suggestions with human review, confidentiality filtering, injection handling | **Implemented; partially verified** | unit tests with a fake provider; live provider not exercised |

### Priority update: Owner Alignment Workshop Mode (complete in demo mode)

Workshop Mode became the top priority after Stage 6. It reuses the existing Win Theme and principle model, versioning, approval records, evidence panel, comments, confirmations and PDF builder. The domain additions are:

- review statuses `needs_refinement` and `not_adopted` (`in_review` is shown as *Discussing*);
- `framework.setReviewStatus | duplicate | delete | undelete`, `principle.merge`, and `workshop.create | update | setNote | start | end`;
- Owner approval recorded on the approver's behalf, with exact-wording verification (`expectedWording`, `onBehalfOf`, `sessionId`) and an approval record holding `wording` and `recordedBy`;
- coalesced autosave versions, recoverable trash, workshop sessions with an automatic change log, `normalizeProjectData` for older stored data, and live cross-window updates (`DataAdapter.subscribe`).

Verification: 11 domain tests, plus 8 end-to-end flows at 1920×1080, 1440×900 and iPad Pro. See [WORKSHOP_MODE.md](WORKSHOP_MODE.md).

### Compass 2.0 Stage 2: Understand → Interpret (implemented for review)

New navigation and Project Home; What We Heard, Point of View, principle support text, Design Opportunities, Potential Outcomes and From Vision to Design; rules-based Thinking Partner checks; and legacy URL redirects. See [COMPASS_2_STAGE2.md](COMPASS_2_STAGE2.md).

### Compass 2.0 Stage 3: Owner Alignment and Deliverables (implemented)

Four-chapter Owner presentation, Owner response capture (`AlignmentResponse`), immutable direction versions (`DirectionSnapshot`) with an aligned state that refuses unreviewed items, the Align stage, and the deliverables (editable PPTX, Word and PDF documents from one outline). See [COMPASS_2_STAGE3.md](COMPASS_2_STAGE3.md).

### Revised roadmap (recommended order)

1. **Secure backend verification (Stage 7), now the gate for real Owner workshops.** Provision Supabase staging, run the migrations and RLS checks there, deploy the API, configure Entra ID SSO, and run Workshop Mode end to end in remote mode. Add server push (Supabase Realtime) so audience windows update without polling.
2. **Workshop refinements from first use:** printable handout of adopted wording; optional per-slide speaker notes in the audience-free view; a presenter timer; presentation clicker testing on Windows.
3. **Design Driver refinements:** link drivers to workshop outcomes, and a driver review deck that reuses the slide stage.
4. Upload pipeline: signed-URL uploads, virus scanning and text extraction feeding *proposed* statements.
5. Advanced dashboards and AI analysis (narrative drafting, evaluation), then further Decision Lab work. These were deliberately deferred behind Workshop Mode.
6. Accessibility audit (WCAG 2.2 AA) and BSA brand token substitution.

### Remaining work (prior plan, superseded by the revised roadmap above)

1. Provision Supabase staging. Run migrations, deploy the function, configure Entra ID SSO, and run an end-to-end smoke test in remote mode.
2. Browser upload through signed URLs, a virus-scanning hook, and server-side text extraction (PDF, PPTX, DOCX; OCR for photographs) feeding *proposed* statements.
3. An `npm run migrate:demo` tool that imports a demo or sandbox aggregate into a real project, for authorized administrators only.
4. AI narrative drafting (report narrative) with draft labelling, then AI evaluation against curated test sets.
5. A formal accessibility audit (WCAG 2.2 AA) and BSA brand token substitution once design-system files are provided.
