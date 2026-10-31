# Compass 2.0 — Stage 3: Owner Alignment and Deliverables

Status: **implemented in demo mode.** This completes the three-stage Compass 2.0 refactor. The secure production deployment remains a separate, unverified track (see [SECURITY.md](SECURITY.md) and [DEPLOYMENT.md](DEPLOYMENT.md)).

Defaults G1–G4 from Stage 2 still apply. For G2 (what counts as the outcome of the conversation), this stage implements the recommendation: **alignment is the primary, recorded outcome, and formal adoption of exact wording is optional and separate.** G6 (document format) is implemented as both: the Vision and Principles document is produced in Word (editable) and PDF from the same content.

## 1. Owner-ready presentation

The Owner Workshop is now a four-chapter story. It begins with what BSA heard and leads with BSA's recommendation; the Owner is not asked to do BSA's design thinking.

| Chapter | Content |
|---|---|
| **1. What We Heard** | One slide per section: aspirations, themes, tensions, perspectives and priorities. Only reviewed items marked for the presentation are shown, each with one verbatim quote. |
| **2. What We Believe** | Point of view (central ambition, the opportunity, the connecting idea), then the recommended vision and any alternatives. |
| **3. What Will Guide Us** | Principles overview, then one slide per principle with *why it matters* and up to two illustrative design opportunities. A supporting quote is optional. |
| **4. What Success Could Look Like** | Up to eight potential outcomes, framed as "If we deliver on this vision, what should be different or better?" There are no targets. |

The deck closes with *For discussion* (prompts and tensions) and *Where we are aligned*, a live view of the responses recorded in this session.

- **Navigation:** keys **1–4** jump between chapters, and the presenter bar has chapter buttons. Chapter headings group the slide rail.
- **Presenter notes:** available on every slide, not only on vision and principle slides.
- **Deck options** (status pills, hiding items not adopted, design opportunities, supporting quote) are grouped in one menu.
- **Owner-facing screens:** no counts, evidence tables, prompts or internal notes. Present mode shows only the slide and a fading presenter bar.

*Align → Presentation* shows what each chapter will contain and what is held back.

## 2. Feedback capture

Each session records an Owner response for the vision and each principle. The statuses are **Aligned**, **Aligned with refinements**, **Needs further discussion** and **Not yet reviewed**. Not yet reviewed is the default, and silence is never treated as alignment.

Alongside the status, the facilitator can capture:

- feedback;
- requested refinements;
- open strategic questions, which can be added to *Critical Questions* in one action;
- Owner comments.

Responses can be recorded in three places:

- **Edit mode:** facilitator panel → *Owner response*.
- **Present mode:** press **A**. A compact panel opens beside the slide. It is not shown in the audience window, and **Esc** closes it.
- **After the meeting:** *Align → Owner Alignment*, which shows responses by session and the latest response across sessions.

Recording a response never changes approval status. Formal adoption of exact wording remains the explicit *Record approval* action, with frozen wording and an accountable approver.

## 3. Version and alignment states

Every snapshot of the direction (`DirectionSnapshot`) is immutable. There is no edit or delete command. A snapshot captures:

- the point of view;
- the vision alternatives and principles, including *why it matters* and implications;
- opportunities and outcomes;
- the latest Owner response for each item.

| State | Recorded |
|---|---|
| BSA proposed direction | Automatically when a session starts ("As presented — WS-02"), or saved by an editor |
| Owner-reviewed direction | Automatically when a session ends ("After WS-02"), or saved by a facilitator |
| Aligned direction | Explicitly by a facilitator. **Refused** unless every active principle and at least one vision have an aligned response on record. |
| Subsequent revision | Saved by an editor at any time |

- **Compare:** *Align → Direction History* lists every version and flags principles changed or added since each one.
- **Restore:** restoring creates **new versions** of the changed vision and principle wording, and current wording stays in version history. **Approved wording is never changed:** restore skips it and reports why. An aligned version therefore remains recoverable while work continues.

## 4. Outcomes bridge

- **Project Home:** readiness now includes "Owner responses recorded for every principle" and "Aligned direction recorded".
- **Interpret:**
  - The principle detail and vision cards show the Owner response separately from approval status.
  - Opportunities link to drivers, and outcomes carry evidence of progress, as in Stage 2.
- **From Vision to Design:**
  - It names the aligned direction it is measured against, or says that none has been recorded.
  - Each principle shows the Owner's response, and principles changed since alignment are flagged.

## 5. Deliverables

| Deliverable | Format | Notes |
|---|---|---|
| **Owner Alignment Presentation** | PPTX | The four chapters plus discussion. Every text item is a native, editable text box; the only images are the BSA logos. Evidence references and Owner responses are in the speaker notes. Only reviewed items marked for the presentation are included. The status line reads "Working draft — not yet aligned with the Owner" or names the aligned direction. |
| **Vision and Guiding Principles** | DOCX and PDF | Vision, point of view, and each principle with its statement, intent, why it matters, design implications, opportunities, possible outcomes and key evidence (verbatim quotes with codes). Ends with an evidence-connections table and open questions. Uses Word styles (Title, Heading 1–3, Quote). |
| **Internal Synthesis Report** | PDF and DOCX | Marked *Internal — for BSA use only*. Covers the recommended direction, alternatives considered, key themes, the complete What We Heard (including unreviewed and unselected items), strategic tensions, interpretations, rules-based principle-quality observations, unresolved questions, Owner alignment and direction history. |
| **Workshop Summary** | DOCX and PDF | Concise and editable. It leads with the vision and principles with the Owner's response to each, then significant refinements, items not yet reviewed, remaining strategic questions, emerging opportunities and outcomes to validate. Formally adopted wording, wording changes and next steps follow. Available from the workshop and from *Reports & Deliverables*. |

The earlier exports are preserved as records under *Reports & Deliverables*:

- Project Alignment Report (PDF);
- the driver-focused deck, renamed *Design Driver Briefing* (PPTX);
- Driver Register and Traceability Matrix (CSV/XLSX);
- Decision Record (PDF).

Word and PDF documents are built from one outline (`src/exporters/outline.ts`), so their content cannot drift apart.

### Export verification

- **Unit tests:**
  - The PPTX is parsed and checked for all four chapters, the vision, the status line in the masters and evidence in the notes, and that every embedded image is a logo.
  - The DOCX `word/document.xml` is checked for rationale, evidence and status.
  - The synthesis outline is checked for internal labelling, unreviewed items, alternatives and tensions.
  - The summary is checked for heading order.
- **End-to-end:** each deliverable is downloaded from the built app and unzipped or checked for a valid PDF header.
- **Rendered and inspected:** files were rendered with LibreOffice 7 and pdftotext:
  - all 22 deck slides;
  - the Word documents;
  - the PDFs (7 pages for Vision and Principles, 6 for the synthesis report).
  
  Content and layout were correct. Auto-fit text was removed from the deck because renderers apply it inconsistently; fixed sizes are used instead.
- **Not tested:** fidelity in Microsoft PowerPoint and Word on Windows; no Office installation was available. Fonts fall back if Lato is not installed.

## 6. iPad and responsive behavior

- **New test viewport:** an iPad Pro portrait project (1024 × 1366, touch) runs the Compass 2.0 and Align end-to-end flows, alongside landscape, desktop and 1080p laptop.
- **Layout sweep:**
  - pages: 14 key pages, including the workshop and the Align pages;
  - viewports: 1920, 1440, iPad landscape and iPad portrait;
  - themes: light and dark;
  - result: no horizontal overflow and no console errors.
- **Touch and hover:**
  - In Present mode, tapping shows the presenter bar.
  - Every critical action has a visible control; the only hover-revealed element is the drag grip in the slide rail, and reordering also has buttons and Alt+↑/↓.
  - The alignment table switches to icon-only actions below very wide screens.

## 7. Regression results

| Check | Result |
|---|---|
| `tsc -b` (app, node, server) | pass |
| Vitest | **99 / 99** (13 files). New: 11 alignment and direction tests and 6 deliverable tests. |
| Playwright | **77 / 77** across desktop 1440 × 900, iPad landscape, iPad portrait and laptop 1920 × 1080. New: 4 Align and deliverable flows; all Stage 1.x and 2 flows still pass. |
| `npm audit --omit=dev` | 2 high advisories, both through `pptxgenjs → image-size` (denial of service when parsing JXL/HEIF/ICNS images). The dependency predates this stage. The exporters pass only the bundled PNG logos, with explicit sizes. The suggested fix downgrades pptxgenjs to 4.0.0 (breaking) and was not applied. |

Dependencies added: `docx` 9.10.0 (pinned; a release more than two weeks old), and `jszip` 3.10.2 declared as a dev dependency for tests (it was already installed through pptxgenjs).

## 8. Remaining limitations

- **Office fidelity** has not been verified in Microsoft Office on Windows (see section 5).
- **The PPTX** is generated from current project data, not from a saved direction version. Export it straight after recording an aligned direction if the two must match exactly.
- **Alignment covers the vision and principles**, as the brief specifies. Owner reactions to What We Heard, opportunities and outcomes go in the feedback fields or notes.
- **Restore** covers wording, principle rationale and the point of view. It does not recreate deleted items or restore opportunities and outcomes; the snapshot still records them for reference.
- **Single facilitator:** the response panel in Present mode is visible on a shared screen. Use the audience window when the conversation needs to stay uncluttered.
- **Demo storage:** browsers holding demo data from before this stage keep their data and start with no Owner responses or versions. *Project Settings → Reset demo data* loads the synthetic WS-01 responses and the "Prepared for WS-02" version.
- **Production:** all of this runs in the demonstration build. The secure backend stores the same aggregate and runs the same commands, but it is still not exercised against a live Supabase project, and there is no approved AI provider.
