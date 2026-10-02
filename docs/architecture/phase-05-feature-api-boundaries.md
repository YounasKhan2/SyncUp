# Phase 5 — Feature API boundaries v1

## Baseline and bounded selection

Fetched origin and fast-forwarded clean main to the requested exact SHA:
`ec8f6d15e2aabae80de9443730b6a554f967a456` (merged Phase 4).
Baseline root typecheck, 54 tests, architecture guard (250 edges), and client/server build passed.
Branch: `refactor/syncup-feature-api-boundaries-v1`. Zero dependencies added.

[Complete baseline call-site inventory](./phase-05-transport-inventory.md) records endpoint expressions, methods, payloads, response annotations, transport/options, risk and selection for every feature call site, plus AppRouter/shared transport. It covers 123 feature sites (117 direct api/apiUpload/fetch plus six existing helper invocations), and four app/shared sites. Only eight sites in **two consumers** are migrated, representing seven distinct operations. Session listing occurs twice.

## Boundaries introduced

`client/src/features/account/api.ts` owns six account operation contracts:

| Function | Input | Endpoint and method | Return type | Transport |
|---|---|---|---|---|
| listSessions | None | GET `/api/auth/sessions` | Promise of `{ sessions: Session[]; currentSessionId: string }` | api |
| revokeSession | sessionId string | POST `/api/auth/sessions/${encodeURIComponent(sessionId)}/revoke` | Promise<void> | api |
| updateProfile | UpdateProfileInput: displayName/username/about strings, discoverable/readReceiptsEnabled booleans | PATCH `/api/auth/me` | Promise of `{ user: User }` | api |
| getCurrentUser | None | GET `/api/auth/me` | Promise of `{ user: User }` | api |
| uploadAvatar | ArrayBuffer bytes, contentType string | PUT `/api/auth/me/avatar` | Promise<void> | apiUpload |
| removeAvatar | None | DELETE `/api/auth/me/avatar` | Promise of `{ user: User }` | api |

`client/src/features/messaging/api.ts` owns one message-report contract:

| Function | Input | Endpoint and method | Return type | Transport |
|---|---|---|---|---|
| submitReport | SubmitReportInput: messageId/reason/details strings | POST `/api/reports` | Promise<unknown>, same previously untyped api response | api |

Existing Session/User remain in shared/types. New request/response types are scoped to their operation. Functions directly return the underlying Promise: no transformation, unwrapping, catch, extra await, loading state, effect, cache, retry, timer or React import. Shared/api.ts is unchanged.

## Migrated consumers and request parity

| Consumer | Previous direct call | New feature API | Behavior changed? |
|---|---|---|---|
| AccountPanel explicit session refresh and mount effect | api GET sessions | listSessions | No |
| AccountPanel revoke handler | api POST encoded revoke | revokeSession (imported as revokeAccountSession) | No |
| AccountPanel profile handler | api PATCH me | updateProfile | No |
| AccountPanel avatar handler | apiUpload PUT avatar then api GET me | uploadAvatar then getCurrentUser | No |
| AccountPanel avatar removal | api DELETE avatar | removeAvatar (imported as removeAccountAvatar) | No |
| ReportDialog submit handler | api POST reports | submitReport | No |

For all operations, **before = after**:

| Operation | URL/method | Exact body/arguments | Response and error handling |
|---|---|---|---|
| Sessions (both call sites) | `/api/auth/sessions`, implicit GET, no options supplied | No body | Same sessions/currentSessionId values; same mounted guard and UI fallback |
| Revoke | Same encoded session path, POST | Method only; no body | Await, then reload; same catch/fallback |
| Profile | `/api/auth/me`, PATCH | JSON keys in existing order: displayName, username, about, discoverable, readReceiptsEnabled. String/FormData conversion stays in component; false and empty strings retained | Same result.user passed to onSaved; same success/error copy/finally |
| Avatar upload | `/api/auth/me/avatar`, PUT through unchanged apiUpload | Exact original ArrayBuffer reference and avatarFile.type; no conversion, content-type normalization or added headers | Await upload before GET; errors enter same component catch |
| Current user after upload | `/api/auth/me`, implicit GET, no options supplied | No body | Same envelope and user object; no callback until GET resolves |
| Avatar removal | `/api/auth/me/avatar`, DELETE | Method only; no body | Same returned user; same cleanup/copy/finally |
| Message report | `/api/reports`, POST | JSON keys in existing order: messageId, reason, details, including empty details | Response still ignored; success closes; failure remains open with unchanged copy |

Generic transport still supplies same-origin credentials, application/json headers for api, caller content type for apiUpload, and its existing refresh/error behavior. Contract tests execute the real shared transport against a fake fetch and compare every migrated wire request. Feature tests also check returned Promise/response identity and exact rejection identity, including upload byte identity. No extra signal, retry, caching or refresh work is introduced.

## Sequencing and React ownership

**No sequencing changes.**

- Session load: the mount effect retains its mounted flag/catch and the explicit refresh retains its own state updates.
- Revoke: POST resolves, then one reload; rejected revoke skips reload.
- Profile: FormData conversion, loading state, await PATCH, onSaved, success copy, finally reset all remain in AccountPanel.
- Avatar: file.arrayBuffer, await PUT, GET current user, onSaved, file/preview/input cleanup, success copy and busy reset remain in AccountPanel. The existing inner async closure is retained. Upload or GET failure leaves selected file/input intact and does not invoke onSaved. No batching/combined avatar operation was introduced.
- Removal: DELETE, onSaved, cleanup/success copy, busy reset remain in AccountPanel.
- Report: preventDefault, submitting true, clear error, await POST, onClose on success, existing Error/fallback presentation on failure, finally submitting false remain in ReportDialog. Phase 4 outside/close/Escape/focus behavior is untouched.

## Characterization and verification strategy

`tests/feature-api-characterization.test.mjs` adds **seven** tests executed successfully against the original production handlers **before extraction**, then against those same handlers using the actual new API modules. Protects session results/encoded revoke/reload, revoke failures, ordered profile JSON/FormData conversion/callback timing, avatar bytes/upload-GET sequencing, upload/GET failures, avatar deletion, and pending/success/failure report behavior.

`tests/feature-api-contracts.test.mjs` adds **eight** tests: one per exported function checks arguments, response/Promise identity, and error identity; one exercises every function through the real shared transport to verify method, headers, credentials and body.

`tests/feature-api-architecture.test.mjs` adds **four** tests running the real checker against isolated tiny source trees: allowed own-feature direction; rejected cross-feature private API import/re-export/import-type/dynamic import (including Workspace); rejected API-to-React/TSX imports; retained shared-to-feature prohibition. Temporary fixture roots are validated before cleanup.

Phase 2, Phase 3 and Phase 4 test files/assertions remain unchanged. Only `tests/helpers/ui-harness.mjs` changes its module bindings to execute the real account/messaging API through the original mocked transport rather than stub feature functions. This preserves Phase 4 tests' transport-level assertions without weakening them.

After Account extraction, focused characterization/Phase 4 tests, root typecheck and all **61** then-current tests passed before proceeding to Messaging. Messaging's focused tests and the extended guard also passed.

| Final check | Result |
|---|---|
| Root client/server typecheck | Passed without heap overrides |
| Full unit suite | 73 passed; 19 new |
| Phase 2 characterization | 19 unchanged, passed |
| Phase 3 theme lifecycle | Five unchanged, passed |
| Phase 4 primitive/dialog | 13 unchanged assertions, passed; harness import wiring updated as described |
| Architecture guard | Passed, 253 resolved edges |
| Client/server build | Passed; existing LiveKit chunk-size and jobStore ineffective-dynamic-import warnings remain |
| Diff check and frozen-area inspection | Passed; only selected feature production files and guard changed |

No authenticated backend integration, real profile/avatar/report persistence, new visual audit, device or OS theme checks are performed in Phase 5. JSX, fields, primitives, styling and theme are unchanged; Phase 4 characterization remains the interaction regression baseline. Contract tests use isolated transport/fetch doubles rather than a live service.

## Architecture guard

Before: AccountPanel / ReportDialog -> shared/api, with feature URLs/serialization in React.
After: consumer -> **same feature** api.ts -> shared/api and existing shared types.

The existing resolver/walker and shared-to-feature rule remain. A narrow extension for root `features/*/api.ts` rejects:

1. incoming imports from outside that feature (including Workspace/app/shared; no new private cross-feature API coupling);
2. React/react-dom imports from API modules;
3. API imports of TSX components.

It covers the existing checker's literal imports/re-exports, literal dynamic import/require and import-type forms. It does not claim whole-program detection of computed imports, indirect coupling or React code in arbitrary .ts helpers. Existing cross-feature debt remains informational; no broad allowlist or checker redesign.

## Frozen areas and remaining debt

Server diff is zero. Auth sign-in/up/unlock, Calls callApi/refresh, Workspace effects/orchestration, Conversation send/outbox, encrypted history, media/Appwrite/Media v2, Spaces permissions and operations, database/migrations, shared transport/types, theme/appearance and primitives/styles are unchanged. No Phase 2 finding is fixed.

SafetySettings block/unblock and username reporting remain direct: different safety policy/ownership; no import of Messaging's private API. Auth/Calls/Workspace/Conversation/Media/Spaces calls are excluded as instructed. Search and ChatDetails stay in place to avoid expanding effect/membership/conversion scope. AppRouter's `/api/auth/me` remains a bootstrap concern despite matching Account's endpoint. Remaining direct calls are expected debt, fully listed in the inventory; this is not a mass migration.

No functional/domain behavior changed: auth/session, wire contracts, DB/migrations, crypto, messaging, Calls, media, Spaces, realtime, polling/retry, navigation and theme/UI behavior are preserved.

Stop after opening the Phase 5 PR; do not merge or begin Phase 6.
