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
- Further documentation: [BSA brand integration](docs/BRAND.md) · [Owner Workshop Mode](docs/WORKSHOP_MODE.md) · [Architecture & implementation plan](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md)

## Quick start

```bash
npm ci
npm run dev          # http://localhost:5173 — demo mode with synthetic data
```

Requires Node.js 20 or newer (developed on Node 22).

## What's in the app

Compass 2.0 is organized around how a BSA team works with an Owner: **Understand → Interpret → Align**. Advanced tools stay available under *More tools* and are never required.

| Section | What it does |
|---|---|
| **Project Home** | Project identity, the current stage, the latest working vision, principles, unresolved questions, a qualitative readiness checklist, recent meaningful changes and deliverables. No task counters. |
| **01 Understand** | **Evidence** — sources and verbatim statements, attribution, classification, handwritten-note transcription with attributed corrections. **Themes** — group, merge, split and promote themes. **Critical Questions** — open questions, recorded tensions and rules-based prompts for missing perspectives and solution-vs-need language. **What We Heard** — an evidence-linked synthesis (aspirations, themes, tensions, perspectives, priorities) with presentation toggles, team review and an Owner-ready preview with verbatim quotes. |
| **02 Interpret** | **Point of View** — central ambition, opportunity, connecting idea, tensions, distinctiveness, what to keep in mind, and alternative directions with one recommendation; versioned. **Vision** (terminology is configurable, e.g. *Win Theme*) — compare alternatives with governed approval. **Guiding Principles** — wording governance plus *Why it matters* and *Emerging design implications*, kept outside the locked wording, and a rules-based quality review. **Design Opportunities** — non-prescriptive possibilities grouped by principle, linkable to Design Drivers. **What Success Could Look Like** — potential outcomes by category and state, optional possible measures; no invented targets. |
| **03 Align** | Prepare for and hold the Owner conversation: readiness for presenting, past and planned workshops, and the **Owner Workshop** — 16:9 Present and Edit modes, inline wordsmithing with autosave and recovery, undo/redo, review statuses, optional formal adoption of exact wording, facilitator notes, an audience window and a meeting summary PDF. See [docs/WORKSHOP_MODE.md](docs/WORKSHOP_MODE.md). |
| **Reports & Deliverables** | Alignment Report (PDF), Alignment Presentation (PPTX), Design Driver Register (CSV/XLSX), Traceability Matrix (CSV/XLSX) and Decision Record (PDF). Drafts are labelled; demo exports are watermarked. |
| *More tools* | **From Vision to Design** — each principle → opportunities → potential outcomes, with dated evidence of progress. **Evidence Map** — Traceability Matrix and Relationship Explorer. **Design Drivers**, **Decision Lab** (Choosing by Advantages), **Success Dashboard** and **Project Settings**, unchanged from Compass 1.x. |

The **Thinking Partner** drawer in Understand and Interpret runs transparent, rule-based checks (no AI model). Its suggestions change nothing until a reviewer accepts them. Capabilities that need a language model are shown disabled and labelled *Requires an approved AI provider*.

Compass 1.x links (`/intelligence`, `/alignment`, `/vision`) redirect to their new locations.

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

0. **Owner workshop.** Open *Align → Open Owner Workshop*. In the facilitator panel, go to *Session* and *Start session*. Wordsmith GP-03 on the slide, then *Record approval* for Dr. Morgan Ellery. Press **P** to present, open the *Audience window*, and finally end the session and download the meeting summary.
1. **Transcription.** Open *Understand → Evidence → SRC-002*, correct ST-008's uncertain word, then verify it.
2. **What We Heard.** In *Understand → What We Heard*, review the rules-generated item about missing patient voices, link evidence to a new tension, and switch to *Owner-ready preview*.
3. **Thinking Partner.** In *Understand → Critical Questions*, run *Raise critical questions* and accept one — it becomes an open question.
4. **Interpret.** Sharpen the *Point of View*, recommend a direction, add *Why it matters* to a principle, and follow it through *More tools → From Vision to Design*.
5. **Approval.** As *Dr. Morgan Ellery*, approve the Vision. Then, as *Jordan Okafor*, see that it is locked and that changing it means opening a revision.
6. **Targets.** As *Jordan*, propose a target for DD-01. As *Morgan*, approve it.
7. **Decision.** As *Morgan*, approve DEC-001 (recommended by Jordan), then export the decision record.
8. **Reports.** Export the Alignment Report and presentation from *Reports*.

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
| Unit (68 tests) | `npm test` | Command validation and permissions, approval locking, workshop statuses, Owner approval of exact wording, duplicate/delete/merge, autosave version coalescing, meeting summaries, version restore, transcription governance, driver verification rules, CBA evaluation, traceability and gaps, dashboard metrics, CSV injection protection, report readiness, demo adapter isolation and concurrency, config, rule-based assistant, server API (auth, conflicts, signed URLs, AI confidentiality filtering, citation sanitization, prompt-injection handling) |
| End-to-end (42 runs) | `npm run test:e2e` | **Workshop (8 flows at 1920×1080, 1440×900 and iPad Pro):** inline editing with autosave and undo/redo; statuses and Owner approval; revising approved wording; add, duplicate, delete with undo, reorder and merge; Present mode with in-place editing; the audience window following the facilitator; recovery of unsaved edits; the meeting summary PDF; viewer permissions. **Core (9 flows × 2 viewports):** Navigation, breadcrumbs and search; source and statement entry with persistence; transcription correction and verification; role enforcement and approval locking; driver verification; Decision Lab approval; real PDF/PPTX/CSV/XLSX downloads; project isolation; Relationship Explorer focus and accessible list. Runs at 1440×900 and iPad Pro 1366×1024 |
| Database | `npm run verify:rls` | 15 checks against real PostgreSQL: project isolation, no direct content writes, audit append-only, at least one administrator, storage path and type constraints, anonymous denial |

## Deployment

### Publish the updated demo (GitHub Pages)

1. One-time setup: in GitHub open **Settings → Pages**, and under *Build and deployment* set **Source: GitHub Actions**.
2. Open the **Actions** tab, choose **Deploy static demo**, click **Run workflow**, and select the branch to publish (for example `claude/project-compass-v1`, or `main` after merging).
3. When the run finishes, the demo is at `https://<owner>.github.io/bsa-project-compass/` (the URL is shown on the run summary). The workflow builds in demo mode only, with synthetic data.
4. To check locally before publishing: `npm ci && VITE_BASE_PATH=/bsa-project-compass/ npm run build && npx vite preview --base /bsa-project-compass/`.

If the repository is private, GitHub Pages requires a plan that supports Pages for private repositories, and the published site may still be public. Use only synthetic data. For an access-controlled demo, deploy the same `dist/` folder to the organization's private static hosting instead (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

- **Local preview:** `npm run build && npm run preview`.
- **Static demonstration:** `.github/workflows/deploy-demo.yml` publishes the *demo-mode* build to GitHub Pages, and only when triggered manually. A public static site is **not** a secure backend and must only ever serve synthetic data.
- **Secure application:** host privately (for example, behind the organization's SSO-protected app hosting, or Azure Static Web Apps or Cloudflare Access with Entra ID) and connect it to the Supabase backend. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Known limitations

- **The secure backend has not been run against a live Supabase project.** The migrations and RLS policies are verified on PostgreSQL 16 with a Supabase shim, and the API handler is unit-tested with an in-memory store. The Deno entry point (`supabase/functions/api/index.ts`), the Supabase Storage policies, and the PKCE sign-in client (`src/data/auth.ts`) still need verification in a provisioned environment. **Do not ingest real confidential content until that verification is complete.**
- **Real file uploads.** In remote mode the API issues signed upload and download URLs, but the browser upload step and document text extraction (PDF, PPTX, DOCX, OCR) are not yet implemented. Statements are entered manually.
- **AI.** The server-side Anthropic adapter is implemented and tested with a fake client, but it has not been called against the live API. Demo mode uses the rule-based assistant only, and the AI tasks are limited to linking, theming, gap and question suggestions. Narrative drafting is not implemented.
- **Concurrency.** The project aggregate uses optimistic concurrency, so simultaneous edits produce a refresh-and-retry conflict rather than a merge. Very large projects may later need normalized tables.
- **Branding.** The app follows the BSA Brand Style Guide 2026 and the official logo (see [docs/BRAND.md](docs/BRAND.md)). A few items await confirmation by the Visual Brand Manager: the logo red value, on-screen minimum logo sizes and the product-family naming.
- **Demo storage.** Data is per-browser and can be cleared. Handwritten-note images are synthetic SVG illustrations.
- **Accessibility.** Keyboard navigation, ARIA tabs, labelled controls and an accessible list alternative to the graph are implemented. A formal WCAG audit has not been performed.
