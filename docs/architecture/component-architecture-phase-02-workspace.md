# Phase 02 — Workspace presentation architecture, Pass 01

## A. Baseline

Fetched origin, fast-forwarded main to the exact required `7019b4007b16da10c7c4fb489e0d16ac202dc217`, verified a clean working tree, and created `refactor/syncup-workspace-presentation-pass-01`. Read both Phase01 architecture documents, Phase6 Workspace characterization/documentation and Phase11 evidence before production changes. Foundation reference remains `fcb373aae55dabb4277903d0f5454410f7808bae`; this approved descendant changes only architecture documentation.

Independent baseline commands, before production edits:

| Command | Result |
| --- | --- |
| npm run typecheck | PASS, exit0, client/Vite/server |
| npm test | PASS, exit0, 197/197, no failures/skips |
| npm run check:architecture | PASS, exit0, 267 resolved edges /21 informational /0 violations |
| npm run build | PASS, exit0, existing LiveKit chunk and ineffective jobStore dynamic-import warnings |
| npm run test:media-v2 | PASS, exit0, 11/11, no failures/skips |
| npm run test:integration | PASS, exit0, 1/1, no failures/skips, 28241.7948ms |

Integration uses the unchanged, already running local HTTP/PostgreSQL/storage/LiveKit environment. It creates synthetic records in persistent infrastructure; no teardown/rollback claim is made. No limiter, test assertion, environment variable, product config or database semantics were changed.

## B. Workspace pre-change inventory

[Complete pre-change source inventory](component-phase-02-evidence/pre-change-inventory.json) records original paths, exports, exact import declarations and prop types, every JSX element/attribute expression, keys, refs and event handlers, extracted directly from the required Git baseline. [Frozen complete-source digests](../../tests/fixtures/workspace-presentation-baseline.json) cover all seven modules plus WorkspacePage. Paths below are relative to `client/src/features/workspace/`.

| Before path / export | Lines | Imports and prop purpose | Root and sensitive DOM contracts |
| --- | ---: | --- | --- |
| WorkspaceRail.tsx / WorkspaceRail | 41 | lucide icons, shared BrandMark/User/Avatar; user, section flags, unread count, five action callbacks | aside.primary-rail; BrandMark, four section buttons, spacer, profile button; aria-current/unread label/badge/avatar-you |
| InboxPane.tsx / InboxPane | 156 | lucide icons, shared CallRecord/Chat/IncomingRequest/Avatar, local ChatRow; existing20 broad shell props retained | aside.inbox-pane; heading, conditional search/filters, div.chat-list, conditional footnote. Calls articles/date sections, chat/request buttons retain order, keys and all labels |
| ChatRow.tsx / ChatRow | 17 | PenLine, shared Chat/Avatar; chat/draft/selected/onSelect | button.chat-list-item plus selected/has-draft; avatar, copy and metadata spans; draft truncation60 and unread count; onSelect(chat.id) |
| MobileNavigation.tsx / MobileNavigation | 39 | lucide icons; section/accountOpen/unread count/five callbacks | nav.mobile-bottom-nav; Chats/Calls/Updates/Spaces/You ordered native buttons; badge99+, aria-current account precedence |
| CallsHome.tsx / CallsHome | 24 | Phone/Video; audio/video callbacks only | section.calls-home → content/actions; two native buttons; frozen legacy encryption copy |
| IncomingCallBanner.tsx / IncomingCallBanner | 19 | shared Avatar/IncomingCall; incomingCall/onAnswer/onDecline | section.incoming-call-banner alertdialog; Avatar, copy, Answer, Decline; incoming-call-title and aria-labelledby; group avatar/copy rules |
| useWorkspaceNavigation.ts / useWorkspaceNavigation | 87 | React useState only, no arguments | No DOM/effects/API; six state values and exact asymmetric transitions |
| WorkspacePage.tsx / WorkspacePage | 505 | Existing shared/runtime and cross-feature composition imports | Fragment/skip link/main#workspace-main; exact keyed Conversation and all conditional siblings unchanged |

There are no refs in the six presentation modules. Keys live in Inbox's date sections/call articles/request rows/ChatRow placements; no key changed. There are no cross-feature imports inside the seven relocated modules: they use shared primitives/types or local ChatRow/React/icons. Cross-feature orchestration remains in WorkspacePage.

Before:

```text
workspace/
  WorkspacePage.tsx
  WorkspaceRail.tsx
  InboxPane.tsx
  ChatRow.tsx
  MobileNavigation.tsx
  CallsHome.tsx
  IncomingCallBanner.tsx
  useWorkspaceNavigation.ts
```

References requiring updates: WorkspacePage; workspace/conversation/spaces/theme preview fixtures; workspace-harness. Frozen historical ownership-baseline.json and Phase01 inventory references intentionally remain baseline evidence, not live imports. No dynamic import points at a moved module.

CSS-sensitive selectors: primary-rail/rail-item/profile-trigger and nested badge/avatar; inbox-pane/chat-list/chat-list-item.selected/has-draft; search-box > svg:first-child; call-history-list/day/item/open/copy/again; mobile-bottom-nav button/aria-current; calls-home/content/actions; incoming-call-banner descendants. Workspace grid depends on direct sibling roots and active-section modifiers. Root placement and all attributes are explicitly preserved.

## C. Characterization added

Six additional tests, first passing against untouched production:

- Five in workspace-presentation-characterization.test.mjs execute actual InboxPane, ChatRow and MobileNavigation JSX/handlers with explicit icon/avatar doubles. They protect local Today/Yesterday/This week/Earlier boundaries, section order, caller-provided row order, exclusion of tomorrow, section/article keys, parent DOM, duration/time formatting, group/direct labels and avatar policy, ongoing redial disabled/ARIA, exact chat and call-object/type callback payloads, empty Calls/Requests branches, selected/draft chat controls, badge cap and account/navigation precedence.
- One in workspace-relocation-parity.test.mjs compares complete source digests for all seven modules plus WorkspacePage. Relative import specifiers are resolved to dependency identities and only the exact seven approved relocation targets are mapped back. All remaining text, including types/props/JSX/effects/handlers/comments, must equal the frozen baseline. No compatibility copies are permitted after a move.

The existing17 Workspace tests remain intact: navigation/transitions, selected chat/history callbacks, Calls history loading/failure, update/conversion/search asymmetries, Requests/filter behavior, events/resize/keyboard/timers/cleanup, CallsHome policy and incoming banner callbacks/conditions. No duplicate orchestration assertions were added. Total standard suite197 →203. Focused Workspace/source/CSS suite31/31 after relocation.

The harness models hook slots and executes real callback bodies with explicit transport/resource doubles; it is not a React scheduler or authenticated browser. Browser validation below supplies actual DOM/style/native control evidence.

## D. Files moved

Six existing TSX files moved to `workspace/components/`: WorkspaceRail, InboxPane, ChatRow, MobileNavigation, CallsHome, IncomingCallBanner. The navigation hook moved to `workspace/hooks/useWorkspaceNavigation.ts`.

```text
workspace/
  WorkspacePage.tsx
  components/
    WorkspaceRail.tsx
    InboxPane.tsx
    ChatRow.tsx
    MobileNavigation.tsx
    CallsHome.tsx
    IncomingCallBanner.tsx
  hooks/
    useWorkspaceNavigation.ts
```

Shared-relative imports gain one `../` in WorkspaceRail/InboxPane/ChatRow/IncomingCallBanner. InboxPane's local ChatRow import stays `./ChatRow`. WorkspacePage uses direct components/hooks paths. MobileNavigation/CallsHome/hook content is byte-identical; other implementation text is identical after import canonicalization. No barrel or compatibility alias exists. Shared/feature types remain where they were.

## E. Components extracted

**None.** CallHistoryList remains inside InboxPane. This pass completes justified directory ownership with a fully mechanical production diff. The newly protected history region can be considered in a separate bounded PR after review; no grouping helpers, formatters or prepared-data contract were manufactured here. InboxPane's broad existing props are unchanged.

## F. WorkspacePage responsibilities retained

WorkspacePage505 →505 physical lines. Only six import lines change. Its complete non-import source is frozen: inbox/requests refresh, decrypted previews/search index, pending/drafts/online/appearance, queue mutex/flush/retry, calls history/incoming polling/intent/answer/decline/end/key zeroing, auth sign-out/key lock, request mutations, modal/account/navigation composition and all cross-feature owners remain at root. Conversation/Spaces/Updates/Account/CallWindow stay in their own features.

## G. Effect/timer/event parity

Effect movement ZERO; dependency changes ZERO; timer/listener/ref changes ZERO. All five WorkspacePage effects remain exact:

| Effect | Dependencies | Preserved lifecycle |
| --- | --- | --- |
| Incoming calls | [activeCall] | Immediate direct/group check unless active;3000ms interval; active guard/clear cleanup |
| Inbox/pending/outbox | [flushOutbox, refreshInbox] | 0ms timeout,15000ms interval; online/offline/syncup-outbox-wake; active guard and identical clear/remove cleanup |
| Custom close/refresh | [refreshInbox] | window syncup-close-chat /syncup-refresh-chat and same callback removal |
| Calls resize | [showCalls] | resize listener; max-width700px; no initial invocation; cleanup |
| Search shortcut | [] | Ctrl/Cmd K, case-insensitive and preventDefault, including inputs; cleanup |

All useCallback bodies/dependencies and root refs are covered by the frozen source digest. Queue backoff/idempotency, key locking/zeroing and API order are unchanged. The navigation hook has no effects and retains six state values and setter order/asymmetries; no new state was added.

## H. DOM parity

All36 captured pairs compare exactly across root and every descendant: element tags; full sorted attributes including classes/IDs/ARIA; child-node order/text; every computed property; every bound. No added wrapper, fragment, portal, ref or key changes. Presentation mount locations and conditional siblings remain in the identical WorkspacePage JSX.

Browser fixture renders real Workspace presentation and navigation. The conversation-pane region is an explicit fixture placeholder, not actual Conversation runtime. Incoming direct/group regions use the real banner. History fixture has one deterministic seeded video record; grouping corner cases are covered by the controlled-clock unit tests.

## I. CSS/style parity

CSS tracked diff ZERO, including App.css/index.css/platform/platform-shell/spaces/tokens/primitives. Phase10 tests confirm unchanged import stream,1157 rule nodes /4507 declarations and exact normalized SHA256:

| Frozen content | Digest |
| --- | --- |
| Expanded platform stream | 5b3f9a226487b5045f85076c98b4e284af92d79eb453437888e1368855cd0e44 |
| Spaces region | 4028bcbccd9e7493ad4c3fdf12e1bc116735086a177e8e3968aa65d592c64ee9 |
| tokens.css | ebdf159beeb12fbf09e13130180dabc0dcc96fc833986fe1e3c9b537468fa26d |
| primitives.css | c8537a42c94ff98ec2c421d457b729eae191fe37ab8a8e5652243ac7a67b84e1 |

All36 screenshot pairs are **byte-identical**. Thus no screenshot difference was accepted or baseline regenerated after production editing. Exact computed-style/bounds and DOM comparisons supplement screenshot evidence.

## J. Responsive/theme validation

Six states ×2 sizes ×3 themes =36 before/after pairs: inbox, selected chat, empty Calls, populated history, incoming direct banner, incoming group banner. Baseline captures were saved before moving any production file, using the same test-only extended fixture. Test-only URL controls and System option were added before capture; production remained the approved baseline.

| CSS viewport | Actual screenshot raster | Themes | Result |
| --- | --- | --- | --- |
| 1440×900 | 1440×900 | Light, Dark, System→Dark | 18/18 exact DOM/styles/bounds/screenshots |
| 390×844 | 390×844 | Light, Dark, System→Dark | 18/18 exact DOM/styles/bounds/screenshots |

Host browser devicePixelRatio1.190000057220459 meant a raw viewport override did not initially produce the required CSS dimensions. The override was calibrated to1714×1071 /464×1004; every captured innerWidth/innerHeight and decoded JPEG raster then matched the required sizes exactly. Initial failed calibration did not create a baseline record. Before/after DPR and effective System scheme are identical.

Known Calls debt remains exact: all five mobile navigation buttons share bounds approximately `[7.9963,787.5394,43.9995,56.1581]` and the nav remains compressed to approximately16px. No overlap/green/palette/contrast/typography/spacing/dialog-focus fix is included. Keyboard Calls/Updates/Spaces activation retains expected state; pointer success for overlapped individual buttons is not claimed.

After-move actual browser controls also verified audio/video callbacks, group Answer/Decline callbacks, and three mobile keyboard navigation transitions: [actions](component-phase-02-evidence/actions.json). These are fixture callbacks, not API calls or real media.

Evidence: [36-case comparisons and image hashes](component-phase-02-evidence/comparison.json); [72 complete baseline/after DOM/computed-style/bounds snapshots](component-phase-02-evidence/computed-dom-bounds.ndjson.gz), standard gzip-compressed NDJSON, one capture per line; representative unchanged images below. All completed captures report zero console/error/resource/unhandled-rejection diagnostics.

| Scene | Before | After |
| --- | --- | --- |
| Desktop Dark selected | [baseline](component-phase-02-evidence/before-1440x900-dark-selected.jpg) | [after](component-phase-02-evidence/after-1440x900-dark-selected.jpg) |
| Mobile Dark Calls known debt | [baseline](component-phase-02-evidence/before-390x844-dark-calls.jpg) | [after](component-phase-02-evidence/after-390x844-dark-calls.jpg) |

Transient validation-only failures: Vite HMR reported stale old paths while files and fixture imports were being moved. Full fresh navigation resolved those intermediate errors. Separately, the root fixture server's Windows watcher crashed with UNKNOWN lstat while the architecture tests removed their temporary `.feature-api-guard-*` directory. The owned test-only server was restarted unchanged after tests finished. An attempted blank-page capture threw before recording evidence; successful fresh captures after recovery are the comparison set. No production service was restarted, guard weakened, watcher config edited or failing screen accepted as parity. Fixture server/browser tab are closed before final command gates to avoid this test-harness collision.

## K. Architecture dependency changes

Before267 resolved edges /21 informational /0 violations → after267 /21 /0. No count change: dependency target identities are unchanged; seven paths are relocated and shared-relative import spelling is adjusted. Workspace composition exclusion remains informational only, not enforcement exclusion.

A read-only full client resolved-graph scan includes70 TypeScript files and reports zero cycles, including static/literal dynamic/type imports. Frozen source/dependency identity plus zero changes outside Workspace production confirms no new edge/cycle. No architecture guard changes or speculative private-component rules were added.

Live old-path consumers were audited with rg before/after. Frozen historical references and baseline digests intentionally keep their old names. The Phase10 Spaces-fixture emitted-JS hash test canonicalizes only the two approved WorkspaceRail/MobileNavigation import paths before hashing; the original frozen hashes/types/CSS assertions remain unchanged. This accommodates fixture relocation, not a new semantic baseline.

## L. Runtime/security-sensitive boundaries

Untouched: auth/session/refresh/key vault/E2EE, Workspace mutex/persisted drafts/outbox/decrypted preview coordination/call token/key transfer/sign-out, Conversation/Spaces runtimes and permission logic, Media V2/IndexedDB/OPFS/workers, CallWindow/LiveKit/group crypto, all server/API/schema/migration/PostgreSQL transaction semantics. No type migration or duplicate aliases. No feature concept promoted into shared.

## M. Production diff classification

| Production file/change | Classification |
| --- | --- |
| WorkspaceRail→components/WorkspaceRail | Mechanical file move + shared import path update |
| InboxPane→components/InboxPane | Mechanical file move + shared import path update; local ChatRow unchanged |
| ChatRow→components/ChatRow | Mechanical file move + shared import path update |
| MobileNavigation→components/MobileNavigation | Mechanical file move, byte-identical |
| CallsHome→components/CallsHome | Mechanical file move, byte-identical |
| IncomingCallBanner→components/IncomingCallBanner | Mechanical file move + shared import path update |
| useWorkspaceNavigation→hooks/useWorkspaceNavigation | Mechanical file move, byte-identical |
| WorkspacePage | Six mechanical direct import updates only |

Other changes are test support (six new cases/frozen hashes, four fixture import updates plus Workspace fixture System/scene/history controls, harness path updates and narrowly canonicalized historical fixture JS imports) or validation documentation/evidence. Behavior changes ZERO; styling/CSS changes ZERO; runtime lifecycle changes ZERO; API/server/database/schema/migrations/package/lockfile/config changes ZERO. No production extraction.

## N. Verification results

Post-move precommit checks passed independently: typecheck;203/203 standard tests; architecture267/21/0; client/server build with unchanged warnings;11/11 Media V2. Focused31/31 tests also passed. Source/DOM/styles/bounds/images, frozen CSS hashes and resolved graph are verified above. Commit uses `refactor: organize Workspace presentation architecture` only after those checks.

At final committed HEAD repeat independently: npm run typecheck; npm test; npm run check:architecture; npm run build; npm run test:media-v2; npm run test:integration; git diff --check; git status. Final HEAD outcomes are recorded in the PR/completion report without amending production to make a failing gate pass. Working logs are under `.git/component-phase02-*`; baseline/final results are distinct.

## O. Limitations/unexecuted E2E

Browser lane is isolated presentation/React, not authenticated Workspace or real call media. Conversation content is a fixture placeholder. It does not exercise live outbox durability, IndexedDB/OPFS recovery, auth cookie races, concurrent refresh, full real DM/group delivery, multi-party group E2EE/remote audio-video, media device failures, or full accessibility/contrast. Those Phase11 gaps remain explicit; unchanged source and real integration are additional bounded evidence, not substitutes for unexecuted E2E. History unit icon/avatar implementations are doubles; browser uses real icons/Avatar. System tested the host's Dark scheme, not a live OS-scheme toggle.

## P. Recommended next structural phase

After review, consider a separately scoped Inbox call-history presentation extraction using the new grouping/format/payload characterization, or the Phase01-planned Conversation visual search region. Do not bundle runtime/effect/state redesign with either. Current phase stops after opening its PR: no merge, Conversation restructuring, styling/Tailwind/Design System work or known UX fixes.
