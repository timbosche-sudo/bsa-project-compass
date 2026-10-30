# Project Compass 2.0 — Stage 1 Assessment

**Status:** Stage 1 (audit and experience architecture) complete. No application code has been changed.

**Recoverable checkpoint:** branch `backup/pre-compass-2.0` (pushed to GitHub) at commit `28c805d`. A local tag, `checkpoint/pre-compass-2.0`, exists at the same commit; the tag push was refused by the environment's git proxy, so the branch is the recoverable point.

**Working tree at assessment:** clean, with no uncommitted work.

---

## A. Existing application assessment

### What has been built

Project Compass is a React 19 + TypeScript single-page app of about 15,300 lines of application code. The codebase is organized around a **pure domain core**:

- 69 typed, zod-validated commands;
- one command handler that enforces permissions and governance rules;
- traceability, Choosing by Advantages, metrics and meeting-summary logic.

Behind that core sits a `DataAdapter` with a working demo implementation and a written-but-unverified secure (Supabase) implementation. The UI applies the BSA brand (Lato, palette, official logo, light and dark appearance).

| Area | What exists | State |
|---|---|---|
| **Navigation** | 10 items: Overview, Project Intelligence, Alignment Studio, Vision & Principles, Owner Workshop, Design Drivers, Decision Lab, Success Dashboard, Reports, Settings. Also ⌘K search, breadcrumbs, project switcher. | Functional |
| **Project Intelligence** | Source register (12 source types, confidentiality, version, extraction status); verbatim statements with locator, speaker, kind (aspiration / requirement / non-negotiable / observation / question), explicit criticality, confidence; interpretation stored **separately** from wording; handwritten-note transcription beside the image, with uncertain words, attributed corrections, revision history and duplicate-photo flags. | Functional (demo). **File contents are never stored**: metadata only, and no text extraction. |
| **Alignment Studio** | Themes (group, merge, split, move evidence, archive, promote to principle); flags for conflicts, themes without Owner support, requirements not in the framework, and Owner requirements not raised in workshops; open questions; Traceability Matrix (filter, expand, CSV/XLSX); Relationship Explorer (React Flow graph, focus mode, accessible list). | Functional |
| **Vision & Principles** | Win Theme alternatives side by side; principles with title, statement, intent and category; evidence coverage; comments; version history with restore; accountable approver; governed approval that locks approved text. | Functional |
| **Owner Workshop** | 16:9 Present and Edit modes, inline wordsmithing with autosave and draft recovery, undo/redo, add/duplicate/delete (recoverable)/merge/reorder, review statuses, Owner approval of exact wording, sessions with attendees, notes, actions and an automatic change log, an audience window, and a meeting summary with PDF. | Functional (demo) |
| **Design Drivers** | Full register (table, cards, groupings); separate approval and performance status; target proposal and approval; observations; evidence-based verification; completeness; version history. | Functional, but **heavy for visioning**: measurement fields dominate. |
| **Decision Lab** | Choosing by Advantages with mandatory requirements, factors, attributes, advantages, importance with rationale, cost kept separate, informal scores kept separate, recommender/approver separation, decision record PDF. | Functional |
| **Success Dashboard** | Achievement shown separately from data completeness, filters, gaps, milestones. | Functional, but performance-oriented. |
| **Reports** | Alignment Report PDF; Alignment Presentation PPTX; Driver Register CSV/XLSX; Traceability CSV/XLSX; Decision Record PDF; Workshop Summary PDF. | See export reliability below. |
| **Settings** | Profile, terminology, team and roles, milestones, AI policy, audit log, demo reset. | Functional |
| **Assistant** | Rule-based suggestions (term overlap, gaps, validation questions) as *pending* proposals that need human acceptance. | Functional, but **no AI model** is used. |

### Functional vs. simulated or incomplete

| Capability | Reality |
|---|---|
| Persistence | **Browser localStorage only** (demo adapter). It survives reloads and is shared across windows of the same browser. Nothing is shared between users or devices. Stored data from earlier versions is upgraded by `normalizeProjectData` (additive). |
| Authentication | **None in demo.** A *persona switcher* demonstrates roles; it is explicitly labelled as not authentication. A Supabase PKCE sign-in client exists but has **never run** against a provisioned project. |
| Authorization | The role/capability rules are real and unit-tested. In demo mode they run **in the browser**, so they illustrate the rules but provide no security. On the server path they would run in the Edge Function behind Postgres RLS: 15 policy checks pass on PostgreSQL 16, but this is **not deployed**. |
| AI | **No model is called anywhere.** `assistProviderFor()` always returns the rules provider in demo. A server-side Anthropic adapter, prompt-injection handling and citation sanitization are written and unit-tested with a fake model, but have **never executed** against a real provider. No secrets are in client code, and no project data leaves the browser. |
| File handling | Upload captures name, type and size only. Signed-URL storage endpoints exist server-side but there is no browser upload and no PDF/PPTX/DOCX/OCR extraction. Statements are typed by hand. |
| Real-time collaboration | Cross-window refresh only (same browser). Multi-user editing is not possible in demo. |
| Deployment | A manual GitHub Action publishes the demo build to GitHub Pages. No production hosting is configured. |

### Export reliability (verified this session)

| Export | Verified | Caveats |
|---|---|---|
| Alignment Report PDF | Generated in e2e; rendered and inspected; Lato embedded (`pdffonts`). | Not text-editable (PDF by nature). |
| Alignment Presentation PPTX | Generated in e2e; text extracted from the XML; rendered via LibreOffice. | Text and shapes are native and editable; logos are images. **Not yet opened in Microsoft PowerPoint.** Lato Black renders only where installed. |
| Driver Register / Traceability CSV | Content asserted in e2e (headers, provenance, formula-injection protection). | — |
| Driver Register / Traceability XLSX | A file is produced (e2e). | **Not opened in Excel**; structure is not asserted beyond file creation. |
| Decision Record PDF | Generated; layout inspected earlier. | — |
| Workshop Summary PDF | Generated in e2e; rendered and inspected. | — |

No export control simulates success: failures surface as errors.

### Quality baseline

- **Tests:** 69 unit tests and 42 Playwright end-to-end runs (9 core flows × 2 viewports, plus 8 workshop flows × 3 viewports), all passing.
- **Checks:** typecheck and build clean.
- **Layout:** checked at 1920, 1440, 1366, iPad landscape and portrait, and phone width.

---

## B. Recommended information architecture

```
Project Compass
├─ Project Home                         ← refactor of Overview
├─ 01 Understand   "What We Heard"
│   ├─ Evidence        sources · statements · transcription       ← Project Intelligence (preserve)
│   ├─ Themes          synthesis · tensions · perspectives        ← Alignment Studio themes (refactor)
│   ├─ Questions       open questions · missing perspectives      ← Alignment Studio questions (preserve)
│   └─ What We Heard   curated, presentation-ready synthesis      ← NEW
├─ 02 Interpret    "What We Believe"
│   ├─ Point of View   central ambition · opportunity · tensions · alternatives   ← NEW
│   ├─ Vision          drafts, comparison, recommended draft      ← Win Theme alternatives (reposition)
│   ├─ Principles      + why it matters · implications · quality review   ← Vision & Principles (refactor)
│   ├─ Design Opportunities                                       ← NEW (Design Drivers reframed)
│   └─ What Success Could Look Like                               ← NEW lightweight outcomes
├─ 03 Align        "Where We're Going"
│   ├─ Presentation    4 chapters · Present/Edit · audience window   ← Owner Workshop (refactor, Stage 3)
│   ├─ Alignment       responses, refinements, open questions per item   ← NEW (Stage 3)
│   └─ Direction history   Proposed → Owner-reviewed → Aligned → revisions   ← NEW (Stage 3)
├─ Reports & Deliverables
│   ├─ Owner Alignment Presentation (PPTX) · Vision & Principles document · Internal Synthesis report
│   └─ Data exports (registers, traceability)                     ← existing (preserve)
└─ More (progressive disclosure, collapsed by default)
    ├─ From Vision to Design   principle → opportunity → outcome → evidence of progress   ← NEW, secondary
    ├─ Evidence map            Traceability Matrix + Relationship Explorer   ← reposition
    ├─ Design Drivers (formal register) · Decision Lab · Success Dashboard   ← reposition, unchanged
    └─ Project Settings
```

**Experience principles:**

- **Two modes.** *Studio* is the default: depth, evidence and editing. *Presentation* is the Align chapters, full screen, with no analytical controls.
- **Stage headers carry orientation, not metrics.** Each stage opens with "Where we are in the thinking" and "what needs attention", replacing counters.
- **Traceability shown in context.** A compact "Grounded in" strip on themes, principles, opportunities and outcomes opens the evidence drawer. The full graph lives under *More → Evidence map*.
- **Non-linear by design.** Stages are lenses on the same data, not gates. Nothing blocks moving forward or back.
- **Old URLs keep working** through redirects (for example `/vision` → `/interpret/principles`, `/workshop` → `/align/presentation`).

---

## C. Component preservation strategy

| Classification | Capability |
|---|---|
| **Preserve** (unchanged) | Domain command handler and validation; permissions; source register; statement capture; transcription verification; evidence panel; comments; version history and restore; Choosing by Advantages engine and Decision Lab UI; driver register; dashboard; CSV/XLSX exporters; demo adapter; Supabase migrations, RLS tests and Edge Function; brand kit (`src/brand`); slide stage, inline editing, autosave and recovery, undo/redo infrastructure; audience-window sync. |
| **Refactor** | Overview → Project Home. Alignment Studio themes → Understand/Themes (adds tension, perspective and priority framing, and accept/reject of suggested themes). Vision & Principles → Interpret (adds *why it matters* and *design implications*; quality review). Rules assistant → contextual *Thinking Partner* panel (critical questions, clearly labelled). Reports → organized around the three deliverables. Navigation and shell. |
| **Reposition** | Design Drivers → advanced *formal register*, linked from Design Opportunities. Decision Lab → *More*, optional. Success Dashboard → *More*, optional future capability. Traceability Matrix and Relationship Explorer → *Evidence map*. Owner Workshop → *Align*, restructured into four chapters (Stage 3). |
| **Defer** | Production backend and SSO (see section E); real AI generation; file text extraction; multi-user real-time editing; Excel/PowerPoint fidelity testing on Windows (Stage 3). |
| **Retire** (approval needed) | **None proposed.** Every existing capability stays reachable, and no data is removed. |

---

## D. Proposed data model changes

All changes are **additive**. Existing entities, IDs and relationships are untouched. New collections default to empty through `normalizeProjectData`, which already upgrades stored demo projects without loss. The same function runs on the server load path. Migrating the Postgres schema needs no change, because the aggregate is stored as `jsonb`.

| New / extended | Shape (abridged) | Why |
|---|---|---|
| `GuidingPrinciple` **+** `whyItMatters: string`, `designImplications: string` | Optional fields, also added to the versioned content (old versions read as empty). | The principle anatomy in §6.3 |
| **`HeardItem`** (What We Heard) | `{ id, section: aspiration\|theme\|tension\|perspective\|priority, title, narrative, evidence: NodeRef[], order, inPresentation, origin: human\|ai\|rules, reviewStatus }` | A curated, Owner-ready synthesis, distinct from raw themes |
| **`PointOfView`** | `{ centralAmbition, opportunity, connectingIdea, tensions[], distinctiveness, keepInMind[], alternatives[{ id, summary, recommended }] }`, versioned | The strategic interpretation in §6.1 |
| **`DesignOpportunity`** | `{ id, code (DO-01), principleIds[], title, description, state: emerging\|proposed\|validated, evidence[], inPresentation, linkedDriverIds[] }` | Non-prescriptive and target-free; optional promotion to a formal Design Driver |
| **`PotentialOutcome`** | `{ id, principleId, opportunityId?, statement, category: qualitative\|quantitative\|experiential\|operational\|environmental\|post_occupancy, state: emerging\|proposed_by_bsa\|validated_with_owner\|define_later, aspiration: boolean, possibleMeasures, evidenceOfProgress[{ date, kind, note, ref? }], inPresentation }` | *What Success Could Look Like* plus the outcomes bridge. No targets or baselines are required. |
| **`AlignmentResponse`** *(Stage 3)* | `{ sessionId, target, status: aligned\|aligned_with_refinements\|needs_discussion\|not_reviewed, feedback, refinements, questions, ownerComments, recordedBy, at }` | The per-item alignment capture in §7.3. *Not reviewed* is the default, so silence is never approval. |
| **`DirectionSnapshot`** *(Stage 3)* | `{ id, label, state: bsa_proposed\|owner_reviewed\|aligned\|revision, at, by, sessionId?, content: { vision, principles, opportunities, outcomes } }`, immutable | Recoverable proposed, reviewed and aligned versions (§7.4) |
| `Suggestion.kind` **+** `tension`, `missing_perspective`, `solution_vs_need`, `principle_quality`, `opportunity`, `outcome`, `narrative` | Extends the existing pending-suggestion model | The Thinking Partner panel (§5.3, §11) |

**Relationship model.** The existing many-to-many `Relationship` table gains node types `opportunity` and `outcome`. That supports the chain *statement → theme → principle → opportunity → outcome*, and the existing traceability functions extend without rewrites.

**Existing data mapping.**
- Win Themes become *Vision drafts*. Same entity; only labels change.
- Existing principles gain empty new fields.
- Existing Design Drivers are untouched. In demo data they are linked from new opportunities.
- Existing v1 workshop statuses stay valid. *Discussing* maps to *Needs further discussion* only for display, pending decision G2.

---

## E. Security and AI architecture

### Implemented today

- **Demo mode** is clearly labelled on every page and holds synthetic data only. Storage is localStorage, which is *not* secure, and the docs say so.
- **No secrets** exist in client code. The only browser-visible configuration is public: the Supabase URL and anon key.
- **Data stays local:** nothing is transmitted to third parties in demo, and the assistant is local rules.
- **A production path is scaffolded:**
  - Postgres schema with project-membership RLS;
  - append-only audit log;
  - private storage bucket with path and MIME constraints;
  - an Edge Function API that verifies JWTs and reuses the domain handler;
  - a server-only AI adapter with confidentiality filtering, `<project_data>` untrusted-content fencing, schema-validated output, and removal of citations to content the model did not receive.
  
  This is all **unverified in a live environment.**
- **No cosmetic security:** the persona switcher is labelled as a demonstration and is not presented as authentication.

### Required for a responsible production deployment

1. **Hosting:** private hosting behind BSA's identity provider (Entra ID SSO, conditional access), with no public data surface.
2. **Data platform:** a provisioned backend (Supabase on an approved plan and region, or an Azure-native equivalent), the RLS verification suite run against the real database, and a penetration test of the API (cross-project access, oversized input, stale revisions).
3. **Documents:** private document storage, upload malware scanning, and a server-side text-extraction pipeline that treats documents as untrusted input.
4. **AI:** an **approved AI provider under a BSA data-processing agreement**, called only server-side; per-project AI policy (already modelled); logging of what was sent (counts, not content); and human acceptance of every AI output (already modelled).
5. **Governance:** backups and retention policy; confidentiality-classification governance; an incident contact.

### AI design for 2.0 (honest by construction)

| Capability (§11.1) | Available without an approved model (demo) | Requires the approved provider |
|---|---|---|
| Synthesis intelligence | Term-overlap grouping, frequency vs. criticality contrast, theme coverage | Semantic clustering, merged-theme proposals |
| Strategic challenge | Recorded conflicts, unsupported principles, requirements outside the framework, missing perspectives (speaker groups with no evidence), likely solution-language ("we need a X room") flagged as "requested solution or underlying need?" | Deeper tension and blind-spot critique |
| Narrative development | Principle quality checks: distinctness via overlap, grounding counts, balance across categories, length and plain-language heuristics | Drafting and refining vision and principle language |
| Design opportunities and outcomes | Templates and prompts that ask the team questions | Suggesting opportunities and indicators |
| Presentation assistance | — | Condensing synthesis into chapter narratives |

Model-only features stay visible but **disabled and labelled "Requires an approved AI provider"**. They are never simulated. Every AI or rules output lands as a *suggestion* with its source references or an "inference" label, and changes nothing until a person accepts it.

---

## F. Stage 2 implementation plan

**Sequence** (each step is independently testable):

1. **Domain model (additive).** New types, commands and validation for HeardItem, PointOfView, DesignOpportunity and PotentialOutcome; principle fields; new relationship node types; suggestion kinds; `normalizeProjectData` defaults; unit tests (target ≥ 25 new). *Depends on:* decisions G1–G3.
2. **Navigation and shell.** The five-item navigation with a collapsible *More* section; stage headers; route redirects from all v1 URLs; breadcrumbs and search updated to cover the new entities.
3. **Project Home.** Identity, current stage, latest working vision, principles in development, unresolved strategic questions, readiness for alignment (a qualitative checklist with no scores), recent meaningful changes, and deliverables.
4. **Understand.** Evidence (re-hosting existing pages); Themes (refactored workspace, accept/reject/rename of suggested themes, tension and perspective lenses); Questions; the **What We Heard** composer with curated items, evidence chips and presentation toggles; the **Thinking Partner** panel (rules-based questions, labelled).
5. **Interpret.** Point of View editor (with alternatives and a recommended flag); Vision drafts (reusing the Win Theme comparison); Principles with the new anatomy and an optional **quality review** (findings, no scores, dismissible); **Design Opportunities** (per principle, multiple, non-prescriptive, optional link to drivers); **What Success Could Look Like** (states, categories, aspiration flag, no required metrics).
6. **Traceability.** "Grounded in" strips and the evidence drawer on themes, principles, opportunities and outcomes; extended graph columns in the Evidence map.
7. **Advanced area.** Drivers, Decision Lab and Dashboard moved under *More*, unchanged; a link from opportunity to driver.
8. **Demo content.** A realistic synthetic second-meeting preparation for the pharmacy project: curated What We Heard, a point of view, about 3 opportunities and 2–3 outcomes per principle, all synthetic and labelled.
9. **Verification and preview.**
   - Unit and regression tests.
   - Playwright flows rewritten for the new navigation, with v1 flows kept for advanced areas.
   - Layout checks at 1920, 1440, iPad landscape and portrait, light and dark.
   - A preview build published through the existing *Deploy static demo* workflow, on the existing branch.

**Risks and mitigations:**

| Risk | Mitigation |
|---|---|
| End-to-end churn from navigation changes | Keep stable test IDs; redirect old routes; migrate tests incrementally. |
| Concept overlap (themes vs. What We Heard; drivers vs. opportunities) | Clear copy and an explicit "promote / link" action rather than duplicated editing. |
| Scope creep into Stage 3 | The v1 Owner Workshop stays reachable and unchanged during Stage 2. |
| AI expectations | Model-only actions are labelled unavailable; nothing is simulated. |
| localStorage demo data from v1 | Additive normalization, plus the existing "Reset demo data" action. |

**Not in Stage 2:** the four-chapter presentation, alignment capture, direction snapshots, and new deliverable exports. Those are Stage 3.

---

## G. Questions requiring executive direction

1. **"Win Theme" or "Vision"?** The brief speaks of a project *vision*; v1 uses *Win Theme* (pursuit language). *Recommendation:* default to **Vision**, keeping per-project terminology so teams can still say *Win Theme* during pursuits.
2. **Is "Aligned" the endpoint, or is formal adoption still required?** v1 records explicit Owner approval of exact wording. The brief's alignment states are conversational. *Recommendation:* make **alignment status the primary outcome**, and keep **formal adoption of exact wording** as an optional, explicit action on an aligned version.
3. **Design Drivers.** *Recommendation:* introduce lightweight **Design Opportunities** as a new entity and leave the 12 existing drivers untouched as the optional formal register, linked from opportunities when a team chooses. The alternative, converting drivers into opportunities, simplifies the model but alters existing records.
4. **AI provider and data policy.** Which provider is approved for project content (for example Anthropic under a BSA agreement, or Azure OpenAI inside the BSA tenant), and may the **demo** use a server-side model with synthetic data only? Until decided, Stage 2 ships rules-based critical questions, with model features labelled unavailable.
5. **Production platform direction** (not blocking Stage 2): continue with the Supabase scaffold, or target an **Azure-native** stack aligned with BSA's Microsoft environment (Entra ID, Azure Postgres, Blob Storage, Functions)?
6. **Vision & Principles document format:** **editable Word (DOCX)** for the team to keep editing, PDF only, or both? *Recommendation:* both. DOCX for team use; PDF for distribution.
