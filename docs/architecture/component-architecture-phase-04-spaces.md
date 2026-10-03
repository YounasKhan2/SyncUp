# SyncUp Component & File Architecture Modernization
## Phase 04 — Spaces Presentation Architecture Pass 01

## A. Baseline

Base/main: `c8ae377c756038992dd0f02fe303e66f83a6c698`; branch `refactor/syncup-spaces-presentation-pass-01`. Clean start after fetch/fast-forward. Baseline commands ran independently before production edits: typecheck exit 0; test initially exit 1 with Windows UNKNOWN opening unchanged IncomingCallBanner.tsx, unchanged retry exit 0 (207/207, zero failures/skips); architecture exit 0 (268 resolved, 21 informational, zero violations); build exit 0; Media V2 exit 0 (11/11); HTTP integration exit 0 (1/1, 34541.6529 ms). Known build warnings: large LiveKit chunk and ineffective dynamic jobStore import. No configuration/environment/assertion/limit changes.

## B. Pre-change inventory

`component-phase-04-evidence/pre-change-inventory.json` records all six TypeScript files, exports, props, import statements, hooks, refs, JSX tags/attributes, API calls, permission declarations, realtime/timers, browser resources, crypto, classes/IDs/keys/handlers and the complete stylesheet. Data comes from the base commit.

Before: SpacesPage.tsx, SharedObjectCard.tsx, SpaceVoiceChannelView.tsx, SpaceLegacyHistoryView.tsx, UpdatesPage.tsx, types.ts, spaces.css.

After: SpacesPage.tsx, SharedObjectCard.tsx, UpdatesPage.tsx, types.ts, spaces.css, components/SpaceVoiceChannelView.tsx, components/SpaceLegacyHistoryView.tsx, components/SpaceChannelHeader.tsx. No barrels or duplicate views.

## C. Risk classification

Voice welcome: low-risk callback-only display. Legacy history: bounded prepared decrypted data; MessageAttachment remains the resource owner. Header: bounded display/actions with nine props. Sidebar: retain because navigation resets, category grouping/collapse, history cursors, reloads, settings and dialog initialization stay coupled to root orchestration. SharedObjectCard retains response state/effect and object-specific decisions. UpdatesPage retains data fetching and mutation runtime. types.ts and spaces.css remain frozen.

## D. Characterization

Five additional tests first passed against untouched production: exact header children/icons/topic fallbacks/action labels for all four channel types and five roles; exact search reset order/files/settings/listen-only voice payload; sidebar ordering/collapse/selection/dialog/role visibility; complete retained/relocated source and resolved dependency parity; exact frozen header source and parent callbacks. They register through the existing Spaces UI test worker to avoid a redundant TypeScript-heavy worker. Existing assertions remain unchanged. Focused Spaces/ownership checks: 35/35 before grouping. Original characterization setup had one harness tree lookup error, corrected before production changes. Initial ownership reconstruction omitted Mic at its original import position; corrected without changing frozen hashes.

## E. Exact moves

- SpaceVoiceChannelView.tsx → components/SpaceVoiceChannelView.tsx: identical source.
- SpaceLegacyHistoryView.tsx → components/SpaceLegacyHistoryView.tsx: only MessageAttachment/shared/types relative imports adjusted to the same resolved targets.
- SpacesPage and both test fixture import sites follow these paths. Harness loads the real moved views/header and preserves the explicit MessageAttachment boundary.

## F. Sidebar

Retained verbatim. Splitting it now would require a prepared category/channel view model or a large callback/initialization contract. This pass introduces neither. Actual sidebar callbacks are characterized in the existing root harness; browser fixtures cover presentation/navigation/collapse with explicit inert boundaries.

## G. Header

SpaceChannelHeader receives channelName, channelType, topic, spaceName, prepared canEdit, onSearch, onFiles, onEdit and onJoinVoice. It renders the existing header root/children/classes/text/ARIA/type display gating. No raw state setters, effects, API calls, permission calculations or voice payload construction. All four callback closures remain exactly in SpacesPage, including the complete original voice payload and canPublish: activeChannel.can_speak.

## H. Root retained

SpacesPage remains the owner of state, effects, refs, auth/permission decisions, requests, SSE/polling, history/decryption/pagination, file panel/upload/search, object creation/responding, voice setup and all dialogs. Root line count 1156 → 1155; reduction is not a goal. Approved regions: two view import paths; new header import; removal of Mic's only root use/import; replacement of only the channel header JSX while retaining callback bodies.

## I. State/effect/ref/timer parity

AST evidence: 52 state declarations, seven effects, two refs and all non-root named runtime functions identical. Full canonical root hash excludes only the frozen approved header/import changes. Timer/event source remains exact; 15000/5000/4000 ms, cleanup/dependency order and active/abort guards retained. Evidence: root-runtime-parity.json and state-permission-event-parity.json.

## J. Permissions

Root permission expressions and missing-row initialization/fallback behavior remain exact. Owner/admin canCreateChannels is computed in root and passed as canEdit. Moderator/member/guest and view/send/speak rows preserve behavior. No client authorization reconstruction, role migration or permission defaults. Existing temporal discrepancy is intentionally frozen, rather than fixed in a structural pass.

## K. Realtime

No EventSource creation/listener/event parsing, parallel endpoint order, refresh path, polling interval, error behavior, teardown or late-result guard moved. Existing runtime tests execute these boundaries; browser fixture does not open SSE.

## L. Files/objects/voice/history

Upload intent/content/complete/reload and MIME/input reset, search/file navigation, poll/event/checklist/decision payloads and refresh order remain root-owned. SharedObjectCard is unchanged. Both voice callbacks keep their original payload. History receives prepared decrypted messages/member map/pagination state; MessageAttachment retains hydration and browser-resource responsibilities. No real media connection, crypto transport or backend resource is activated by the fixture.

## M. DOM/style parity

Frozen source and runtime harness protect the exact header DOM, sibling position, icons, child/text order, handlers, ID/ARIA/classes. Expanded CSS SHA256 `5b3f9a226487b5045f85076c98b4e284af92d79eb453437888e1368855cd0e44`; Spaces region `4028bcbccd9e7493ad4c3fdf12e1bc116735086a177e8e3968aa65d592c64ee9`; 1157 rules/4507 declarations. Tokens/primitives and index-before-App/order remain frozen. Historical Phase 10 emitted-JS hashes are preserved by reconstructing only the explicitly frozen structural header and relocation imports in the test.

Browser evidence preserves all raw captures rather than replacing the baseline: comparison.json, computed-dom-bounds.ndjson.gz, rasters.ndjson.gz and search-actions.json. All 48 after scenes equal the original pre-change DOM/computed-style/bounds at the same effective theme; 37 directly paired trees equal. Eleven System snapshots differed because browser OS preference/effective theme differed during capture (one preference changed between theme application and sampling). Effective-theme comparisons explicitly reference the already captured Light/Dark baseline, never a new baseline. Exact callbacks/sidebar/header DOM/focused-element identity match in ten actions; BODY outerHTML normalization removes only Vite script timestamps outside the fixture. All diagnostics are empty.

Raw screenshot bytes match 5/48; image equality is not claimed for the remainder. Repeated captures of unchanged production differ, including transient raster softness and screenshot API omission of the fixed fixture-controls overlay; JPEG quantization and raster dimensions remain the same. This establishes a capture instability, but does not prove pixel identity. Original and repeat images are retained for review. No production style or markup adjustment was made to mask these differences.

## N. Responsive/theme validation

Before production edits: eight seeded scenes (home/text/announcement/private/voice/history/object/collapsed) × Light/Dark/System × actual CSS/raster 1440×900 and 390×844 = 48 captures. After: same matrix. DPR 1.190000057220459; explicit viewport verified. Category/sidebar/header controls, seeded object, real voice welcome and real legacy history presentation included. System delegates to the observed OS preference; both effective themes have pre-change references. Scope is isolated presentation, not authenticated end-to-end application operation.

## O. Architecture

Client TypeScript cycle audit: 71 → 72 files, 187 → 189 resolved client import occurrences, zero cycles both sides. Added graph edges are SpacesPage → SpaceChannelHeader and header → Spaces types. Moves retain dependency targets. Cross-feature dependency ownership unchanged; no shared-to-feature or new runtime service boundary. Final architecture gate: 270 resolved edges, 21 informational cross-feature findings, zero violations.

## P. Integration

Baseline 1/1 passed through actual HTTP/Postgres/storage/call-token integration. First precommit integration run skipped (API unavailable after host resource pressure); the standard dev:server was started with unchanged existing dotenv/configuration. PostgreSQL and LiveKit containers remained running; no database reset, credential/configuration or rate-limit changes. Retry exit 0: 1/1 passed, zero failures/skips, 43560.582 ms. Earlier real run failed at the Appwrite-backed Spaces file download with ECONNRESET/500; source/configuration/assertions stayed unchanged. This gate does not establish a browser LiveKit connection or authenticated multi-user UX.

## Q. Production diff classification

1. Existing voice/history views: mechanical relocation/import updates.
2. SpacesPage view imports: mechanical import updates.
3. SpacesPage header JSX and Mic import: bounded presentation extraction.
4. New SpaceChannelHeader: bounded presentation extraction.

No other production files, CSS, type declarations, server routes, database schema, dependency manifests/locks, build/test configuration or environment files change. Test helpers/fixtures and docs are support changes only.

## R. Limitations

Raw pixel parity is not verified; browser capture instability and System effective-theme differences are explicitly recorded. Fixture home/sidebar are seeded representations; changed header and moved views execute real presentation. Full authenticated flows, live voice/media device access, multi-user SSE, real browser uploads, decryption transport and dialogs are not claimed. Standard full-suite precommit attempts initially failed with Windows process allocation errors: six workers (155/161), then one (204/205). Logs are retained; no test flags/heap overrides or assertion weakening. Five new tests were grouped into the existing UI worker. A third attempt hit spawn UNKNOWN/ENOMEM errors. The next unchanged standard run passed 212/212. Raw failed-attempt logs are retained and listed in the verification ledger.

## S. Recommended next structural phase

After external review, a bounded separate audit of Spaces dialog presentation may be considered. Permission/realtime/files/objects/voice runtime stays root-owned. No next phase begins here; PR must remain open and unmerged.

## Verification gate appendix

Precommit: typecheck exit 0; npm test exit 0, 212/212, zero failures/skips, 37647.6376 ms; architecture exit 0, 270/21/0; build exit 0 with the same two warnings; Media V2 exit 0, 11/11, zero failures/skips, 545.9547 ms. Integration retry exit 0, 1/1 passed, zero failures/skips, 43560.582 ms. verification-ledger.json records all successful and failed/skipped attempts; verification-logs.ndjson.gz preserves logs. All six commands repeat on committed HEAD; those exact results belong in the PR/final report.
