# Phase 6 — Workspace decomposition, Pass 01

Baseline: `e7779cc21c501e1d0c33772f598561e35e3d14ca` (merged Phase 5).
Branch: `refactor/syncup-workspace-decomposition-pass-01`.
Baseline clean; typecheck, 73 unit tests, architecture guard (253 edges), client/server build passed.

## Responsibility audit and ownership

Every baseline owner below is WorkspacePage. The audit selected navigation and two
render-only regions. Existing WorkspaceRail, InboxPane, MobileNavigation and ChatRow
interfaces and implementation remain unchanged.

| Responsibility / state | Risk | Selected? | Final owner |
|---|---|---|---|
| Current user, account panel, appearance preference/application | Medium | No | WorkspacePage |
| Inbox chats, requests, filter, error | High | No | WorkspacePage |
| Searchable-message index and update callback | Medium | No | WorkspacePage |
| Calls/Updates/Spaces/Requests flags, active chat, update target | Low, observable asymmetries | Yes | useWorkspaceNavigation |
| Chats/select chat/Calls/Updates/Spaces/target/conversion/search transitions | Low, desktop/mobile parity required | Yes | useWorkspaceNavigation; caller retains domain work |
| Pending messages, drafts, online state, flushing guard | High | No | WorkspacePage |
| Call history and refresh | High | No | WorkspacePage |
| Call intent, consumption, new-call type/request, redial/start policy | High | No | WorkspacePage |
| Incoming and active call state | High | No | WorkspacePage |
| Inbox refresh, draft loading, encrypted preview decryption | High | No | WorkspacePage |
| Outbox send/removal/retry/backoff and active-chat dispatch | High | No | WorkspacePage |
| Initial load and periodic refresh/outbox effect | High | No | WorkspacePage |
| Online/offline and outbox-wake listeners | High | No | WorkspacePage |
| Incoming-call polling effect | High / security-sensitive | No | WorkspacePage |
| Close-chat / refresh-chat listeners and dispatch sites | Medium | No | WorkspacePage |
| Calls resize effect | Low, closure-sensitive | No | WorkspacePage |
| Ctrl/Cmd K shortcut effect | Low | No | WorkspacePage |
| Request accept/ignore transport and refresh sequencing | High | No | WorkspacePage |
| Sign-out POST → key lock → callback, failure handling | High | No | WorkspacePage |
| Group/direct acceptance, E2EE support/key unwrap and failed-join leave | High / security-sensitive | No | WorkspacePage |
| Decline/end/leave/finished call, zeroization, history/inbox refresh | High / security-sensitive | No | WorkspacePage |
| Calls home markup and audio/video buttons | Low | Yes | CallsHome |
| Incoming banner markup, avatar/label and Answer/Decline buttons | Low | Yes | IncomingCallBanner |
| Shell ordering, mounting conditions, rail/inbox/mobile/footer | Medium | No | WorkspacePage |
| Account/new-conversation/search/request/CallWindow/Spaces/Updates composition | Medium | No | WorkspacePage |
| Modal state: newConversation, searchOpen, initialUsername, accountOpen | Medium | No | WorkspacePage |
| Direct feature transport calls | High | No | WorkspacePage |

## Selected boundaries

`useWorkspaceNavigation.ts` owns six related local React state values and their
Workspace-specific transitions. It imports only React, accepts no argument bag,
owns no effects, and performs no API, crypto, outbox or domain work. Existing
setShowRequests/setShowCalls/setActiveChatId remain available where orchestration
needs them. Functions remain ordinary render-created functions: no new useCallback,
refs, context, router, external store or runtime dependencies.

`CallsHome.tsx` owns the existing Calls home markup. It accepts audio/video callbacks,
owns no state/effects, and imports only lucide icons. WorkspacePage retains startNewCall
policy and modal intent; existing native buttons, classes, copy, icons and geometry
are preserved.

`IncomingCallBanner.tsx` owns the existing banner markup. It receives IncomingCall
and Answer/Decline callbacks, imports shared Avatar and the IncomingCall type, owns
no state/effects, and does no transport, polling, key handling or policy. The parent
retains the incomingCall && !activeCall mounting condition and void async invocation.

## Navigation parity (before = after)

Unmentioned state is deliberately retained. Calls/Updates/Spaces/Requests below
refer to their boolean flags, not domain data. Setter order is preserved.

| Trigger | State changes | Caller work retained |
|---|---|---|
| Chats, rail/mobile; Spaces back | All four flags false; active chat null only at max-width 700px; retain target | None |
| Select chat / call-history chat | All four flags false; set selected active chat; retain target | None |
| Calls, rail/mobile | Calls true; other three false; active chat null only at max-width 700px; retain target | Refresh direct/group history, same failure handling |
| Updates, rail/mobile | Updates true; other three false; active chat null; target null | None |
| Spaces, rail/mobile | Spaces true; other three false; active chat null; target null | None |
| Open update target | Updates false, Calls false, Spaces true, Requests false; chat null; exact three IDs | None |
| Open update call | Space call uses update target with empty message ID; direct call uses select chat | None |
| Group converted | Calls false, Updates false, Requests false, Spaces true; chat null; target with empty message ID | requestInboxRefresh after all setters |
| Search result → chat | Calls/Requests false; set active chat; **retain Updates/Spaces and target** | Close search before navigation setters |
| Requests entry | Requests true; **retain all other navigation state** | Filter = all |
| Requests close / select request / filter | Requests false; retain other navigation state | Set selected filter where applicable |

Request acceptance, new-conversation creation, call acceptance and redial retain
their current parent-owned sequencing and asymmetric direct setters. No navigation
semantics changed.

## Effect, dependency and timer parity

No effects moved. Each original effect body and dependency expression remains in
WorkspacePage. Moving local state into a custom hook preserves stable React setter
identity; no action function was added to an effect dependency array.

| Effect | Before dependencies | After dependencies | Lifecycle |
|---|---|---|---|
| Incoming calls | [activeCall] | [activeCall] | Immediate direct/group poll unless active call; 3000 ms; active guard and clearInterval |
| Initial inbox/pending, refresh/outbox and online/wake | [flushOutbox, refreshInbox] | [flushOutbox, refreshInbox] | setTimeout 0 ms; setInterval 15000 ms; active guard; same clear/remove cleanup |
| Close / refresh chat | [refreshInbox] | [refreshInbox] | Same window registration/removal with identical callback |
| Mobile Calls resize | [showCalls] | [showCalls] | Same window resize, exact media query, no initial invocation |
| Global search | [] | [] | Same window keydown registration/removal |

`flushOutbox` retains [activeChatId, refreshInbox]; `refreshInbox` and
`refreshCallHistory` retain []; `requestInboxRefresh` retains [refreshInbox];
`updateSearchableMessages` and `consumeCallIntent` retain []. No moved timers,
consolidation, scheduling changes or stale-closure workaround.

## Event contracts

All owners before and after are WorkspacePage. Every listener is on window and
cleanup removes the identical callback from that same window. Behavior is unchanged.

| Event | Registration / cleanup | Behavior |
|---|---|---|
| syncup-close-chat | closeChat / remove closeChat | Only activeChatId = null |
| syncup-refresh-chat | refreshChat / remove refreshChat | void refreshInbox; dispatch remains after successful active-chat outbox send and in endActiveCall finally |
| syncup-outbox-wake | wake / remove wake | void flushOutbox |
| online | updateOnline / remove updateOnline | Set navigator.onLine; flush only if online |
| offline | updateOnline / remove updateOnline | Set navigator.onLine; flush only if online |
| resize | adjustMobileCallsView / remove same | If showCalls && matchMedia('(max-width: 700px)').matches, clear chat |
| keydown | openSearch / remove openSearch | Ctrl or Meta + case-insensitive K; preventDefault; open search even in input; no Escape addition |

## Characterization approach and limitations

17 tests in `tests/workspace-characterization.test.mjs` were first green against
the original page. The same tests execute the real page and extracted modules after
movement. They exercise rendered callback props, observable state/transport calls,
listener registration/removal and timer scheduling, not file existence/line counts.
The harness transforms state declarations into named isolated slots so extraction
does not couple assertions to hook ordering. It runs production callback bodies;
it does not model React scheduling, concurrent rendering, DOM focus or authenticated
server behavior. React/browser checks and mechanical dependency review supplement it.
Existing Phase 2–5 assertions and harnesses remain unchanged.

The 17 new cases protect: (1) Chats desktop/mobile; (2) chat/history selection;
(3) Calls entry and direct/group history refresh; (4) history failure;
(5) Updates entry; (6) Spaces entry; (7) update target IDs; (8) update call routing;
(9) group conversion before refresh; (10) search asymmetry; (11) Requests/filter/close;
(12) custom close/refresh event cleanup; (13) conditional mobile resize and cleanup;
(14) Ctrl/Cmd K, input targets and cleanup; (15) timer registration/cleanup and active-call
poll suppression; (16) audio/video callbacks and existing busy-call policy;
(17) incoming banner direct/group labels/avatar/decline, direct answer and active-call hiding.

## Frozen runtime and dependency direction

refreshInbox, encrypted preview decryption (including "Encrypted message" fallback),
flushOutbox/retry/backoff, pending/drafts, call polling/accept/decline/end/cleanup,
group E2EE support and key zeroization, sign-out and their API requests remain in
WorkspacePage. No runtime/domain semantics changed. No server, migration, crypto,
media, Conversation, Spaces, theme/CSS, primitive or appearance lifecycle edits.

WorkspacePage → Workspace-owned navigation/presentation → explicit callbacks or
shared presentation types/Avatar. No new private cross-feature API imports; Phase 5
architecture rules stay unchanged. Existing orchestration cross-feature imports
remain deliberately at WorkspacePage.

## Rejected/deferred boundaries and remaining debt

Global shortcut/resize extraction would add an unnecessary fourth module in this
pass; both simple effects stay next to shell orchestration with exact dependencies.
Inbox refresh/decryption, outbox ownership/retries, call orchestration, searchable
index, request/modal orchestration, direct API calls and shell composition remain
for separately characterized future passes. No generic useWorkspace god hook.
Phase 2 persistence/account ownership, media runtime ownership, refresh divergence
and concurrency, Spaces fallback and temporal discrepancies remain frozen.

## Verification and UI evidence

WorkspacePage: **566 → 505 lines**, excluding the final newline. Removed ownership:
six navigation state values/transitions and two pure presentation regions. Retained
ownership is listed above; the result is judged by responsibility boundaries.

After navigation extraction: focused 17 Workspace tests, root typecheck and all
90 unit tests passed. After presentation extraction: those same checks passed.
Mechanical review against the pinned baseline confirmed all five useEffect bodies
and dependency expressions identical, all 16 retained named runtime functions/
useCallback expressions identical, and expanded rendered trees/props identical for
Calls home and direct/group incoming banners (callback behavior separately tested).

`tests/fixtures/workspace-preview.html` + `.tsx` render the real navigation hook,
CallsHome, IncomingCallBanner, rail, inbox and mobile navigation. Browser checks at
1440×900 and 390×844 exercised light/dark presentation, audio/video/Answer/Decline
callbacks, desktop active-chat retention, mobile Calls chat clearing, and navigation
via pointer/keyboard. Incoming banners retain their compact desktop / full-screen
mobile forms. Screenshots are saved in the current Codex visualizations directory
with `phase6-*` names. The fixture has a visible test-control overlay.

**Existing mobile CSS limitation retained:** at 390px the later `.calls-home`
display:grid / grid-column:3 rule overrides the earlier mobile display:none rule,
creating an implicit grid and compressing mobile navigation to 16px. Pointer
activation can hit overlapping navigation buttons; keyboard activation verifies
the intended callbacks. A temporary fixture rendered the original baseline JSX
regions from Git and reproduced exactly the same display, column and nav width.
The temporary baseline module was removed. This is not an extraction regression;
no CSS or responsive fix is included in Pass 01.

These are isolated presentation/React fixtures, **not authenticated app flows**.
Workspace runtime effects, server, real call media/E2EE, persistence and domain
views are not exercised by the browser fixture. Their frozen bodies, regression
tests and build/typecheck provide the stated evidence; no live end-to-end claim.

Final root typecheck passed; all 90 unit tests passed (0 failed/skipped), including
19 Phase 2, 5 Phase 3, 13 Phase 4, 19 Phase 5 and 17 new Workspace cases. Architecture
guard passed with 257 resolved edges; client/server build and staged diff check
passed. All existing regression files/assertions and the guard remain unchanged.
Server/migrations, CSS/theme, runtime dependency/package files and other feature
implementations have zero diff. No authenticated end-to-end, live call media or
database integration checks were run. A clean fixture load reported no console
errors. Existing build warnings for LiveKit chunk size and jobStore dynamic/static
imports remain unchanged.
