# BSA Project Compass

**From Vision to Measurable Impact**

Project Compass is a structured project-alignment and decision-support platform for architecture and design teams. It turns stakeholder aspirations, Owner requirements, institutional strategy and industry intelligence into:

1. a compelling **Win Theme**,
2. approved **Guiding Principles**,
3. actionable, measurable **Design Drivers**,
4. traceable **evidence and decisions**, and
5. ongoing **alignment and performance reporting**.

> **This repository contains only synthetic demonstration data.** The bundled specialty pharmacy project, its owner, people, statements, figures and costs are all fictional. Do not commit real project files, exports or credentials.

---

## Contents

- [Quick start](#quick-start)
- [What's in the app](#whats-in-the-app)
- [Demo mode](#demo-mode)
- [Development](#development)
- [Environment variables](#environment-variables)
- [Secure configuration](#secure-configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- Further documentation: [Architecture & implementation plan](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md)

## Quick start

```bash
npm ci
npm run dev          # http://localhost:5173 — demo mode with synthetic data
```

Requires Node.js 20 or newer (developed on Node 22).

## What's in the app

| # | Section | What it does |
|---|---|---|
| 1 | **Project Overview** | The Win Theme, the alignment chain (sources → decisions), the principles, what needs attention, milestones and activity. |
| 2 | **Project Intelligence** | A source register with attribution, classification, version and extraction status. Statements are recorded verbatim, with interpretation kept separate. Handwritten notes are shown beside their transcription, with uncertain words, attributed corrections, revision history and duplicate-photo flags. |
| 3 | **Alignment Studio** | Group statements into themes; merge, split and move evidence; flag conflicts, themes without Owner support and overlooked requirements; track open questions; promote themes to candidate principles. Also hosts the **Traceability Matrix** (filterable, expandable, CSV/XLSX) and the **Relationship Explorer** (an interactive graph with focus mode and an accessible table alternative). |
| 4 | **Vision & Principles** | Compare Win Theme alternatives side by side. A principle editor provides evidence coverage, a decision-making test, comment threads, governed approval (by the accountable approver), version history with restore, and locking of approved text. |
| 5 | **Design Drivers** | A register with table, card, principle, accountability and phase views, plus a status strip. Approval and performance are tracked separately. Targets are proposed and approved in separate steps. Observed values are recorded with dates. Verification requires evidence, a reviewer and a date. Commitment fields are locked once a driver is approved. |
| 6 | **Decision Lab** | Choosing by Advantages: alternatives, mandatory requirements, factors, attributes, least-preferred baselines, advantages, judged importance with rationale, and paramount anchoring. Importance is plotted against cost, which is kept separate. Informal scoring is labelled separately. Recommendation and approval require two different people, decisions lock once approved, and a PDF decision record can be exported. |
| 7 | **Success Dashboard** | Performance achievement and data completeness are reported separately. Shows at-risk drivers, drivers without owners, targets awaiting approval, milestones, decisions and evidence gaps, filterable by principle, organization, phase, decision status and measurement state. |
| 8 | **Reports** | Alignment Report (PDF), Alignment Presentation (PPTX), Design Driver Register (CSV/XLSX), Traceability Matrix (CSV/XLSX) and Decision Record (PDF). Drafts are labelled; demo exports are watermarked. |
| 9 | **Project Settings** | Project and Owner profile, project-specific terminology, team and roles, milestones, AI policy and audit log. |

The app also has global search (⌘/Ctrl-K), breadcrumbs, a project switcher, a new-project flow, light and dark appearance, and layouts tuned for iPad Pro landscape.

## Demo mode

Demo mode is the default. It is **clearly labelled in the UI** and:

- loads two fictional projects (a specialty pharmacy fulfillment center and a small learning-sector project);
- stores all changes **only in this browser's localStorage**. Nothing is shared with other users, and it is not secure;
- provides a **demo persona switcher** (top right) to exercise each role. The persona switcher is not authentication;
- records **file metadata only**: file contents are never read, stored or uploaded;
- uses a transparent **rule-based assistant**: no AI model, no network calls;
- can be reset from **Project Settings → Reset demo data**.

Useful personas: *Avery Lindqvist* (Project Administrator), *Jordan Okafor* (Editor), *Sam Delacroix* (Contributor), *Dr. Morgan Ellery* and *Priya Ramanathan* (Reviewer / Approver), and *Casey Brandt* (Viewer). Sam is not a member of the second project, which demonstrates project isolation.

Sample workflows to try:

1. **Transcription.** Open *Project Intelligence → SRC-002*, correct ST-008's uncertain word, then verify it.
2. **Themes.** Use the *Alignment Studio* to group the orphaned statement ST-019 into a theme, or run the assistant and accept a suggested link.
3. **Approval.** As *Dr. Morgan Ellery*, approve the Win Theme. Then, as *Jordan Okafor*, see that it is locked and that changing it means opening a revision.
4. **Targets.** As *Jordan*, propose a target for DD-01. As *Morgan*, approve it.
5. **Decision.** As *Morgan*, approve DEC-001 (recommended by Jordan), then export the decision record.
6. **Reports.** Export the Alignment Report and presentation from *Reports*.

## Development

```bash
npm run dev          # Vite dev server
npm run typecheck    # TypeScript project references (app, node, server)
npm test             # Vitest unit tests (domain, exporters, adapters, server API)
npm run build        # Type-check and production build to dist/
npm run preview      # Serve the production build
npm run test:e2e     # Playwright workflows (desktop + iPad Pro landscape)
npm run verify:rls   # PostgreSQL row-level-security checks (needs local PostgreSQL binaries; run as non-root)
npm run check        # typecheck + unit tests + build
```

Source layout (details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)):

```
src/
  domain/        Typed models, zod command contract, command handler (all business rules),
                 permissions, Choosing by Advantages, traceability, metrics, search
  data/          DataAdapter interface; DemoAdapter, RemoteAdapter, auth, config, synthetic seed
  services/ai/   Assistant provider abstraction: rule-based (offline) and server-side AI
  exporters/     CSV, XLSX, PDF and PPTX builders
  components/    Design-system primitives and shared collaboration components
  layout/        Application shell, navigation, search, persona and project switchers
  features/      One folder per primary section
  styles/        Design tokens (light and dark)
supabase/
  migrations/    Postgres schema, RLS policies, storage bucket, audit immutability
  functions/     Edge Function API (Deno) + framework-independent handler with tests
  tests/         RLS verification SQL and Supabase shim
e2e/             Playwright end-to-end workflows
```

## Environment variables

Copy `.env.example` to `.env.local`. Only `VITE_`-prefixed values reach the browser, and **they must never be secrets.**

| Variable | Where | Purpose |
|---|---|---|
| `VITE_DATA_MODE` | browser | `demo` (default) or `supabase` |
| `VITE_SUPABASE_URL` | browser | Supabase project URL (HTTPS) |
| `VITE_SUPABASE_ANON_KEY` | browser | Public anon key. RLS enforces access |
| `VITE_IDENTITY_PROVIDER` | browser | Supabase Auth provider id (default `azure` for Microsoft Entra ID) |
| `VITE_BASE_PATH` | build | Base path for sub-path hosting |
| `ALLOWED_ORIGIN` | Edge Function secret | The single origin allowed by CORS |
| `AI_PROVIDER` | Edge Function secret | `anthropic`, or unset to disable AI |
| `ANTHROPIC_API_KEY` | Edge Function secret | Organization-approved key. **Never** in `VITE_` vars |
| `AI_MODEL` | Edge Function secret | Approved model id |
| `AI_ALLOWED_CONFIDENTIALITY` | Edge Function secret | Comma-separated classifications the provider may receive (default `public`) |

If `VITE_DATA_MODE=supabase` is set but the configuration is incomplete, the app refuses to start and shows an error. It never falls back to demo mode silently.

## Secure configuration

The secure deployment uses Supabase (Postgres, Auth and Storage) with the organization's identity provider. In outline:

1. Create a Supabase project and apply `supabase/migrations` (`supabase db push`).
2. Configure SSO (e.g. Microsoft Entra ID via the `azure` provider, or SAML) and **disable open sign-up**.
3. Pre-register people in `public.people` (email) and grant project membership. Accounts link on first sign-in by verified email.
4. Deploy the API: `supabase functions deploy api`, and set secrets with `supabase secrets set ...`.
5. Build the web app with `VITE_DATA_MODE=supabase` and host it privately behind the organization's access controls.

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model and controls, and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for step-by-step deployment.

## Testing

| Suite | Command | Covers |
|---|---|---|
| Unit (57 tests) | `npm test` | Command validation and permissions, approval locking, version restore, transcription governance, driver verification rules, CBA evaluation, traceability and gaps, dashboard metrics, CSV injection protection, report readiness, demo adapter isolation and concurrency, config, rule-based assistant, server API (auth, conflicts, signed URLs, AI confidentiality filtering, citation sanitization, prompt-injection handling) |
| End-to-end (9 workflows × 2 viewports) | `npm run test:e2e` | Navigation, breadcrumbs and search; source and statement entry with persistence; transcription correction and verification; role enforcement and approval locking; driver verification; Decision Lab approval; real PDF/PPTX/CSV/XLSX downloads; project isolation; Relationship Explorer focus and accessible list. Runs at 1440×900 and iPad Pro 1366×1024 |
| Database | `npm run verify:rls` | 15 checks against real PostgreSQL: project isolation, no direct content writes, audit append-only, at least one administrator, storage path and type constraints, anonymous denial |

## Deployment

- **Local preview:** `npm run build && npm run preview`.
- **Static demonstration:** `.github/workflows/deploy-demo.yml` publishes the *demo-mode* build to GitHub Pages, and only when triggered manually. A public static site is **not** a secure backend and must only ever serve synthetic data.
- **Secure application:** host privately (for example, behind the organization's SSO-protected app hosting, or Azure Static Web Apps or Cloudflare Access with Entra ID) and connect it to the Supabase backend. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Known limitations

- **The secure backend has not been run against a live Supabase project.** The migrations and RLS policies are verified on PostgreSQL 16 with a Supabase shim, and the API handler is unit-tested with an in-memory store. The Deno entry point (`supabase/functions/api/index.ts`), the Supabase Storage policies, and the PKCE sign-in client (`src/data/auth.ts`) still need verification in a provisioned environment. **Do not ingest real confidential content until that verification is complete.**
- **Real file uploads.** In remote mode the API issues signed upload and download URLs, but the browser upload step and document text extraction (PDF, PPTX, DOCX, OCR) are not yet implemented. Statements are entered manually.
- **AI.** The server-side Anthropic adapter is implemented and tested with a fake client, but it has not been called against the live API. Demo mode uses the rule-based assistant only, and the AI tasks are limited to linking, theming, gap and question suggestions. Narrative drafting is not implemented.
- **Concurrency.** The project aggregate uses optimistic concurrency, so simultaneous edits produce a refresh-and-retry conflict rather than a merge. Very large projects may later need normalized tables.
- **Branding.** No official BSA design-system files were provided. The tokens in `src/styles/index.css` are placeholders ready for replacement, and exports use standard fonts.
- **Demo storage.** Data is per-browser and can be cleared. Handwritten-note images are synthetic SVG illustrations.
- **Accessibility.** Keyboard navigation, ARIA tabs, labelled controls and an accessible list alternative to the graph are implemented. A formal WCAG audit has not been performed.
