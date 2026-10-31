# Owner Alignment Workshop Mode

Workshop Mode is the Owner presentation and the place to hold the alignment conversation. It tells a four-chapter story that begins with what BSA heard and leads with BSA’s recommendation, then records how the Owner responds. The **Vision** (configurable, e.g. *Win Theme*) and **Guiding Principles** can be wordsmithed live, and exact wording can optionally be adopted formally.

Open it from **Align → Presentation → Open presentation** or **Align → Prepare → Open Owner Workshop**. URL: `/projects/<id>/workshop`.

## The four chapters

| Chapter | Slides | Content |
|---|---|---|
| 1. What We Heard | Chapter divider, one slide per section | Reviewed *What We Heard* items marked for the presentation, each with one verbatim quote. Unreviewed or unselected items never appear. |
| 2. What We Believe | Divider, point of view, one slide per vision alternative | Central ambition, the opportunity and the connecting idea; the recommended vision first, then alternatives |
| 3. What Will Guide Us | Divider, overview, one slide per principle | Title, statement, intent; *why it matters* and up to two illustrative design opportunities (deck option); optionally one supporting quote |
| 4. What Success Could Look Like | Divider, outcomes | Up to eight potential outcomes marked for the presentation, framed as “If we deliver on this vision, what should be different or better?” — no targets |
| Closing | For discussion, Where we are aligned | Discussion prompts with the tensions from the point of view; a live view of Owner responses recorded in the session |

A chapter is left out when it has nothing to show. *Align → Presentation* lists what each chapter will contain and what is held back.

## Owner responses (alignment capture)

For the vision and each principle the facilitator records the Owner’s response: **Aligned**, **Aligned with refinements**, **Needs further discussion** or **Not yet reviewed** (the default — silence is never treated as alignment). Feedback, requested refinements, open strategic questions and Owner comments are captured alongside, and a question can be added to *Critical Questions*.

- **Edit mode:** facilitator panel → *Owner response*.
- **Present mode:** press **A** (or *Owner response* in the presenter bar). A compact panel opens beside the slide; the slide shifts left so it stays readable. It is not shown in the audience window. **Esc** closes it.
- **After the meeting:** *Align → Owner Alignment* shows responses by session and lets facilitators complete them.

Alignment is not formal approval. Adopting exact wording remains the separate, explicit *Record approval* action below.

## Direction versions

Starting a session saves the direction as presented (*BSA proposed*); ending it saves an *Owner-reviewed* version. Once every principle and a vision have an aligned response, a facilitator can record the *Aligned direction* (*Align → Owner Alignment*). Versions are immutable and listed in *Align → Direction History*, where they can be compared with the current direction and restored — restoring creates new versions and never changes approved wording.

## Same data, no synchronization

Workshop Mode is another view onto the same project data. Every change goes through the same command handler as the rest of Project Compass. That covers editing, statuses, approvals, duplicating, merging, deleting and reordering. Edits appear immediately in Interpret, Project Home, the Traceability Matrix, reports and the audience window. Nothing needs exporting or synchronizing by hand.

## Supported environments

- **Primary:** Windows laptops in a modern browser (Edge or Chrome), shared through Microsoft Teams or projected. The layout is desktop-first and the slides are 16:9.
- **Also:** Mac laptops (Safari, Chrome, Edge) and iPad Pro.
- **Requires** no second monitor, no special hardware, no installed app and no iPad. Everything works in a single browser window.

## Modes

| | Edit mode | Present mode |
|---|---|---|
| Layout | Slide rail, item toolbar, 16:9 slide, optional facilitator panel | Full-window 16:9 slide (browser full screen when allowed) with no application chrome |
| Editing | Click any text on the slide to edit it in place | Press **E** or choose *Edit in place* to wordsmith directly on the presented slide. Status and approval controls appear in the floating bar |
| Facilitator controls | Visible | Hidden; a minimal bar appears on mouse move and fades after 2.5 s |
| Notes and evidence | Facilitator panel (marked *facilitator only*) | Never shown |

Switch with **P** (present) and **Esc** (back to Edit). You stay on the same slide.

### Keyboard (primary) · mouse · touch (secondary)

| Key | Action |
|---|---|
| ← / → , PageUp / PageDown , Space | Previous / next slide (presentation clickers send PageUp/PageDown) |
| Home / End | First / last slide |
| 1 – 4 | Jump to a chapter |
| A | In Present mode: record the Owner’s response to the current vision or principle |
| P | Present |
| E | In Present mode: toggle in-place editing |
| Esc | Finish in-place editing; press again to return to Edit mode. In a text field it cancels the edit |
| F | Toggle browser full screen |
| N | Show or hide the facilitator panel |
| Ctrl/⌘+Z, Ctrl/⌘+Shift+Z or Ctrl+Y | Undo / redo workshop changes (inside a text field, the browser's own text undo applies) |
| Ctrl/⌘+Enter | Finish editing a multi-line field |
| Alt+↑ / Alt+↓ | Move the current principle earlier or later |

## Capabilities

- **Presentation-quality slides:** the four chapters above. Deck options (status pills, hiding items not adopted, design opportunities and supporting quotes on principle slides) are in *Deck options*. Typography scales with the slide (container query units), so it reads the same on a 13" laptop, a Teams share or a conference display.
- **Inline editing:** titles, statements, intents and vision narratives, styled exactly as presented.
- **Add, delete, duplicate, merge and reorder.** Delete moves the item to recoverable trash (Undo brings it back); approved items can't be deleted and are marked *Not Adopted* or superseded instead. Duplicate carries the evidence links over. Merge moves evidence, Design Drivers and decision links to the combined principle, and keeps the merged principles as superseded, where they can be reinstated. Reorder works by drag and drop in the slide rail, the arrow buttons, or Alt+↑/↓.
- **Undo/redo and revision history:** undo and redo cover edits, status changes, add, duplicate, delete and reorder. Every change is also in the item's version history (facilitator panel → History), with restore.
- **Review statuses:** Proposed, Discussing, Needs Refinement, Approved, Not Adopted (plus Superseded for history).
- **Owner approval of the exact wording:** *Record approval* shows the exact text to be adopted. The facilitator selects the Owner approver, who must hold an approval role and be the accountable approver if one is set, then confirms. The record stores the frozen wording, approver, person recording, time, version and session. The approval is refused if the wording changed after the dialog was opened. An approver who is signed in can also approve directly.
- **Protected approved language:** approved text can't be edited. *Revise wording* starts a new proposed revision; the approved wording stays on record and is shown in History.
- **Autosave:** saves 1.2 s after typing pauses, and on leaving a field. The status shows *Saving… / All changes saved / Unsaved edits / Not saved — retry*. Rapid autosaves by one person are combined into a single version, so the history stays readable.
- **Recovery of unsaved edits:** text is mirrored to this browser while you type. After a crash, reload or lost connection, a banner offers to save or discard the recovered edits, which are highlighted in place. Closing the tab with unsaved edits triggers a browser warning.
- **Sessions:** plan a session (title, date, attendees), start it, and end it. While a session is live, every framework change is recorded in its log.
- **Facilitator panel:** Owner response capture, presenter notes for every slide, session notes, action items, supporting evidence, history, and session controls.
- **Separate audience window (optional):** *Audience window* opens a presentation-only window. It follows the facilitator's slide and refreshes when edits are saved. Drag it to a projector or second display, or share just that window in Teams.
- **Meeting summary (Word and PDF):** generated from the recorded session and editable in Word. It leads with the vision and principles with the Owner’s response to each, significant refinements, items not yet reviewed, remaining strategic questions, emerging opportunities and potential outcomes still to validate, followed by formally adopted wording, wording changes and next steps. It is marked as a draft until the session ends.

## Screen-sharing guidance (Teams)

- **Single screen:** share the browser *window* (or the screen) and use Present mode. Facilitator notes are never rendered in Present mode.
- **Two windows:** open the *Audience window* and share only that window in Teams. Keep the main window, with notes and evidence, private.
- If you share your whole screen in Edit mode, close the facilitator panel first (**N**). The panel is labelled *facilitator only* as a reminder.

## Data protection

The public demonstration build contains only synthetic data and stores it in the browser. **Real Owner workshops must run on the secure deployment** (see [DEPLOYMENT.md](DEPLOYMENT.md)). There, sessions, approvals and notes are stored server-side under project access control, and the audience window refreshes by polling.

## Known limitations

- The audience window follows the facilitator only within the same browser on the same computer. That's the intended setup: Teams sharing or an extended display. Remote attendees see the shared screen.
- Merges aren't on the Undo stack. They are confirmed explicitly, and the merged principles can be reinstated from their slides, or from *Interpret → Guiding Principles* with *Show superseded*.
- Two people editing the same field at the same moment: the second save may hit a conflict and refresh rather than merge. One facilitator edits at a time.
- Rich text (bold, bullets) isn't supported in principle wording; line breaks are.
