# Phase 05 — Spaces Dialog Presentation Pass 01

## A. Baseline

Required main/base `558d9764a44fafe2b991315c20bd7a16e86f5325` verified after fetch/fast-forward with a clean tree; branch `refactor/syncup-spaces-dialogs-pass-01`. Read Phase 01 contract, Phase 04 reports/correction and the actual current SpacesPage. Before production edits, all six standard commands passed: typecheck; 215/215 tests, zero failures/skips (34,038.2626 ms); architecture 270 edges / 21 informational / zero violations; build with existing warnings; Media V2 11/11 (259.2021 ms); real integration 1/1, zero skips (36,511.2968 ms). No configuration/assertion/limit/environment changes.

## B. Dialog inventory

`pre-extraction-inventory.json` freezes every surface's literal root/attributes/inputs/handlers/markup and applicable CSS selectors/rules. `spaces-dialog-baseline.json` contains the complete original root source directly from the required base, including opening state, initialization, permission expressions, setters, API/mutation functions, busy/errors, realtime/resources and sibling placement. Original source is independently checked against git show. Seven overlay shells, one inline creation form and two contextual menus:

| Surface | Opening/values | Closing, submit, dependency and classification |
|---|---|---|
| Space creation, inline form | No selected Space; spaceName/description/icon | No modal closing; createSpace POST/list reload/reset/loadSpace. Controlled form + mutation/orchestration; retain root icon helper and workflow. |
| Search Space | searchOpen; query/date/from/content/object filters/results/submitted | Backdrop target equality/Close set false and retain filters/results. searchSpace API, mutual filter exclusion, result navigation/download; permission/resource/orchestration coupling. Retain. |
| Channel files | filePanelOpen; active channel/files/error/busy | Backdrop/Close set false. openFilePanel loads; upload uses fileInput ref, permissions, MIME/storage/media/resources; resource/permission sensitive and frozen. Retain. |
| Create channel | channelDialogOpen && canCreateChannels; name/type/topic/categoryId | Backdrop/Close only set false, without reset; autoFocus name. Root createChannel POST/reset/close/loadSpace/select/loadSpaces; controlled form, mutation remains parent. Extract presentation. |
| Create category | categoryDialogOpen && canCreateChannels; categoryName | Backdrop/Close only set false, without reset; autoFocus name. Root createCategory POST/reset/close/loadSpace/select-category; controlled form, mutation remains parent. Extract presentation. |
| Shared item poll/event/checklist | objectDialogType + selected Space/channel; title/options/flags/date/location/items/assignee | Backdrop/Close resetObjectForm resets all values; createSharedObject constructs discriminated/temporal payload and refreshes. Functional option updates, member options, permission/temporal/mutation coupling. Retain every branch and frozen temporal discrepancy. Decision creation remains pinDecision/native prompt, not a rendered dialog. |
| Space settings overview and People & invites | spaceSettingsTab; edited space object, inviteUsername/role/channels, canInvite | Backdrop/Close clear tab then loadSpace. Overview API/icon helper/member list/role-restricted invites/channel grants; mutation/permission/orchestration sensitive. Retain both tabs. |
| Channel settings overview and permissions | channelSettingsTab && canCreateChannels && activeChannel; topicDraft/permissionDraft | Backdrop/Close clear tab; tabs call openChannelSettings initialization/reset. Topic PATCH, permission update/save/fallback/role rules; permission/security/mutation sensitive. Retain both tabs. |
| Shared item menu, inline | objectMenuOpen; poll/event/checklist actions | Root object form initialization/toggle; contextual orchestration coupling. Retain. |
| Mention listbox, inline | mentionMenuOpen; active-channel members/everyone | Root draft insertion/toggle and permission gating; composer coupling. Retain. |

All overlays are `div.overlay.space-dialog-overlay[role=presentation]` with direct modal `section[role=dialog][aria-modal=true]`, without portals. They are siblings after the detail error in search → files → channel → category → object → Space settings → channel settings order. Classes, labels/IDs, input attributes, selected options, errors/busy/button order and hierarchy are frozen. Neither extracted dialog has an existing Escape handler, focus trap or Cancel button; none is added. Backdrop behavior is mousedown target/currentTarget equality only. CSS mapping covers overlay/panel/form/fields/hints/buttons/tabs/member/grant/permission rows and responsive/theme ancestors. Busy/error stay shared root state, including the original detail-error suppression expression and category behavior.

## C. Risk classification

Channel/category creation expose coherent prepared form values and callbacks with no child state/effects. Other candidates mix edited server data, authorization, temporal payloads or browser/storage resources. A large region alone is not an extraction reason; no giant SpacesDialogs prop bag or target line count.

## D. Characterization

Five tests were added through the existing Spaces UI worker before production edits. They cover exact original runtime root/child/ARIA/options/values/error/busy/role visibility across both dialogs, four channel types, five roles and busy states; target-gated backdrop/Close/controlled updates/no new Escape or Cancel; exact success/error submit payload and complete state/API trace; opening category initialization/error reset; whole-root byte parity outside frozen approved JSX/imports. Tests execute original base source and current production with real extracted children. Pre-extraction focused suite 21/21 passed. An initial cross-realm array-prototype comparison was corrected to plain serialized markup before edits; no assertions weakened. Channel then independently passed typecheck and 29/29 focused checks; category subsequently passed the same gates.

## E. Extracted dialogs

`components/CreateChannelDialog.tsx` and `components/CreateCategoryDialog.tsx` return the exact previous overlay/modal roots. SpacesPage changes only two imports and two frozen JSX regions. Line count 1155 → 1143; reduction is not a goal. No wrapper, portal, outer visibility condition or sibling placement changes.

## F. Intentionally retained dialogs

Search/files/shared objects/Space settings/channel settings/permission editor/member-invite form/inline Space creation/contextual menus remain root-owned for the coupling recorded above. The permission editor's missing-row fallback, reset/save, view/send/speak values and owner/admin/moderator restrictions are not normalized or fixed.

## G. Props/contracts

CreateChannelDialog: categories, categoryId, name, topic, type, error, busy, four value callbacks, close and submit (13 coherent form props). CreateCategoryDialog: Space name, name, error, busy, name callback, close and submit (7 props). Canonical SpaceCategory/SpaceChannel types are imported from ../types; only component-local props types are new. No setters, API clients or raw role decisions are passed.

## H. State ownership

All 52 state declarations and both refs remain root-owned and byte-identical. The children have no state/effects; mount/reset behavior and controlled values stay with the existing owner.

## I. Callback ownership

Parent closures retain normalization/setters and existing submit functions. Child adapters read raw input values, pass the original submit event or gate backdrop target equality and forward Close. Exact original/current state/API traces prove success/error/reset/refresh ordering. Closing retains fields/error/busy; no new reset or closing behavior. All named API/mutation functions are unchanged.

## J. Permission parity

canCreateChannels remains root-derived and both original outer conditions remain literal. Neither child receives raw roles or evaluates authorization. All permission/invite/grant logic remains root-owned, with no permission or server API changes.

## K. Runtime parity

Seven effects, two refs and all 28 non-root named functions match exact source; 52 useState calls stay in their original positions. Strict restoration reverses only frozen JSX replacements/imports, validates complete child source hashes and requires the original entire root SHA256. Prior Phase 04/Phase 10 tests use this restoration while preserving their original expected hashes. Effects/dependencies/cleanup/EventSource/listeners/polling/timers 15000/5000/4000, encrypted history, files/storage, objects and both voice payloads remain unchanged.

## L. DOM/style/focus parity

40/40 whole-root paired snapshots match exactly: every descendant attribute/class/ID/ARIA, text and child order, controlled values, every computed style property, floating-point bounds, root theme attributes and focused-element tag/markup/path. State is rechecked after every final screenshot. Actual autofocus selects the original name input in both dialogs, including busy/error and voice-select states. The browser fixture renders the real entire SpacesPage with named state seeding and explicitly suppressed root effects at test-build time; it does not reconstruct dummy dialog JSX.

## M. Responsive/theme validation

40 original cases captured before production edits: five states (channel, channel voice choice, channel busy/error, category, category busy/error) × 1440×900 / 390×844 × Light / Dark / System OS-Light / System OS-Dark. Same IAB/tab/configuration, DPR 1.190000057220459, actual CSS/raster dimensions and capture procedure. Host-scaled viewport requests 1714×1071 and 464×1004 are asserted to produce the required actual dimensions. Corrected Phase 04 bootstrap runs before CSS/module, stabilizes application matchMedia color queries, delegates unrelated queries and asserts effective theme/colorScheme/query probes/font readiness/diagnostics. Native CSS-media emulation is not claimed; the unthemed-root fallback is inactive before CSS loads. No fixture/debug controls overlay exists. Three consecutive stable warm-ups precede three final repeats; every frame is retained.

## N. Architecture

Guard: 270 → 273 edges, 21 informational cross-feature findings, zero violations. New edges are SpacesPage → each dialog and CreateChannelDialog → canonical Spaces types. React/lucide are external. Read-only client audit: 72 → 74 files, 189 → 192 import occurrences, zero cycles before/after. Existing cycle-audit algorithm reused with current base; no new shared-to-feature or cross-feature boundary.

## O. Production diff classification

Exactly three production files: SpacesPage's two approved presentation regions/imports, new CreateChannelDialog and new CreateCategoryDialog. Mechanical controlled presentation extraction only. No CSS/shared or domain type contract/server/database/migration/API/crypto/runtime/package/lock/configuration/environment changes.

## P. Limitations

Browser effects are explicitly suppressed and data seeded; no authenticated browser initialization, browser Enter/network submission, live voice/media, multi-user realtime, real browser encryption/upload or focus-trap behavior is claimed. Runtime submit tests use explicit transport doubles; full integration separately exercises real HTTP/database/storage/token paths. Raster variability is quantified below and not silently excluded.

## Q. Recommendation

Stop after the two clean forms. Remaining settings/permission/member/object surfaces need a separately justified contract. PR must remain open/unmerged; no further decomposition, state/permission relocation, CSS/Tailwind or Design System phase starts.

## Raster results and preserved repeats

40 cases × base/HEAD × three final repeats = 240 final JPEGs. All raw frames, exact snapshot JSON and warm-up manifests are indexed (689 artifacts, 44 unique raster byte hashes); no crop, mask, tolerance, CSS injection or image editing. `rasters.ndjson.gz` deduplicates only exact bytes; `artifact-manifest.json.gz` maps every path to hash. Four unedited representative screenshots are included. Build manifests preserve base source/fixture/bootstrap/HTML hashes; the original base static build and baseline captures were never regenerated after production edits.

**168/360 decoded comparisons are byte/pixel-identical**. Of the other comparisons, **57** are cross-build final pairs and **135** are same-unchanged-build repeats. Warm-up comparisons: 289 total, 52 differences. Pixel equality is not claimed for the entire matrix. Every cross-build unequal pair is reproduced by the **exact same unordered pair of image SHA256 hashes** in a same-build repeat or warm-up comparison (**57/57**); this is stronger than merely similar pixel counts. `same-build-repeat-proof.json.gz` explicitly pairs every cross-build failure with its same-build proof, including paths, hashes, zero-tolerance changed count/percentage, exact half-open bounding box, connected 32px tile regions and product-region intersections.

Most differences fall around the focused input caret region (examples: 487 pixels = 0.03757716049382716%, bbox [624,431,648,456]; 228 pixels = 0.017592592592592594%, bbox [576,448,584,480]). These touch actual form UI. One larger mobile Dark/channel-voice transient touches the submit-button region: **14,163 pixels = 4.302770689026613%, bbox [31,623,360,689]**. It also reproduces with the exact same two raster hashes on the unchanged build; no input-only explanation is assigned to this larger result. Complete readable cross-build counts/percentages/regions are in `visual-summary.json`, and every repeat/warm-up comparison is archived compressed. Three consecutive identical warm-ups do not suppress later caret or backend raster differences; those final differences remain visible in the reports. Structural equality and exact same-build reproduction support presentation parity, without classifying all raster differences harmless or asserting universal screenshot determinism.

## Final verification gates

On the final production candidate, independently with the unmodified standard commands:

| Gate | Result |
|---|---|
| npm run typecheck | PASS, exit 0, client/server |
| npm test | PASS, exit 0, 220/220, zero failures/skips; 65,806.2385 ms |
| npm run check:architecture | PASS, exit 0, 273/21/0 |
| npm run build | PASS, exit 0; existing large-chunk and ineffective jobStore dynamic-import warnings |
| npm run test:media-v2 | PASS, exit 0, 11/11, zero failures/skips; 420.2261 ms |
| npm run test:integration | PASS, exit 0, 1/1, zero failures/skips; 41,151.9991 ms |
| git diff --check | PASS |

Baseline and final gate logs and per-dialog focused logs are archived in verification-ledger.json / verification-logs.ndjson.gz. Integration reached actual HTTP/Postgres/object storage/download/decryption/LiveKit-token paths; this is not a browser media session or multi-user browser E2E claim. No API service reset, rate-limit override, environment/configuration or database reset was used. The test's ordinary synthetic integration records follow the existing test behavior.

## Production diff classification and frozen paths

1. SpacesPage: add two imports and replace exactly two approved dialog JSX regions. Outer visibility conditions, sibling position, name normalization, close state changes and submit callback targets stay parent-owned.
2. CreateChannelDialog: exact extracted controlled form; child event adapters forward raw values/submit event and gate backdrop equality, with no new authorization/mutation/lifecycle.
3. CreateCategoryDialog: exact extracted controlled form under the same contract.

Every other production path is unchanged. CSS, types.ts/shared contracts, server, SQL/migrations/database, API/crypto/media/voice/realtime/polling/history/object mutation, packages/locks/configuration/environment are frozen. Test-only adapters strictly reconstruct the approved dialogs before earlier frozen Phase 04/Phase 10 hashing, retaining original hashes/assertions and additionally requiring full extracted child-source hashes and complete root byte equality. Pixel analysis now identifies dialog/overlay bounds from the already captured exact tree and retains source paths, so product intersections and warm-up/final file identities are explicit.

No further extraction, state/permission relocation, CSS work, Tailwind or Design System work is started. Open this branch as a PR against main and leave it unmerged for review.
