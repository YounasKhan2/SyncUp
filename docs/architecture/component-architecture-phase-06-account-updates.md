# Component Architecture Phase 06 — Account and Updates presentation

## A. Baseline

Required base/main `b27a48aab156d02ad39331eb18bb8ad1f0e0a358` was fetched, verified and fast-forwarded with a clean tree. Branch: `refactor/syncup-account-updates-presentation-pass-01`. Governing Phase 01, Phase 04 and Phase 05 reports and current production source informed this pass. Complete original sources were frozen before production edits in `tests/fixtures/account-updates-baseline.json`; their original source/digests were not refreshed from refactored HEAD. Baseline browser builds used `git archive` of that base and were captured before either extraction.

| Baseline gate | Result |
|---|---|
| npm run typecheck | PASS, client and server, exit 0 |
| npm test | PASS, 220/220, zero failures/skips; 53,958.298 ms |
| npm run check:architecture | PASS, 273 resolved edges, 21 informational, zero violations |
| npm run build | PASS, exit 0; existing chunk-size/dynamic-import warnings |
| npm run test:media-v2 | PASS, 11/11, zero skips; 223.042 ms |
| npm run test:integration | PASS, real API/database, 1/1, zero skips; 28,171.1176 ms |

## B. Account inventory

The exhaustive pre-change AST inventory, original runtime source and CSS selector/rule/media ancestry are retained in `component-phase-06-evidence/pre-change-inventory.json` and the frozen source fixture. Account had exactly three production files before this pass.

| File | Lines before/after | Export and ownership |
|---|---|---|
| client/src/features/account/AccountPanel.tsx | 234 / 231 | AccountPanel; nine state declarations, two effects, one ref, six non-root named runtime functions |
| client/src/features/account/SafetySettings.tsx | 118 / 118 | SafetySettings; eight states, one effect, useCallback refreshBlocks, three named handlers; existing security owner |
| client/src/features/account/api.ts | 35 / 35 | Six API functions; no React state/effects/refs |

AccountPanel receives user, appearance, onAppearanceChange, onClose and onSaved. It owns error, saved, loading, sessions, currentSessionId, sessionsError, avatarFile, avatarPreview and avatarBusy; avatarInput is the file-input ref. Its effects retain preview object-URL cleanup and initial session fetching with a mounted guard. loadSessions, revokeSession, saveProfile, selectAvatar, saveAvatar and removeAvatar remain in the root.

Session GET and encoded-ID revoke POST, profile PATCH, avatar upload, user GET and avatar DELETE stay in the existing Account API boundary. Avatar MIME/2 MiB validation, input resets and URL revocation remain intact. Profile inputs retain defaultValue/defaultChecked, names, validation, trimming/normalization and submit behavior. Appearance remains controlled through its existing callback and validation; persistence is owned outside the child. Dialog IDs/ARIA, class names, outside/content click handling and dismissal policy remain unchanged. No new focus management, timer, listener or storage path was introduced. SafetySettings continues to own block/report fields, errors/notices, API calls, guarded initialization and refresh. Existing API, foundation, UI-dialog, ownership and architecture tests remain active.

## C. Updates inventory

`client/src/features/spaces/UpdatesPage.tsx`: 106 to 105 lines; exported UpdatesPage receives userId, onOpenTarget and onOpenCall. Six states: stacks, activeCalls, query, filter, error and busy. One guarded initial API effect with [] dependencies and active=false cleanup; no refs, timers, polling, storage, subscription or listener. Runtime functions loadUpdates, respond and changeState remain byte-identical.

The root owns Needs You/Happening/Decided order, metadata, icons, counts and empty states; search normalization/encoding, Enter/Search refresh, All/Spaces filtering, active calls, busy/errors and exact source/call navigation. Current filtering applies to active calls; this pass preserves that behavior. SharedObjectCard remains the existing object-presentation/local-selection owner with poll/event/checklist/decision behavior and canManage=false. No object status or permission logic moved.

## D. Risk classification

Low-risk clean boundaries: the cohesive active-session list using prepared row metadata; the repeated Updates source-context/object-card/open-source article. High-risk retained regions: auth/session and API actions, avatar resource lifetime/ref, profile form/default semantics, appearance/persistence, safety/security, Updates load/mutation/refresh/search and navigation. Section-level extraction would spread grouping/count/empty/call dependencies across a larger prop contract without a clean independent boundary.

## E. Characterization

Six tests were added before production edits and passed in a 12/12 focused UI-dialog run (8,010.1682 ms). They execute the real original root source and compare current rendering/traces against it: session row order/current-device gating/date/error/empty matrices; exact encoded revoke target and refresh ordering/errors; appearance/Close callbacks; guarded session initialization and avatar URL cleanup; Updates section/item/call order/count/filter/empty/navigation; response/state payloads, query normalization, refreshed Needs You-to-Decided data, error/busy and initial-load cleanup. The final guard reconstructs the complete original source, validating full child source digests and only explicitly approved JSX/import substitutions.

The harness explicitly doubles transport, Avatar, SafetySettings and SharedObjectCard. Browser fixtures separately render real production components including those presentation components. Existing tests and all old expected hashes remain unchanged. One intermediate Updates-focused run exposed an incorrect test-only import-restoration mapping; that mapping was corrected to restore the exact original import. No production regression was found. The subsequent complete standard suite passed all 226 tests. Focused logs, including this failed intermediate attempt, are preserved.

## F. Extracted/moved components

Exactly four production paths change:

- AccountPanel.tsx: replace the sessions JSX with AccountSessionsSection and prepare rows/callbacks in the parent; replace the Monitor icon import with the local child import.
- account/components/AccountSessionsSection.tsx: cohesive list/heading/caption/error/empty/row markup with the original Monitor icon. No hooks, API/auth/storage/crypto/bootstrap/navigation ownership.
- UpdatesPage.tsx: replace each keyed updates-item article with keyed UpdateItem; replace the SharedObjectCard import with the local child import.
- spaces/components/UpdateItem.tsx: exact article/context/card/open-source markup, importing existing SharedObjectCard and its canonical SpaceSharedObject type. No hooks or runtime ownership.

No wrapper element, CSS class/ID, ARIA, child order, text or conditional product region is added or removed. Existing keys stay attached to the repeated item/row identities. No unrelated move or generic abstraction.

## G. Intentionally retained regions

Profile/appearance remain next to their form and persistence callback. Avatar markup remains with its file ref and resource lifetime. SafetySettings already has coherent security ownership and remains in its existing location. Updates root retains sections, active-call branches, counts/search/filter/error/busy and navigation. SharedObjectCard remains untouched. Further splitting these regions would add artificial contracts or distribute runtime/security ownership; no file-size target is pursued.

## H. Props/contracts

AccountSessionsSection receives rows, error and onRefresh. Each prepared row contains id, deviceName, activeLabel, isCurrent and onRevoke. The parent determines current-device equality, formats last-active time and closes over the exact revoke ID; the child only renders the prepared boolean/label and invokes callbacks. SessionRow is a local presentation shape, not a second auth/session model.

UpdateItem receives the canonical object, userId, onRespond, onStateChange and onOpen. canManage stays false. The root supplies response/state callbacks and closes over the original space_id/chat_id/message_id navigation target. No generic configuration prop bag or shared-type ownership change.

## I. State/effect/ref parity

`root-runtime-parity.json` records exact AST/source equality of all state declarations, effect bodies/dependencies/cleanup, refs and non-root named runtime functions for all four inventoried files. Account 9/2/1, Safety 8/1/0 and Updates 6/1/0 remain unchanged. New children own zero state/effects/refs/timers. Complete restored root SHA256 equals the original source SHA256. SafetySettings/api match the original entire source without substitutions. The prior Phase 04 and Phase 10 guards call the same strict restoration while retaining their original expected hashes.

## J. Auth/session/persistence parity

No auth/session ownership, bootstrap, credentials, storage/persistence, logout policy, current-session identification or revoke authorization migrated. Root current-device equality and request order/payload/error handling are exact. API and SafetySettings source remains unchanged; new children import no transport/auth module. Profile, appearance, avatar and safety logic remains under original owners. Existing encoded revoke behavior and successful/failed refresh traces match the original. Current source does not contain a separate root logout button; none is invented.

## K. Updates polling/navigation parity

The actual current Updates source has zero polling timers. Its initial guarded load and action/search refresh behavior is preserved exactly; references to historical polling do not authorize adding a timer. POST response and PATCH state payloads, then GET refresh, remain root-owned. Synthetic response refresh verifies Needs You-to-Decided transitions and failures. Navigation passes the exact object space/channel/message triple and exact active-call object. Section order, filtering scope and status display are unchanged; no realtime/media/encrypted-history/runtime changes.

## L. DOM/style/focus parity

48/48 complete browser snapshots match exactly: tags/text, all attributes/classes/IDs/ARIA, child order, input values, every enumerated computed CSS property, element bounds, theme/root attributes and focus. Each of three final screenshots rechecks the full snapshot for stability. Baseline focus is BODY, preserving existing absence of autofocus.

Four additional native Tab comparisons cover Account Refresh-to-Revoke and Updates search-input-to-Search-button at both sizes in System/OS Dark. Their complete focus path/outerHTML/DOM/styles/bounds match exactly. These use the preserved original build, not a regenerated baseline. Focus snapshots and summary are archived separately. No focus trap/restoration or Escape behavior is invented.

## M. Responsive/theme validation

1440×900 and 390×844 actual inner viewports, fixed DPR 1.190000057220459, same Codex in-app browser provider, identical isolated Vite configuration, full production CSS and identical fixture/capture procedure. Six scenes: account-sessions, account-empty, account-error, updates-items, updates-decided, updates-empty-error. Each runs Light, Dark, System/OS Light and System/OS Dark: 48 pairs total.

The shared bootstrap emulates OS matchMedia before CSS/module/theme initialization and persists page-world light/dark probes. Captures assert requested appearance, effective theme, root colorScheme and OS probes, loaded fonts, exact viewport/DPR and empty diagnostics. The real appearance helper then applies the requested preference. Account fixtures scroll the unchanged sessions region into view after fonts settle on both builds; two animation frames precede readiness. No debug/fixture overlay is rendered. Build manifests prove matching fixture/bootstrap/HTML inputs. Connection interruption required restarting the temporary server/browser; provider, DPR, viewport and verified configuration stayed identical. Original artifacts were not overwritten/regenerated from HEAD.

## N. Raster evidence

288 unmodified final screenshots: three per side for each of 48 cases. All 144 cross-build comparisons are byte-identical. All 288 same-build final-repeat comparisons are byte-identical. All 288 adjacent/last warmup comparisons are byte-identical. Every comparison was also decoded into RGB pixels with zero tolerance: 0 changed pixels, 0%, no bounding boxes/32px connected regions, no product UI touched. There are no non-identical cases to classify as harmless and no instability observed in these captures.

Raw artifacts are indexed by exact SHA256; the 768 indexed captures/snapshots/warmup manifests contain 36 unique raster byte hashes (identical theme resolutions share images). Raster deduplication preserves original bytes via base64 in rasters.ndjson.gz; snapshots, all comparison rows, complete summary and manifests are compressed alongside readable visual-summary.json. No crop/mask/threshold/pixel exclusion or baseline blessing. Product intersection analysis recognizes dialogs/session/Updates/item/card regions. Representative original/head JPEGs are included.

## O. Architecture

Architecture: 273 to 276 resolved internal edges; 21 informational dependencies unchanged; zero violations. Net +3: AccountPanel-to-session-child adds one edge; Updates root swaps its card edge for its child edge, and UpdateItem adds card/type-owner edges. Read-only existing TypeScript dependency traversal audits the client graph at base and current source: 74 files/192 resolved occurrences to 76/195; zero cycles on both sides. No feature-to-shared reverse dependency, private API leak, compatibility barrel or duplicated canonical type.

## P. Integration

| Final candidate gate | Result |
|---|---|
| npm run typecheck | PASS, client/server, exit 0 |
| npm test | PASS, 226/226, zero failures/skips; 100,749.4499 ms |
| npm run check:architecture | PASS, 276 edges / 21 informational / zero violations |
| npm run build | PASS, exit 0; existing warnings |
| npm run test:media-v2 | PASS, 11/11, zero skips; 350.2642 ms |
| npm run test:integration | PASS, real local API/database, 1/1, zero skips; 25,705.3383 ms |
| git diff --check | PASS |

After the connection interruption, the first integration invocation skipped because localhost API was offline. That invocation is retained as interrupted-integration-log.txt.gz and is not treated as passing verification. Docker Desktop resumed its existing SyncUp containers; npm start launched the unchanged compiled API with existing .env. No configuration/limit/environment/database reset was used. The rerun passed actual HTTP/database/storage/download/decryption and authorized LiveKit-token paths. Gate logs/ledger preserve baseline and successful final results. Committed-HEAD gates will be reported in the PR after the commit.

## Q. Production diff classification

Four production files only, classified individually in F. Tests add six characterization cases to an existing runner, strict original-source restoration, explicit harness doubles, isolated visual fixture/build/server/capture/pixel/archive helpers and raw evidence/report. Existing frozen Phase 04/10 hashes and all assertions remain active. CSS, tokens, permissions, auth/API bodies, realtime, timers, polling, voice/files/objects/encrypted history, shared types/contracts, server, database, packages and production configuration remain unchanged. No skipped/disabled tests accepted as final verification.

## R. Limitations

The browser run is isolated presentation with named seeded hook state and explicitly suppressed root Account/Safety/Updates API effects; real child presentation and full production CSS run normally. It does not claim authenticated browser initialization, real browser submission/upload/crypto, multi-user realtime, live media/voice or security E2E. Characterization transport and nested security/card components are explicit doubles; their unchanged source is separately protected and real presentation is captured in-browser. Integration is a real service test, not a multi-browser E2E test. The raster result establishes exactness for these fixtures/viewports/provider, not every machine/locale/scene. Session dates use the same locale/timezone on both sides; synthetic user/data contain no real account secrets.

## S. Recommendation

The clean session-list and Updates-item boundaries are organized. Remaining regions should stay under their existing runtime/security/form owners. Open this bounded PR for review, do not merge, and stop. Calls/Conversation runtime/Design System/Tailwind/palette/typography/CSS and the next phase are not started.
