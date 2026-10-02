# Phase 2 behavioral characterization

Base: main `46dd7fe2dc875278481801502ec9a52d4d822737`, the verified squash merge of PR #14.
Branch: `test/syncup-foundation-phase-02-characterization`.
The clean main baseline passed typecheck, 17 unit tests, architecture checks, and build before this branch was created.

**CHARACTERIZED CURRENT BEHAVIOR — CORRECTION REQUIRES SEPARATE APPROVAL**

These tests preserve observations; they do not endorse suspicious behavior. Any correction needs separate review. No production runtime files, dependencies, existing assertions, or expected values changed.

## Evidence and test boundaries

The existing Node/tsx discovery includes four new `foundation-*.test.mjs` files. The helper transpiles actual production modules into isolated VM contexts with explicitly supplied imports. Private function and route callbacks are selected through the TypeScript AST and executed without copying their implementations or introducing production exports. Missing imports fail closed. Source assertions are limited to SQL fallback expressions and initialization/lifecycle wiring where executing them safely would require unavailable infrastructure.

The in-memory IndexedDB double implements successful operations used by the stores. Reloading a module against the same double represents a fresh consumer of the same browser database, not an actual browser login. It does not model IndexedDB durability, quota, transaction isolation, unique-index failures, version upgrades, blocked tabs, or real browser account navigation. OPFS and runtime-manager boundaries are doubles. Route tests invoke actual callbacks with mock database results, real Zod validation, and controlled clocks; they do not prove PostgreSQL query execution, joins, locks, or end-to-end authorization.

No HTTP requests, real workers, LiveKit rooms, actual browser storage, or database services are used. Existing integration tests were inspected, not executed: a disposable environment was not established, and arbitrary localhost infrastructure must not be used.

## Account switching

Given A's draft, encrypted queued message, upload job, and in-memory plaintext source, the real sign-out body calls the sign-out API, locks the key bundle, and calls `onSignedOut`. A fresh storage consumer can read the draft, pending message, and recoverable job. The in-memory source remains in the existing cache instance. Sign-out rejection does not lock keys or call `onSignedOut`.

`syncup-local` v1 stores drafts by chat ID and outbox records by idempotency key. `syncup-media-v2` v1 stores upload jobs by job ID, with an attachment ID index. Neither store API accepts an account or filters records by account. This proves storage availability, not that B can navigate A's chat in the UI or decrypt A's messages.

The actual outbox flush body attempts A's queued ciphertext using the current transport. A mocked B authorization denial retains the original ciphertext/envelopes/idempotency key, increments attempts, and schedules the first retry after 1 second. Server acceptance as B is not claimed or tested. Subsequent retries, inbox UI, reconnect navigation, and authorized same-chat delivery remain integration gaps.

Media v2 local-source hydration and size-matching OPFS playback return plaintext before metadata API access, key unwrap, or worker creation. The OPFS path is `syncup-media-v2/playback/<attachmentId>.bin`; it contains no account segment. This demonstrates the hydration function's early-return contract, not that B can discover A's attachment through UI/server authorization. `localMediaCache` has a four-source LRU lifetime within the loaded module.

Runtime starts once, attaches online/offline listeners, and initializes the manager once. Explicit stop removes listeners and disposes the manager. `main.tsx` starts it outside authenticated workspace lifecycle; the sign-out body does not stop it. Worker abort/key-zeroing on individual component cleanup and actual background upload recovery under B are not exercised. `uploadManager.initialize` lists recoverable jobs then recovers staged/session state; this phase tests list availability rather than live recovery or sending completion.

Inspection: staging uses `syncup-media-v2/staging/<jobId>.bin`, not an account path; encrypted legacy cache uses `syncup-media-cache` with attachment IDs. Sign-out performs no storage cleanup. Staging persistence, encrypted cache eviction, private-key contents, OPFS disk durability, worker memory, and account-specific UI visibility remain untested. Existing media-v2 crypto/scale unit coverage remains intact.

## Concurrent refresh

Two overlapping normal requests receive 401, share one in-flight refresh (one browser lock request), then retry once each. A simultaneous normal API request and Calls request instead make two refresh requests; only normal API uses the lock. Both carry `credentials: same-origin`, relying on the browser cookie jar rather than independent explicit tokens.

Refresh 401 prevents retry and propagates the original endpoint error for both transports. A refresh network rejection is swallowed by normal API, which reports the original endpoint error; Calls propagates the network error. Successful refresh followed by a second 401 stops after the single retry. Neither transport directly locks the key bundle or invokes a signed-out callback; application-level session handling is outside this harness.

The actual server refresh callback, given an already-used token row, revokes the refresh family, records token reuse, commits, clears access and refresh cookies, and responds 401. Thus two requests carrying the same old refresh cookie can encounter reuse revocation after one rotates it. This is a possibility supported by the handler and client refresh count, not a measured browser/PostgreSQL concurrency outcome. Cookie response ordering, cross-tab lock scheduling, rotation success, SQL lock contention, and real session invalidation remain integration gaps.

## Spaces permission matrix

For non-admin Space members with an active channel membership grant; text/object/file operations exclude voice channels. Owner/admin overrides and membership joins remain as implemented. “Deny” below means the relevant permission is false while view is true; denied view hides/prohibits access. Missing permission row is not the same as missing membership.

| Operation | Present/allow | Present/deny | Missing permission row | Evidence |
| --- | --- | --- | --- | --- |
| Space text send | Allowed | Denied | Text allowed; announcement denied for member/guest, allowed for moderator | Actual SQL expression source guard; existing integration assertions inspected |
| Object create/respond | Allowed | Forbidden | Same announcement-aware fallback as text | SQL source guard; actual authorization function with resolved allow/deny/no-row results |
| File upload/write | Allowed | Denied | `can_send` defaults true, including announcement | SQL source guard; actual file access function preserves resolved booleans |
| File list/download | Visible | Hidden if view denied | `can_view` defaults true | SQL source guard; route inspection |
| Search/discovery/Updates reads | Visible | Hidden if view denied | `can_view` defaults true | SQL source guard and route inspection |
| Voice admission | Allowed if view allowed | Denied if view denied | `can_view` defaults true | SQL source guard and route inspection |
| Voice publishing | Can speak | Listen only | `can_speak` defaults true | SQL source guard of permission and LiveKit grant |

Missing-row values are derived from SQL inspection, **not database-executed matrix tests**. The mocked access-function no-row case represents SQL returning no authorized channel, not a missing permission row. PostgreSQL matrix fixtures deleting only permission rows, endpoint status checks, and LiveKit token validation remain unexecuted.

Migration 014 backfills moderator/member/guest for every existing channel with announcement-aware send defaults; channel creation initializes these roles. Migration 015 adds `can_speak` default true. Missing rows therefore represent an abnormal/incomplete data state rather than the normal migrated path. Existing integration coverage checks allowed/denied roles, announcement sends, visibility, files/search, voice canSpeak, and shared-object CRUD; it does not remove permission rows to exercise these fallbacks. The differing file/text fallback is preserved.

## Temporal state

The real channel read returns stored state. Updates clones rows and projects time without writing/publishing: an open poll closes at `closesAt <= now`; events become active at start and ended at end, with default end start plus one hour. Cancelled events remain cancelled. Checklist deadlines do not affect state: unfinished assigned tasks remain actionable even overdue. Active decisions enter decided; unpinned decisions are omitted from Updates but remain in channel reads. An ended event is absent from happening and does not automatically enter decided.

Deterministic tests cover boundary equality, the default hour, the 48-hour RSVP threshold, answered/optional events, cancellation, checklist deadline, and decisions. A second channel read confirms no stored state mutation. The actual respond callback rejects an expired stored-open poll with 409, but accepts an elapsed event whose stored state remains scheduled; explicitly ended/cancelled state rejects by inspection. The mutation test bypasses channel authorization with a resolved allowed result and mocks transaction results; it does not assert DB persistence.

Existing integration tests cover poll response counts, event RSVPs, checklist completion, decisions, and Updates with current/future dates. They do not deterministically compare elapsed stored states against Updates or test clock boundaries. Time-zone browser rendering, background writers, actual SQL persistence, and concurrent mutation remain gaps.

## Verification and preservation

Focused command: `node --import tsx --test tests/foundation-account.test.mjs tests/foundation-refresh.test.mjs tests/foundation-permissions.test.mjs tests/foundation-temporal.test.mjs`.

Final verification passed: typecheck, full unit discovery (36 passed), architecture guard (242 edges), build, focused suites (19 passed), and both working/staged `git diff --check`. No tests failed or skipped on final runs. Existing build warnings concern a large LiveKit bundle and an ineffective dynamic import of jobStore; no build failure. Database integration and full browser/LiveKit scenarios were not executed. Commit/PR are recorded in the completion report.

No API contracts, schema, migrations, encryption, authentication/authorization, message envelopes, idempotency, sequence allocation, attachment ownership, Space visibility, group conversion, encrypted history, LiveKit permissions, realtime semantics, polling/retry intervals, or intentional UI/theme behavior changed. Findings above remain unfixed. Phase 2 stops for human review.
