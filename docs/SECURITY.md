# Security Model

## Principles

- **No real confidential content** is ingested, persisted or shared until the secure backend and access controls are deployed and verified. Demo mode is synthetic and browser-local, and it says so on every page.
- **The backend is the authority.** UI controls are hidden for convenience only. Every write is authorized and validated by the command handler; in secure mode that happens on the server, with Postgres row-level security as a second layer.
- **AI is optional and never autonomous.** Nothing the assistant produces changes project data without a human reviewer accepting it.

## Controls

| Requirement | Implementation |
|---|---|
| Approved authentication | Supabase Auth with the organization IdP (Entra ID via OAuth/OIDC, or SAML SSO) and the PKCE flow. Open sign-up disabled. Accounts link to pre-registered people by verified email. |
| Role-based authorization | `src/domain/permissions.ts` capability matrix, enforced by `applyCommand()` on the server. RLS restricts reads to project members. |
| Project / tenant isolation | `project_members` drives every RLS policy. The API checks membership before loading state. Cross-project references are rejected because relationship endpoints must exist in the same aggregate. Verified by `npm run verify:rls` and unit tests. |
| No bypass of business rules | Browsers have **no** insert/update/delete privileges on content tables (`project_state`, `project_members`, `audit_events`, `source_files`). Only the API, using the service role after authorization, writes. |
| Audit logs | Every command appends an audit entry, held both in the aggregate and in the `audit_events` table. A trigger makes that table append-only, even for privileged roles. |
| Private storage and signed URLs | Private `project-sources` bucket. Paths must start with the project id (enforced by a CHECK constraint and the API). Upload and download use short-lived signed URLs (5 min) issued after permission checks. |
| File type and size validation | MIME allow-list (PDF, PPTX, DOCX, JPEG, PNG, HEIC, text), 50 MB cap, and file-name sanitization, enforced in the zod schema, the API, the bucket configuration and a database CHECK constraint. |
| Input validation | zod schemas with length limits on every command; 1 MB request body cap; JSON parse errors rejected. |
| Secrets | Only `VITE_` public values reach the bundle: the Supabase URL and anon key, both safe under RLS. AI keys and the service-role key exist only as Edge Function secrets. `.env*` files are gitignored. |
| No open AI proxy | `/assist` accepts only fixed task names, requires the `suggestion.request` capability and an enabled project policy, and builds prompts server-side. Callers cannot send arbitrary prompts. |
| Confidential content and AI | The effective allowed classifications are the intersection of the project policy and the server's `AI_ALLOWED_CONFIDENTIALITY`. Statements from other classifications are withheld. Only counts are logged in `ai_requests`, never content. |
| Uploaded documents as untrusted input | Content is never rendered as HTML (React escapes all text) and never executed. In prompts it is wrapped in `<project_data>` and declared untrusted by a fixed system prompt. Model output is schema-validated, and suggestions that cite statements not sent to the model, or nodes that do not exist, are discarded. Tests include an injected instruction. |
| Human review | Transcription corrections are attributed and preserved. Relationships from contributors and the assistant start as *proposed*. Principle and Win Theme approval is restricted to approvers, and to the accountable approver when one is set. Driver targets are approved separately. Verification needs evidence and a reviewer. Decisions require a recommender and a *different* approver. Reports are titled DRAFT until the framework is approved. |
| Workshop approvals | A facilitator may record an approval on someone else's behalf only during a live workshop session, only for a person who holds an approval role (and is the accountable approver, if one is set), and only if the wording still matches what was shown. The record keeps both the approver and the person who recorded it. |
| Facilitator notes | Notes live in the project (visible to project members) but are never rendered in Present mode or the audience window. |
| Approved text protection | Approved Win Themes, principles and driver commitments reject edits until a revision is explicitly opened. Assistant wording suggestions cannot be applied to approved principles. |
| CSV / formula injection | Cells beginning with `= + - @` are prefixed with `'` on export. |
| Concurrency | Optimistic revision checks in both adapters and in the database update (`where revision = expected`). |
| Exports | Provenance header and footer, demo watermark, and DRAFT labelling. File names include `-DEMO` for synthetic projects. |

## Threats to re-verify when deploying

1. Run `npm run verify:rls` against the *actual* Supabase database (or adapt it to `supabase test db`).
2. Confirm `verify_jwt = true` on the function and that `ALLOWED_ORIGIN` is set to the single production origin.
3. Confirm the storage bucket is private and that no broader policies exist on `storage.objects`.
4. Confirm the service-role key is not exposed anywhere except the function secrets.
5. Pen-test the API: IDOR on project and source ids, oversized bodies, malformed commands, stale revisions.
6. Review the AI provider's data-processing terms against the organization's policy before enabling AI on any project.

## Reporting

Report suspected vulnerabilities privately to the BSA platform owner. Do not open public issues containing project details.
