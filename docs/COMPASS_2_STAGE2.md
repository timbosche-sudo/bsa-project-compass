# Compass 2.0 — Stage 2: Core experience (Understand → Interpret)

Status: **implemented for review in demo mode. Stage 3 (Align and Owner Presentation mode) has not started.** Stage 3 begins only after the core experience has been reviewed.

## 1. Defaults adopted for open questions

The executive questions from the Stage 1 assessment were not answered before Stage 2 started. These defaults were used. Each is reversible.

| # | Question | Default used | How to change it |
|---|---|---|---|
| G1 | Vision vs Win Theme | **Vision** is the default term for new projects and the demo. *Win Theme* remains available for each project. | *Project Settings → Terminology* |
| G2 | What counts as the outcome of an Owner conversation | **Alignment** is primary. Formal adoption of exact wording is optional (the existing workshop approval flow is unchanged). | Stage 3 decision |
| G3 | Design Drivers vs opportunities | A new **Design Opportunity** entity. Existing drivers are untouched; opportunities can link to them. | — |
| G4 | AI | **No model.** The Thinking Partner is rules-based. Model-only features are shown disabled and labelled *Requires an approved AI provider*. | Approve a provider; see SECURITY.md |

## 2. Navigation

```
Project Home
01 Understand   Evidence · Themes · Critical Questions · What We Heard
02 Interpret    Point of View · Vision · Guiding Principles · Design Opportunities · What Success Could Look Like
03 Align        Readiness, workshops → Owner Workshop (unchanged in Stage 2)
Reports & Deliverables
More tools ▸    From Vision to Design · Evidence Map · Design Drivers · Decision Lab · Success Dashboard · Project Settings
```

| Route | Page |
|---|---|
| `/projects/:id` | Project Home |
| `/understand/evidence`, `/understand/evidence/:sourceId`, `/understand/evidence/statement/:id` | Evidence (former Project Intelligence) |
| `/understand/themes`, `/understand/questions`, `/understand/heard` | Themes, Critical Questions, What We Heard |
| `/interpret/point-of-view`, `/vision`, `/principles`, `/opportunities`, `/success` | Interpret steps |
| `/align` | Align landing |
| `/more/from-vision-to-design`, `/more/evidence-map?tab=matrix\|explorer` | More tools |
| `/drivers`, `/decisions`, `/dashboard`, `/reports`, `/settings`, `/workshop` | Unchanged |

Compass 1.x URLs redirect and keep their query parameters where they matter:

- `/intelligence/*` → `/understand/evidence/*`
- `/alignment?tab=matrix|explorer` → `/more/evidence-map`; otherwise → `/understand/themes`
- `/vision?principle=` → `/interpret/principles`; otherwise → `/interpret/vision`

Stage pages share `StageLayout` (stage purpose, step navigation, Thinking Partner drawer). Page headers render compactly inside a stage.

## 3. Domain additions

All additions go through the existing command handler (validation, role capabilities, audit and revision).

| Entity | Purpose | Commands | Capability |
|---|---|---|---|
| `HeardItem` | What We Heard: section, title, narrative, evidence (statements and themes), presentation flag, review flag, origin | `heard.create`, `heard.update`, `heard.delete`, `heard.reorder` | `theme.edit` |
| `PointOfView` | Central ambition, opportunity, connecting idea, tensions, distinctiveness, keep-in-mind, alternatives (at most one recommended), version history | `pov.update` (with coalesced autosave) | `framework.edit` |
| Principle support | `whyItMatters`, `designImplications`. **Not** part of the versioned or locked wording. | `principle.updateSupport` | `framework.edit` |
| `DesignOpportunity` | `DO-xx`: title, description, principles, state (emerging / proposed / validated), presentation flag, linked drivers | `opportunity.create`, `opportunity.update`, `opportunity.delete` | `framework.edit` |
| `PotentialOutcome` | `PO-xx`: statement, principle, optional opportunity, category, state (… / *to be defined later*), aspiration flag, possible measures in words, evidence of progress | `outcome.create`, `outcome.update`, `outcome.delete`, `outcome.addProgress`, `outcome.removeProgress` | `framework.edit`; recording progress uses `driver.recordMeasurement` |

Integrity rules:

- Evidence references must exist.
- Deleting or merging a principle updates opportunity and outcome links.
- Deleting an opportunity unlinks its outcomes.
- Opportunities and outcomes inherit evidence from their principles (`evidenceFor`).
- New nodes are searchable (⌘K) and deep-linkable.

New Thinking Partner rules (`RulesProvider`), offered for review only:

- **critical_questions** — recorded tensions; critical statements that are rarely mentioned ("frequency is not importance"); expected perspectives with no attributed statements; a single dominant voice; solution-language requests ("we need a bigger …") reframed as a question about the underlying need.
- **principle_quality** — overlapping principles, principles with no or one supporting statement, over-long or very short statements, and unaddressed categories. It never proposes wording.

Accepting a tension, missing-perspective or solution-vs-need suggestion creates an open question. Accepting a principle-quality note only records the acknowledgement.

**Persistence.** The secure backend stores each project as one JSON aggregate (`project_state.data`) and runs the same `applyCommand`, so no migration is needed. `normalizeProjectData` adds empty collections to data saved by earlier versions. In browsers that already hold demo data, the new sections start empty; *Project Settings → Reset demo data* loads the new synthetic content.

## 4. Preserved capabilities

Unchanged and still reachable:

- source and statement capture, transcription correction and verification;
- themes, merges and splits;
- the traceability matrix and relationship explorer;
- Vision / Win Theme and principle governance (approval, locking, versions, restore);
- the Owner Workshop with all its Stage 1.x features;
- Design Drivers, Decision Lab, Success Dashboard, reports and exports, settings, roles and audit.

Project Overview's counters were retired in favor of Project Home. The same information remains in the Success Dashboard.

## 5. Synthetic demo content

The demo pharmacy project gains:

- 11 What We Heard items, one of them a rules-generated observation awaiting review;
- a Point of View with three alternative directions;
- *Why it matters* and *Emerging design implications* for all six principles;
- 13 Design Opportunities, mostly linked to existing drivers;
- 10 Potential Outcomes, two with synthetic evidence of progress.

All content is fictional, and every reference points to synthetic statements.

## 6. Regression results

| Check | Result |
|---|---|
| `tsc -b` (app, node, server projects) | pass |
| Vitest | **82 / 82** (11 files), including 9 new domain tests (`compass2.test.ts`) and 4 Thinking Partner tests |
| Playwright | **58 / 58** across desktop 1440×900, iPad Pro landscape 1366×1024 and laptop 1920×1080 (workshop). This includes 7 new Compass 2.0 flows and a legacy-redirect test. |
| Layout sweep | 9 key pages × {1920, 1440, iPad} × {light, dark}: no horizontal overflow and no console errors |

## 7. Known limitations (for the review)

- **What We Heard** is not yet in the PDF/PPTX exports, and the Owner-ready preview is on-screen only. *Planned for Stage 3 with Owner Presentation mode.*
- **Point of View** history shows the central ambition of each saved version. A full restore is not offered.
- **Rules are heuristics.** Perspective detection matches speaker attributions only, and solution-language detection is phrase-based. Both are framed as questions.
- **The Align landing** is intentionally light. The Owner Workshop still presents the Vision and principles only.
- **The secure backend** is still not exercised against a live Supabase project, as before.

## 8. What to review before Stage 3

1. Does Understand → Interpret → Align match how BSA teams actually work? Are the step names right?
2. Should *Vision* be the default term (G1)?
3. Are *Design Opportunities* and *What Success Could Look Like* the right level of formality? Should outcomes ever carry targets?
4. Is anything in *More tools* used often enough to deserve primary navigation?
5. For Stage 3: what should Owner Presentation mode contain (What We Heard, Point of View, Vision, principles, opportunities, outcomes), and is formal wording adoption still required (G2)?
