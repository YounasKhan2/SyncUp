# Phase 9 — Spaces server decomposition pass 01

Baseline: `82fb2330f8093854b91095faef9e0c56fd7b27b2` on clean `main`, fetched and verified before work. Baseline typecheck, 135 tests, architecture guard and client/server builds passed. Work branch: `refactor/syncup-spaces-server-decomposition-pass-01`.

This responsibility audit was written before production movement. Selection follows the audit; correctness and behavior preservation take precedence over reducing route-file size.

> Existing Spaces authorization fallbacks are not uniform and must not be centralized without a dedicated correctness/security phase.

## Complete responsibility map

Paths below are exact. Abbreviations used only in this table: **C** = `/spaces/:spaceId/channels/:channelId`; **O** = `C/objects/:objectId`; **F** = `C/files/:fileId`. Authorization refers to authenticated user context provided by the server's existing auth mount; these routers do not introduce another authentication mechanism. All SQL remains owned by its existing route module.

| Route/helper | Module | Validation | Authorization | Transaction | External infra | Realtime | Risk |
|---|---|---|---|---|---|---|---|
| POST `/chats/:id/upgrade-to-space` | routes.ts | UUID, name/description/icon, channel name | Active group member; group owner; 2–32 active members | BEGIN, locked chat/members, multi-table conversion, COMMIT/RB/release | PostgreSQL | None | High; Authorization-sensitive; Transaction-sensitive |
| GET `/spaces` | routes.ts | None | Space membership plus active visible channel grant | None | PostgreSQL | None | Authorization-sensitive |
| POST `/spaces` | routes.ts | Name/description/icon/template | Auth user becomes owner | BEGIN, Space/category/member/chat/channel/grant inserts, COMMIT/RB/release | PostgreSQL | None | High; Transaction-sensitive |
| GET `/spaces/:id` | routes.ts | UUID; malformed => 404 | Space/active channel visibility; guest member filtering; owner/admin permissions; conversion history | None | PostgreSQL | None | Authorization-sensitive; Security-sensitive |
| PATCH `/spaces/:id` | routes.ts | UUID, name/description/icon | Owner/admin; distinguish member forbidden vs missing Space | None | PostgreSQL | None | Authorization-sensitive |
| POST `/spaces/:id/channels` | routes.ts | UUID, name/topic/category/type | Owner/admin; category belongs to Space; membership propagation by type | BEGIN, locked membership, category lookup, chat/channel/permissions/grants, COMMIT/RB/release | PostgreSQL | None | High; Authorization-sensitive; Transaction-sensitive |
| POST `/spaces/:id/categories` | routes.ts | UUID; category name 1–40 | Owner/admin; member forbidden vs missing Space | None | PostgreSQL | None | Authorization-sensitive |
| PATCH C | routes.ts | UUIDs; topic <=160 | Owner/admin; forbidden vs missing channel | None | PostgreSQL | None | Authorization-sensitive |
| PATCH `C/permissions` | routes.ts | Exactly 3 unique roles; booleans; hidden cannot send/speak | Owner/admin only | BEGIN, locked access, permission upsert, COMMIT/RB/release | PostgreSQL | None | Authorization-sensitive; Transaction-sensitive |
| POST `C/voice/token` | routes.ts | UUIDs; voice limiter | Voice active grant, view permission; resolved speak grant | None | PostgreSQL; LiveKit rooms/token | None | Security-sensitive; Infrastructure-sensitive |
| GET `C/voice` | routes.ts | UUIDs; voice limiter | View check; revoke denied participant; reconcile roster publish rights | None | PostgreSQL; LiveKit participants | None | Security-sensitive; Infrastructure-sensitive |
| POST `/spaces/:id/members` | routes.ts | Username, member/guest role, unique channel IDs | Owner/admin; moderator guest invite only; discoverability/blocks; private grants restricted | BEGIN, locked membership, target/channels, member/grants inserts, COMMIT/RB/release | PostgreSQL | None | Authorization-sensitive; Transaction-sensitive |
| GET `C/messages` | routes.ts | UUIDs; before>=1; limit 1–100/default50 | Active grant; nonvoice; owner/admin or view fallback | None | PostgreSQL | None | Authorization-sensitive |
| POST `C/messages` | routes.ts | UUIDs; trimmed body 1–8000 | Active grant; nonvoice; view/send; everyone privileged | BEGIN, locked channel, mentions, sequence/message/mentions, COMMIT/RB/release | PostgreSQL | channel.message; channel.mention | Authorization-sensitive; Transaction-sensitive; Realtime-sensitive |
| `liveKitSettings` | routes.ts | Three required env values | None | None | LiveKit configuration | None | Infrastructure-sensitive |
| `voiceRoomName` | routes.ts | None | None | None | LiveKit room naming contract | None | Low; Infrastructure-sensitive |
| `idSchema`, `channelNameSchema` | routes.ts | z.uuid; channel trim/lowercase/1–40/regex | None | None | Zod | None | Low |
| `mentionPattern`, `voiceLimiter`, router mounts | routes.ts | Mention grammar; 30/min/user; objects then discovery mount order | Existing auth user limiter key | None | Express/rate limiter | None | Security-sensitive |
| GET `C/objects` | objects.ts | UUIDs | Local authorizeChannel(requireSend=false) | None | PostgreSQL | None | Authorization-sensitive |
| POST `C/objects` | objects.ts | UUIDs; union; duplicate poll options; future close; event range/timezone; assignee visibility | Local authorizeChannel(requireSend=true) | BEGIN, sequence/message/object inserts, COMMIT/RB/release | PostgreSQL; Intl timezone | channel.message after release | Authorization-sensitive; Temporal-sensitive; Transaction-sensitive; Realtime-sensitive |
| POST `C/messages/:messageId/decision` | objects.ts | UUIDs; title 1–160 | View; owner/admin/moderator; source message in channel | None | PostgreSQL | channel.object | Authorization-sensitive; Realtime-sensitive |
| POST `O/respond` | objects.ts | UUIDs; poll/event/checklist union; option/item rules | Send; checklist assignee or privileged role | BEGIN, locked object, state checks, payload update or response upsert, COMMIT/RB/release | PostgreSQL | channel.object after release | Authorization-sensitive; Temporal-sensitive; Transaction-sensitive; Realtime-sensitive |
| PATCH `O/state` | objects.ts | UUIDs; closed/cancelled/unpinned | View; owner/admin/moderator or creator except decision | None | PostgreSQL | channel.object | Authorization-sensitive; Temporal-sensitive; Realtime-sensitive |
| GET `/spaces/updates` | objects.ts | q trimmed <=120 | SQL visible active grants; shared/direct/group call visibility | None | PostgreSQL | None | Authorization-sensitive; Temporal-sensitive |
| `authorizeChannel` | objects.ts | Caller UUID checks | Local view predicate and announcement-aware send fallback; excludes voice | None | PostgreSQL | None | Authorization-sensitive |
| `listChannelObjects`, `objectFields`, `visibleObjectJoin` | objects.ts | Caller UUID checks | Active grant and owner/admin or view fallback | None | PostgreSQL projection/response aggregates | None | Authorization-sensitive; Temporal-sensitive |
| `uuid`, `pollSchema`, `eventSchema`, `checklistSchema`, `createSchema` | objects.ts | UUID; exact discriminated create union and defaults | None | None | Zod | None | Low |
| Response/state inline schemas and Updates projection | objects.ts | Inline response/state filters | Remain route local | As above | Date/Intl; PostgreSQL | As above | Temporal-sensitive |
| GET `/spaces/:spaceId/search` | discovery.ts | UUID; q 2–80; from/date/has/objectType; date ordering | Three independently retained active-grant visibility queries | None; concurrent query branches | PostgreSQL | None | Authorization-sensitive |
| GET `C/files` | discovery.ts | Local UUIDs | Local channelAccess view | None | PostgreSQL | None | Authorization-sensitive |
| POST `C/files` (intent) | discovery.ts | Filename/MIME/size; image cap; limiter | Local view/send | None | PostgreSQL; Appwrite configuration | None | Authorization-sensitive; Infrastructure-sensitive |
| PUT `F/content` | discovery.ts | IDs; raw Buffer; MIME/byte match; limiter | Local view/send; uploader-owned pending unexpired file | None | PostgreSQL; Appwrite createFile | None | Security-sensitive; Infrastructure-sensitive |
| POST `F/complete` | discovery.ts | IDs; limiter | Local view/send; uploader pending uploaded/unexpired row | None | PostgreSQL | None | Authorization-sensitive; Infrastructure-sensitive |
| GET `F/content` | discovery.ts | IDs | Local view; ready-file lookup | None | PostgreSQL; Appwrite download/HTTP headers | None | Security-sensitive; Infrastructure-sensitive |
| `channelAccess` | discovery.ts | Caller UUID checks | Local view/send missing-row true; excludes voice | None | PostgreSQL | None | Authorization-sensitive |
| `validSpaceAndChannel`, `idSchema` | discovery.ts | z.string().uuid() retained independently | None | None | Zod | None | Low |
| `fileMaxBytes`, `imageMaxBytes`, `allowedTypes`, `fileNameSchema` | discovery.ts | 25 MiB; images10 MiB; exact16 MIME types; trimmed safe name | None | None | Zod | None | Low; Security-sensitive |
| `fileUploadLimiter`, raw middleware, searchLimiter | discovery.ts | 30/min/user; raw limit25 MiB; imported search limiter | Existing auth user limiter key | None | Express/rate limiter | None | Security-sensitive |

## Authorization variants (frozen)

`routes.ts`: Space listing/detail/messages require Space membership plus active chat membership grants. Owner/admin bypass role-permission view/send/speak booleans; missing view defaults true. Message send and detail `can_send` default to `(channel_type <> 'announcement' OR role = 'moderator')`. Voice `can_speak` defaults true. Space/channel/category/topic/settings/permission administration requires owner/admin. Conversion requires group owner. Moderator can invite guests, not members, and cannot grant private channel access. Everyone mentions require owner/admin/moderator. Guest member detail visibility is restricted to shared visible active channel grants. Creation has its existing lack of explicit role-permission initialization; conversion and channel creation keep their existing distinct inserts.

`objects.ts`: `authorizeChannel` requires Space membership and active chat grant, excludes voice, and filters `(role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))`. Resolved send is owner/admin OR `COALESCE(permission.can_send, channel_type <> 'announcement' OR role = 'moderator')`. `requireSend` applies only where currently requested. Object visibility join independently retains the view predicate. Decision pinning requires owner/admin/moderator; state management additionally allows creator for nondecisions; checklist item mutation permits assignee or privileged role.

`discovery.ts`: `channelAccess` requires Space membership and active chat grant, excludes voice, but returns resolved view/send booleans instead of filtering view in SQL. Both default missing permission rows to true, with owner/admin bypass. Thus a file write can be allowed in an announcement with missing permission rows where an object/message write for member/guest is denied. Search separately repeats view predicates for each resource query. No authorization is centralized or normalized.

## Transaction inventory (frozen)

Every BEGIN and COMMIT is a client query. Early response branches explicitly ROLLBACK; exceptions ROLLBACK and forward as currently implemented. Discovery has no explicit transactions. No workflow uses new pool calls or transaction wrappers.

| Route | BEGIN | COMMIT | rollback branches | release |
|---|---|---|---|---|
| Upgrade group | Before locked group lookup | After Space/category/member/channel/permission/conversion/chat writes; before201 | Missing/already converted; nonowner; member count; exception including23505 | finally after response/next |
| Create Space | Before Space insert | After category/member/chat/channel/grant; before201 | Exception | finally after response/next |
| Create channel | Before locked membership lookup | After category/chat/channel/permissions/member propagation; before201 | Missing Space; nonowner/admin; bad category; exception including23505 | finally after response/next |
| Update permissions | Before locked access lookup | After JSON-recordset upsert; before200 | Missing channel; nonowner/admin; exception | finally after response/next |
| Invite member | Before locked membership lookup | After membership and selected channel grants; before201 | Missing Space; forbidden role; missing target; bad channels; private moderator grant; already member; exception | finally after response/next |
| Send message | Before locked channel lookup | After sequence/message/mentions; before publications and201 | Missing; voice; hidden; send denied; everyone forbidden; exception (including existing post-COMMIT publication failure catch) | finally after publication/response/next |
| Create object | After authorization/domain validation; before sequence allocation | After message/object insert; before release/publication/201 | Exception (sequence failure included) | inner finally before publication/response |
| Respond to object | After authorization; before locked object lookup | After checklist mutation or response upsert; before release/publication/200 | Missing object; closed poll; bad options; ended/cancelled event; missing checklist item; forbidden assignee; mismatched type; exception | inner finally before publication/response/next |

## Selected boundaries

1. Move only `pollSchema`, `eventSchema`, `checklistSchema`, `createSchema` from objects.ts to **object-validation.ts**, exporting only createSchema. Pure Zod create-input grammar; no DB, auth, request, time, mutation, or publisher. Duplicate-option/timezone/future checks remain in the handler. Local UUID/response/state schemas remain local.
2. Move only `fileMaxBytes`, `imageMaxBytes`, `allowedTypes`, `fileNameSchema` from discovery.ts to **file-validation.ts**, exporting those four values. Cohesive static file input constraints; dependency only Zod. Inline metadata schema, ID validation, limiter, raw middleware, access, storage, SQL, and upload pipeline stay local.

Dependency direction: objects.ts -> object-validation.ts -> zod; discovery.ts -> file-validation.ts -> zod. No new package or cross-feature dependency. Existing messaging/realtime/auth/shared imports remain as-is. The architecture guard must pass.

Deferred: generic authorization/permissions helpers would erase characterized fallback differences. Repositories/services would move SQL/workflow complexity without proving policy ownership. Creation/conversion/channel creation, permission update, object response and Updates stay intact because of transaction/security/temporal coupling. Search visibility stays per-resource. Appwrite and LiveKit orchestration stay in their current modules; voiceRoomName alone is too small to justify another infrastructure-related boundary. Channel naming stays local; no cross-module schema consolidation or UUID normalization. Error abstraction is outside scope.

## Characterization and limits

Before extraction, real route callbacks and real Zod schemas are exercised through a small capture harness, with explicit SQL, realtime, Appwrite, and LiveKit boundaries. Validation tests cover normalization/defaults/bounds/refinements, malformed IDs, channel names/types, permission arrays, file metadata, and object inputs. Authorization/transaction tests cover resolved access outcomes and denied/not-found rollback, role restrictions, SQL parameters/order, response timing, and commit-before-publication. Infrastructure tests cover intent/content/complete/download, search filter selection/escaping, voice configuration/grants, and limiter/raw registration. Existing Phase 2 fallback and temporal tests remain mandatory.

The harness supplies resolved authorization rows; it does not execute PostgreSQL predicates or simulate a database. SQL source assertions characterize differing missing-row predicates; they do not prove database-level correctness. Auth middleware, Express body parsing, limiter execution, real network services, race conditions, and E2E behavior are outside this harness. Mocks do not establish real LiveKit/Appwrite integration correctness.

## Source parity proof

TypeScript AST comparison against the baseline confirmed **26/26 exact route callback bodies**, **6/6 exact helper declarations**, and **124/124 exact database query call expressions**, including SQL arguments and parameter arrays. Route registration expressions (paths, methods, middleware and mounts) match. A stronger comparison of every retained top-level statement after removing imports and the eight moved declarations also passes, covering types, all remaining schemas/constants, limiter configuration, SQL projection strings, handlers and helpers. Source comparison normalizes CRLF to LF only; it does not normalize SQL formatting.

All eight moved initializers are byte-identical after line-ending normalization. New modules import only Zod. Differences are declaration location, the exported bindings, and one import per consumer; semantic differences: none. No handler schema reference changed: createSchema/fileNameSchema retain their existing names. Existing temporal fixture gained only a real schema-module mock; no prior assertion changed.

| Original declaration location | Final location | Initializer/body differences | Import/export difference | Semantic differences |
|---|---|---|---|---|
| objects.ts:11–37 (poll/event/checklist/create schemas) | object-validation.ts:3–29 | None across all4 initializers | Zod import; createSchema export; objects imports it | None |
| discovery.ts:21–40 (byte caps and MIME set),46–48 (filename schema) | file-validation.ts:3–22,24–26 | None across all4 initializers | Zod import; four exports; discovery imports them | None |

Line counts exclude the terminal newline: routes.ts **1111 ->1111**, objects.ts **563 ->537**, discovery.ts **391 ->368**. New modules: object-validation.ts29 lines; file-validation.ts26 lines. Large orchestrators intentionally remain.

## Validation parity

| Concern | Preserved grammar |
|---|---|
| Trim | Poll question/options; event title/timezone/location; checklist title/item text; filename |
| Lowercase | No moved schema lowercases input. Inline file contentType trim/lowercase and local channel-name trim/lowercase remain unchanged |
| Min/max | Poll question1–240; options2–8 each1–100; event title1–160/timezone1–80/location<=240; checklist title1–160/items1–30/text1–240; filename1–200; bytes25MiB/images10MiB |
| Regex/refine | Exact filename path/control-character prohibition and dot/dot-dot refinement; channel regex remains local |
| Defaults | Poll multiSelect/anonymous false and closesAt null; event endsAt null/location empty/rsvpRequired true; checklist assigneeId/dueAt null |
| Enum/discriminant | Exact poll/event/checklist literals and discriminated create union; inline enums untouched |
| Optional/null | Existing nullable/default behavior, ISO datetime/UUID validation and unknown-key stripping retained; local z.uuid vs z.string().uuid distinction retained |

No validation semantics changed. Duplicate-option, future-poll, event relative-time/timezone and assignee checks remain outside the pure grammar. No authorization semantics changed: visibility/send/speak, privileged roles, moderator/member/guest behavior, announcement defaults and missing-row differences remain intact. No SQL semantics changed: statements, parameters, predicates and affected-row handling are exact. No transaction semantics changed: BEGIN/COMMIT/ROLLBACK, release and early-response order are exact. No temporal/domain semantics changed: poll projection, event default-hour/read-time states, elapsed-event RSVP discrepancy, checklist completion, decision pin/unpin and Updates stacking remain local and untouched.

## Wire, realtime and infrastructure parity

API contract freeze covers all methods/paths/params/query/body/status/JSON/error code/message. Realtime owners stay message/object handlers: channel.message, channel.mention, channel.object. Object create/respond release before publishing; message send publishes after commit before finally release. Nontransactional decision/state routes publish after their writes. No retries or new error swallowing.

File owners stay discovery: storage configuration before pending intent insert; upload pending unexpired uploader row, exact MIME and byte check, createFile with object key and empty permissions, uploaded_at then complete ready update; ready-only download with original inline/attachment UTF-8 filename, content length/type, private/no-store and nosniff headers. LiveKit owners stay routes: required three env values, syncup-space-voice channel room name, identity user, 10-minute token, view/speak grants, 16 participants, room creation race/rechecks and roster revocation/reconciliation.

| Event | Payload | Publication location/order |
|---|---|---|
| channel.message | `{ id: messageId, serverSeq }` | Message send after COMMIT before response/finally release; object create after COMMIT and release |
| channel.mention | `{ chatId, messageId, serverSeq }`, undefined third arg, recipient-ID array fourth arg | Message send after channel.message; before201/finally release |
| channel.object | `{ id: objectId, messageId }` | Respond after COMMIT/release; decision/state after their nontransactional writes |

No realtime semantics changed. No file/infrastructure semantics changed. No voice infrastructure semantics changed. No wire-contract changes. Client production, CSS/theme/layout, migrations and DB schema diffs are zero. No functional/domain behavior changed.

## Verification results

Baseline: clean required main SHA, typecheck,135 tests, architecture guard, client/server build passed. Before production: focused34 tests, root typecheck and169 full tests passed. After each of the object and file extractions: focused34, root typecheck and169 full tests passed. Final: root typecheck,169 tests (zero failures/skips), architecture guard, client/server build, AST parity and git diff --check passed. All previous Phase2–8 suites remain in the full run; the temporal fixture's one import-mock addition is its only change.

New coverage is split across spaces-server-validation.test.mjs (10), spaces-server-contracts.test.mjs (14), and spaces-server-infrastructure.test.mjs (10), plus the explicit-boundary helper. Existing foundation-permissions and foundation-temporal tests additionally retain missing-row and Updates/read-write temporal regression coverage. No real PostgreSQL integration, LiveKit/Appwrite integration or browser/E2E test is claimed or run for this server-only extraction. Mocks do not establish real LiveKit/Appwrite integration correctness.

## Retained debt

Authorization duplication with intentionally different defaults; SQL-heavy routes; multi-table transaction orchestration; object temporal rules and read/write discrepancies; discovery/search predicates and fan-out; file/Appwrite pipeline; LiveKit room/participant policy; direct pool access; repeated local error handling. These need dedicated future phases with correctness/security and integration coverage. Pass01 stops at its PR and does not merge or start another phase.
