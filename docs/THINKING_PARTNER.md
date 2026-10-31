# Thinking Partner 2.0 — Contextual Design Intelligence

The Thinking Partner helps a BSA team notice patterns, question assumptions, develop interpretations and sharpen language while working in **Understand** and **Interpret**. It proposes; people decide. *AI expands the possibilities. People exercise the judgment.*

**Everything in this build is rule-based.** No language model is connected, and nothing is sent to an external service. Model-only capabilities are listed per mode, disabled, and labelled *Requires an approved AI provider*.

Recoverable checkpoint taken before this work: branch `backup/pre-thinking-partner-2`.

## 1. Audit of the previous implementation (Phase A)

| Area | Before | Now |
|---|---|---|
| Rules | `RulesProvider` (six tasks): term-overlap relationship and theme proposals, requirements missing from the framework, driver validation questions, critical questions (tensions, perspectives, solution-vs-need), principle quality | **Kept**. The 1.x link and theme proposals and the driver validation questions still run inside the new engine. The other three tasks are superseded by the context-aware rules below. |
| Storage | `suggestions` collection; `suggestion.add / accept / dismiss` | **Kept and extended**: optional `card` field, new statuses `saved` and `not_relevant`, and commands `saveQuestion`, `toCanvas` and `markNotRelevant` |
| Context | None: the drawer ignored the page and the selected item | Workspace, whole page or selected item, project sector and phase |
| UI | Modal drawer that reused `SuggestionsPanel`, plus a task dropdown | Non-modal panel with four modes, cards, guided exploration and the Working Canvas. `SuggestionsPanel` is retired. |
| Provider restrictions | `assistProviderFor()` uses a server-side model only in remote mode **and** when the project's AI policy is enabled | Unchanged for 1.x tasks. Thinking Partner analyses use the new provider interface, and its AI provider is unavailable. |
| Security assumptions | Rules run in the browser; no keys; the server-side AI path is scaffolded and unverified | Unchanged. No new network calls. |

## 2. Experience

Open **Thinking Partner** in any Understand or Interpret page. It sits beside the work on desktop and iPad landscape (at 1280 px and above), over it on narrower screens, and stays open while you move between pages.

1. **Current context:** for example "Interpret · Guiding Principles: 6 principles and their evidence". Analyze the page, the selected item (from the URL, e.g. `?principle=gp-1`), or any item you choose. The panel also shows the workspace's priorities and the project's sector and phase.
2. **Modes:**
   - **Explore** — What might we be missing?
   - **Challenge** — What should we question?
   - **Develop** — What could this become?
   - **Refine** — How could we make it stronger?
3. **Analyze** shows **three observations or fewer**, each from a different rule. **Look deeper** shows up to eight. When nothing meets the bar, the panel says *"No significant observations identified from the available evidence."*
4. **Cards** show:
   - the observation;
   - why it matters;
   - a question to consider;
   - a suggested next action;
   - supporting context and evidence (verbatim quotes, expandable);
   - the method (e.g. *Rule-based analysis: shared primary concept lens*);
   - the evidence status: *Direct source evidence*, *Indirect contextual support*, or *Inference — no source reference*.
5. **Card actions:**
   - Explore further: opens a guided exploration, or the card's evidence.
   - Accept as working consideration: saves the card to the canvas.
   - Save as question: adds it to Critical Questions.
   - Apply proposed link / Create proposed theme: 1.x proposals only.
   - Not relevant / Dismiss.

   Set-aside items do not come back unless their evidence changes, or you tick *Include set-aside observations*.
6. **Guided exploration:** a strategic question, with curated directions you can compare side by side (up to three). *Develop this direction* or *Write my own interpretation* creates a canvas item; nothing is concluded for you.
7. **Working Canvas:**
   - Kinds: emerging interpretations, questions, connections, alternative narratives, potential opportunities, ideas needing evidence.
   - States: Exploring, Worth developing, Incorporated, Set aside.
   - Each item keeps its origin, its context and the statements linked to it.
   - **Promote…** creates a *draft* in one of six places:
     - a Critical Question;
     - What We Heard (unreviewed);
     - a Point of View alternative (not recommended);
     - a proposed Vision alternative;
     - an emerging Design Opportunity;
     - an emerging Potential Outcome.

   Promotion never edits existing content, approved or not.

## 3. Evidence Intelligence (Phase C)

All rules are in `src/services/thinking/rules.ts`. Each one declares its modes and the workspaces where it applies.

**What the rules rest on:**

- **Concept lenses** (`lenses.ts`): a small vocabulary, matched by word stem. Examples are continuity, flow, people, growth, community, certainty, safety, care, space, learning, discovery and collaboration.
- **Sector profiles** (`sectors.ts`): typical and contextual perspectives for Healing, Learning and Discovery projects.
- **Evidence qualification** (`evidence.ts`): Owner requirement, Owner direction, stakeholder aspiration, observation and external research. No numeric importance score exists anywhere.

| Mode | Rule | What it notices |
|---|---|---|
| Explore / Develop | connected ambition | Three priorities recurring across many voices. Asks whether they connect, and offers three curated directions to compare. |
| Explore | related themes | Two themes sharing a *primary* concept (two or more matching words in each), with their evidence |
| Explore | perspectives | A group mentioned in the evidence but never heard from is a likely gap. A sector-typical group that is absent is asked about as a question. Contextual groups are not raised without evidence. Also flags one voice dominating the evidence. |
| Explore / Challenge | under-attended | Owner requirements, non-negotiables or critical statements missing from What We Heard and the principles ("frequency is not importance") |
| Explore / Develop | concerns → opportunity | Two or more concern statements in one concept area |
| Explore / Challenge | evidence gaps | Sources with no statements, unverified transcriptions, unattributed statements |
| Challenge / Refine | principle overlap | A shared primary concept or shared evidence. **Shared keywords alone are never enough.** Offers to compare evidence, explore a combined interpretation, keep them separate and clarify, or save as a question. Never merges. |
| Challenge | tensions | Recorded conflicts, plus curated pairs that commonly compete (e.g. compact footprint vs. daylight), raised only when each side is the main subject of a statement and the pair isn't already recorded |
| Challenge | solution vs need | Requests that name a building element ("we need another corridor", "keep … separate"). Asks what need motivates them. Owner requirements are not second-guessed. |
| Challenge | weak support | Principles with no evidence, or resting only on observations or research. Presented What We Heard items with no evidence. |
| Challenge | frequency vs importance | The most-mentioned theme has no weighty evidence, while a rarely mentioned theme has some |
| Challenge | requirements not in framework | Existing gap analysis |
| Develop | vision alternatives | Fewer than two alternatives. Offers curated narrative framings (promise, capability, experience) to write from. |
| Develop | opportunities from a principle | Fewer than two opportunities. Offers curated prompts matched to the principle's concepts. |
| Develop | operational → human | A principle framed only operationally |
| Develop | outcomes | Principles with no outcomes, or with only operational or quantitative outcomes. Never suggests targets. |
| Develop | point of view from What We Heard | Tensions in What We Heard that the point of view doesn't name |
| Refine | generic language | Curated generic terms ("world-class", "innovative", …) |
| Refine / Challenge | prescriptive direction | A principle or opportunity that names a design element |
| Refine | narrative strength | Missing "why it matters", very long or very short statements, long titles, a vision with no narrative |
| Refine | alternatives similar | Vision alternatives that lead with the same idea |
| Refine / Challenge | What We Heard balance | Empty sections; items awaiting review |

**Ordering.** Observations are ordered internally by tier, then by whether the current workspace is the rule's main one. Tiers are never displayed.

**Change detection.** Each observation has a fingerprint (the rule plus its subjects) and an evidence key (a hash of the subjects' and evidence's current text). These suppress repeats and allow a re-raise when the evidence changes.

## 4. Future AI readiness (Phase D)

`src/services/thinking/providers.ts` separates five concerns:

| Concern | Implementation |
|---|---|
| Analysis interface | `ThinkingPartnerPanel` builds an `AnalysisRequest` (workspace, mode, focus, depth, include set-aside) |
| Analysis providers | `ThinkingProvider` interface. `RulesThinkingProvider` is available. `ApprovedAiThinkingProvider` exists but always reports *unavailable* and throws if called. |
| Project Context Builder | `buildProjectContext()` returns a structured, serializable view: project, workspace and priorities, focus, statements with evidence class, themes, What We Heard, point of view, vision, principles, opportunities and outcomes |
| Suggestion validation | `validateSuggestions()` checks structure, allowed kinds, that every reference exists, and that the evidence status matches what is cited. Invalid output is dropped, never repaired. |
| Human review | Unchanged review commands. No suggestion changes project content until a person acts, and promotion only creates drafts. |

**To activate an approved provider:**

1. **Approval.** BSA approves a provider under a data-processing agreement, and decides which confidentiality classifications may be sent. This is executive decision G4.
2. **Backend.** Deploy the secure backend (see [DEPLOYMENT.md](DEPLOYMENT.md)) and add a `thinking` task to the Edge Function. The function:
   - builds the context server-side from stored data with `buildProjectContext`;
   - removes statements above the allowed classification, as `buildAssistInput` already does;
   - fences project content as untrusted data;
   - asks for the `suggestionOutputSchema` structure, including `card`;
   - re-validates with `validateSuggestions` before returning.
3. **Client.** Implement `ApprovedAiThinkingProvider.analyze` to call `adapter.assist(projectId, 'thinking', request)`. Report available only when the adapter is remote, the endpoint exists and the project's AI policy is enabled.
4. **Labelling.** Results carry `origin: 'ai'`, so cards show *AI-assisted analysis*. The model-only list in each mode can then be enabled item by item.

**Never:** API keys in the browser, direct client calls to a model, or sending content above the project's allowed classification.

## 5. Testing

- **Unit tests** (`src/services/thinking/thinking.test.ts`, 21 tests) cover the brief's scenarios:
  - evidence gaps;
  - a relationship between themes;
  - overlapping principles, using the GP-01 / GP-03 example;
  - a prescriptive request (ST-019, "a corridor");
  - a guided exploration;
  - saving to the canvas;
  - dismissing, then re-raising when the evidence changes;
  - promoting to a draft while approved content stays byte-identical;
  - references and evidence labels;
  - working without an AI provider;
  - the empty-evidence case returning no observations;
  - roles;
  - normalization of older data.
- **End-to-end** (`e2e/thinking.spec.ts`), on desktop, iPad landscape and iPad portrait:
  - exploration → canvas → reload persistence;
  - challenging a selected principle and saving the question, with approved text unchanged;
  - prescriptive request and dismissal not repeating;
  - promotion into a draft opportunity;
  - "No significant observations…".

## 6. Limitations

- **Concept lenses are a curated vocabulary, not semantic understanding.** Synonyms outside the vocabulary are missed, and coincidental words can match. Every observation is phrased as a question and cites what it matched.
- **Curated directions are templates.** They are labelled as such and meant to be rewritten.
- **Sector profiles are deliberately small.** Projects marked *other* get few perspective prompts.
- **Analyses run on demand, not continuously.** Pending suggestions persist with the project, and the canvas is shared project data stored with it (browser storage in demo mode).
- **Single editor at a time** for canvas items, as elsewhere in demo mode.
