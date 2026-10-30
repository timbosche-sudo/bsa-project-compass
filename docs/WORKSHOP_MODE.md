# Owner Alignment Workshop Mode

Workshop Mode is used live in meetings with Owners to present, discuss, wordsmith and formally adopt the **Win Theme** (why the project matters) and the **Guiding Principles** (what success looks like). Design Drivers (how we design for success, with measurable criteria) remain in the Design Driver register and keep their links to the principles.

Open it from **Owner Workshop** in the navigation, or from **Vision & Principles → Open Owner Workshop**. URL: `/projects/<id>/workshop`.

## Same data, no synchronization

Workshop Mode is another view onto the same project data. Every change goes through the same command handler as the rest of Project Compass. That covers editing, statuses, approvals, duplicating, merging, deleting and reordering. Edits appear immediately in Vision & Principles, the Overview, the Traceability Matrix, reports and the audience window. Nothing needs exporting or synchronizing by hand.

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
| P | Present |
| E | In Present mode: toggle in-place editing |
| Esc | Finish in-place editing; press again to return to Edit mode. In a text field it cancels the edit |
| F | Toggle browser full screen |
| N | Show or hide the facilitator panel |
| Ctrl/⌘+Z, Ctrl/⌘+Shift+Z or Ctrl+Y | Undo / redo workshop changes (inside a text field, the browser's own text undo applies) |
| Ctrl/⌘+Enter | Finish editing a multi-line field |
| Alt+↑ / Alt+↓ | Move the current principle earlier or later |

## Capabilities

- **Presentation-quality slides:** title, one slide per Win Theme alternative, a principles overview, one slide per principle, and live outcomes. Typography scales with the slide (container query units), so it reads the same on a 13" laptop, a Teams share or a conference display.
- **Inline editing:** titles, statements, intents and Win Theme narratives, styled exactly as presented.
- **Add, delete, duplicate, merge and reorder.** Delete moves the item to recoverable trash (Undo brings it back); approved items can't be deleted and are marked *Not Adopted* or superseded instead. Duplicate carries the evidence links over. Merge moves evidence, Design Drivers and decision links to the combined principle, and keeps the merged principles as superseded, where they can be reinstated. Reorder works by drag and drop in the slide rail, the arrow buttons, or Alt+↑/↓.
- **Undo/redo and revision history:** undo and redo cover edits, status changes, add, duplicate, delete and reorder. Every change is also in the item's version history (facilitator panel → History), with restore.
- **Review statuses:** Proposed, Discussing, Needs Refinement, Approved, Not Adopted (plus Superseded for history).
- **Owner approval of the exact wording:** *Record approval* shows the exact text to be adopted. The facilitator selects the Owner approver, who must hold an approval role and be the accountable approver if one is set, then confirms. The record stores the frozen wording, approver, person recording, time, version and session. The approval is refused if the wording changed after the dialog was opened. An approver who is signed in can also approve directly.
- **Protected approved language:** approved text can't be edited. *Revise wording* starts a new proposed revision; the approved wording stays on record and is shown in History.
- **Autosave:** saves 1.2 s after typing pauses, and on leaving a field. The status shows *Saving… / All changes saved / Unsaved edits / Not saved — retry*. Rapid autosaves by one person are combined into a single version, so the history stays readable.
- **Recovery of unsaved edits:** text is mirrored to this browser while you type. After a crash, reload or lost connection, a banner offers to save or discard the recovered edits, which are highlighted in place. Closing the tab with unsaved edits triggers a browser warning.
- **Sessions:** plan a session (title, date, attendees), start it, and end it. While a session is live, every framework change is recorded in its log.
- **Facilitator panel:** private notes per item and for the session, action items, supporting evidence, history, and session controls.
- **Separate audience window (optional):** *Audience window* opens a presentation-only window. It follows the facilitator's slide and refreshes when edits are saved. Drag it to a projector or second display, or share just that window in Teams.
- **Meeting summary and PDF:** generated from the recorded session. It covers attendees, adopted items with their exact approved wording and approver, items needing refinement with notes, items still in discussion, items not adopted, items added, before/after wording changes, merges and deletions, action items and notes. It is titled DRAFT until the session ends.

## Screen-sharing guidance (Teams)

- **Single screen:** share the browser *window* (or the screen) and use Present mode. Facilitator notes are never rendered in Present mode.
- **Two windows:** open the *Audience window* and share only that window in Teams. Keep the main window, with notes and evidence, private.
- If you share your whole screen in Edit mode, close the facilitator panel first (**N**). The panel is labelled *facilitator only* as a reminder.

## Data protection

The public demonstration build contains only synthetic data and stores it in the browser. **Real Owner workshops must run on the secure deployment** (see [DEPLOYMENT.md](DEPLOYMENT.md)). There, sessions, approvals and notes are stored server-side under project access control, and the audience window refreshes by polling.

## Known limitations

- The audience window follows the facilitator only within the same browser on the same computer. That's the intended setup: Teams sharing or an extended display. Remote attendees see the shared screen.
- Merges aren't on the Undo stack. They are confirmed explicitly, and the merged principles can be reinstated from their slides, or from Vision & Principles with *Show superseded*.
- Two people editing the same field at the same moment: the second save may hit a conflict and refresh rather than merge. One facilitator edits at a time.
- Rich text (bold, bullets) isn't supported in principle wording; line breaks are.
