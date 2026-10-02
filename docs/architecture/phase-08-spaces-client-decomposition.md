# Phase 8 — Spaces client decomposition, Pass 01

Required baseline: `558e96a99896beb6cf1c3913f2d1072fcab1b05f`, fetched and
verified on clean main. Root typecheck, 113 tests, architecture and client/server
build passed. Branch: `refactor/syncup-spaces-client-decomposition-pass-01`.

## Responsibility audit before production movement

P = SpacesPage. All decisions, state and runtime ownership remain at P. Only
decrypted-history rendering and the standalone voice welcome panel are selected.

| Responsibility | Baseline owner | Risk | Selected? | Final owner |
|---|---|---|---|---|
| Space list | P | Medium | No | P |
| Selected Space | P | Lifecycle-sensitive | No | P |
| Selected channel | P | Lifecycle-sensitive | No | P |
| Channel messages | P | High | No | P |
| Shared objects | P | Temporal-sensitive | No | P |
| Encrypted legacy history | P | Security-sensitive | Rendering only | P runtime; SpaceLegacyHistoryView rendering |
| Legacy-history pagination | P | Security/lifecycle-sensitive | No | P |
| Search open/query/filter state | P | Medium | No | P |
| Search execution/results | P | Authorization-sensitive | No | P |
| File-panel state | P | Medium; loading coupling | No | P |
| File listing | P | Authorization-sensitive | No | P |
| File upload | P | High | No | P |
| Space create form | P | High | No | P |
| Channel create form | P | Authorization-sensitive | No | P |
| Category create form | P | Authorization-sensitive | No | P |
| Space settings | P | Authorization-sensitive | No | P |
| Member invitation | P | Authorization-sensitive | No | P |
| Channel settings | P | Authorization-sensitive | No | P |
| Role-permission draft/edit/save | P | Authorization-sensitive | No | P |
| Topic editing | P | Authorization-sensitive | No | P |
| Mention menu | P | Medium; draft/role coupling | No | P |
| Shared-object menu/dialog | P | Temporal/domain-sensitive | No | P |
| Shared-object form | P | Temporal/domain-sensitive | No | P |
| Object creation | P | Temporal-sensitive | No | P |
| Object response | P | Temporal-sensitive | No | P |
| Object state mutation | P | Temporal-sensitive | No | P |
| Decision pinning | P | Authorization/temporal-sensitive | No | P |
| Message composer | P | Authorization-sensitive | No | P |
| Channel message send | P | High | No | P |
| Mention rendering | P | Medium | No | P |
| Space loading | P | Lifecycle-sensitive | No | P |
| Space refresh polling | P | Lifecycle-sensitive | No | P |
| Channel realtime | P | Lifecycle-sensitive | No | P |
| Channel fallback polling | P | Lifecycle-sensitive | No | P |
| Update-target opening/highlighting | P | Lifecycle-sensitive | No | P |
| Message scrolling | P | Lifecycle-sensitive | No | P |
| Voice-room entry | P | Authorization-sensitive | Welcome rendering only | P payload/permission; SpaceVoiceChannelView rendering |
| Category collapse state | P | Low | No | P |
| Busy/error state | P | High; shared workflows | No | P |
| Shell/sidebar rendering | P | Medium; permissions/forms | No | P |
| Channel header rendering | P | Medium; actions/permissions | No | P |
| Message/history rendering | P | Medium | Legacy rendering only | P messages; SpaceLegacyHistoryView legacy rendering |
| Modal/dialog composition | P | Authorization/domain-sensitive | No | P |

## Selected boundaries and rejected alternatives

SpaceVoiceChannelView receives one onJoin callback and renders the exact voice
welcome markup/classes/copy. Payload construction, can_speak forwarding, both entry
points and callback timing stay at P. The child owns no permission decision.

SpaceLegacyHistoryView receives already decrypted messages, the existing member
map, userId, hasMore/loading/error and onLoadEarlier. Its seven related props form
one history view. It owns no access/membership decision, crypto, API, state, ref,
effect or timer. Attachment rendering retains the existing MessageAttachment.
P retains the encrypted-history conditional and all pagination/decryption logic.

No UI-state hook is justified in this pass: search/file/settings open transitions
also clear results/errors or initialize transport/permission data; object and
mention menus interact with form/draft/role behavior. Moving raw setters would
add indirection without isolating a coherent transition boundary. Category
collapse alone does not justify a hook. Existing helpers stay in place.
No new API layer, state library, primitive migration or shared-object abstraction.

## State, effects and refs

Every useState and both refs remain in P with identical declarations and ownership.
messageEnd retains smooth/end scrolling. fileInput retains upload activation/reset.
All seven effects remain in P, with unchanged bodies and dependency arrays:

| Effect | Dependencies before | Dependencies after | Behavior changed? |
|---|---|---|---|
| Update target | [openTarget?.spaceId, openTarget?.channelId, openTarget?.messageId, space?.id] | Same | No |
| Initial Spaces list | [] | Same | No |
| Space refresh | [space?.id] | Same | No |
| Channel messages/objects/SSE/fallback | [space?.id, channelId, activeChannel?.name, historyCursor] | Same | No |
| Initial encrypted history | [legacyChannelId] | Same | No |
| Message-end scroll | [messages] | Same | No |
| Update highlight | [messages, highlightedMessageId] | Same | No |

## Timer, realtime and scroll parity

Space refresh 15000 ms; channel fallback 5000 ms; highlight timeout 4000 ms:
before = after. No additional timers discovered in P. Highlight timeout's existing
cleanup behavior remains unchanged. Smooth/end and smooth/center scrolling stay.
EventSource remains /api/events?chat_id=encodeURIComponent(channelId), with
channel.message, channel.object and channel.mention listeners. Message/object
requests retain Promise.all order, state replacement, active guards and errors;
mention notice and refresh remain unchanged. Cleanup disables active guards,
clears intervals and closes EventSource. Space refresh stays a separate interval.

## Permission, runtime and API parity

All named helper/runtime functions remain in place unchanged: normalization/icon/
mention helpers, decodeLegacyMessages, loadSpaces/loadSpace/openSpace, permission
initialization/update/save, legacy pagination, all forms/settings/invitation,
sendMessage, object reset/create/refresh/respond/state/pin, search execution/result
opening, file panel/upload. No permission policy moves into a presentation child.

Permission rows are cloned; missing permissions retain the existing error without
inventing defaults; disabling View disables Send and Speak; voice edits can_speak,
other channels can_send; the UI's permissionDraft.length !== 3 save guard remains.
Server missing-row fallbacks from Phase 2 are deliberately not corrected.

Legacy history retains limit=50, decrypt parameters/fallback, deleted handling,
abort guard, before_seq cursor, prepend/hasMore, loading/errors and sender fallback.
Non-preview attachments and aggregated reactions retain their exact rendering.

Messages retain trim guard with untrimmed body, busy/error, clearing and reload.
Mention parsing/permissions and everyone semantics remain. Poll trim/filter,
event date validation/ISO/timezone and checklist newline construction stay intact.
Object response/state/decision requests and refresh sequencing remain. Existing
server temporal discrepancies remain; SharedObjectCard is unchanged.

Files retain intent POST -> apiUpload content -> complete POST -> file reload,
content-type fallback, metadata, direct download URLs and fileInput reset.
Voice header and welcome callbacks retain id/chatId, audio type, Space/channel
title, isVoiceRoom, voiceSpaceId, voiceChannelId and canPublish: can_speak.
Search query/filter construction, has/objectType mutual clearing, submitted state,
result order, direct file links, cursor/channel/highlight and close remain.
No endpoint/method/body/response/error changes; no server or migration changes.

## Remaining debt and verification

Loading, permissions, realtime, encrypted history, search execution, files, shared
objects, messaging, voice payload construction, forms/settings and direct API use
remain at P for separately characterized future work. Verification results and
isolated browser evidence are recorded below.

## Characterization and independent parity evidence

Before production movement, 22 new tests passed against the original SpacesPage:
8 UI/presentation, 4 client permission and 10 runtime tests. The characterization
checkpoint also passed root typecheck and all 135 tests. The voice extraction
passed the same focused/typecheck/full-suite checkpoint. Existing assertions and
the test runner remain unchanged.

UI tests protect Space opening/default channel, update targets, no-channel/text/
voice composition and both voice payloads; history identities/deleted messages/
non-preview attachments/reaction aggregation/loading/error/empty/pagination UI;
search open/close/filter clearing; file-panel open/close/category collapse; and
SharedObjectCard callbacks/canManage. Permission tests protect row cloning, missing
row errors, View disabling both Send/Speak, re-enabling View without granting either,
voice/text field selection, three-row save UI guard, request/refresh and server
can_send-driven composer controls. Runtime tests protect polling/active guards,
SSE/cursor/mention/fallback/cleanup, decrypt/abort, pagination, scroll/highlight,
file sequencing/error reset, search navigation, send/mentions, object construction/
validation/reset/refresh and decision pinning.

An independent TypeScript AST comparison against the required main SHA found all
7 effects, 52 useState declarations, 2 refs and 28 helper/runtime function bodies
identical, normalizing CRLF only. Seven expanded element trees matched for overview,
no-channel, text, voice, legacy history, search and permissions. Serialization
omits functions; behavioral tests separately protect callbacks. SpacesPage counts
1180 -> 1155 non-trailing-blank lines (the prompt's approximate 1181 includes the
final empty line). The reduction is secondary to isolating coherent display views.

The unit harness executes actual production component/functions and both extracted
modules using existing TypeScript/VM infrastructure. Explicit network/decryption/
child boundaries and named state/ref slots avoid hook-index tests. Controlled
timers/effect mounting and one supplied scroll target do not model React scheduling,
browser layout, actual encryption/storage, server authorization or real voice.
Client tests do not replace Phase 2's server fallback/temporal characterization.

## Visual evidence and limitations

The test-only spaces-preview HTML/TSX fixture uses the real extracted components,
existing rail/mobile navigation, copied shell classes and existing styles. It seeds
plaintext and disables fetch. Desktop checks at 1440×900 covered voice/history,
deleted text/reactions, loading/disabled pagination, empty/error copy and dark
error. Mobile checks at 390×844 covered light/dark voice/history and dark error.
Voice/pagination controls forwarded only fixture callbacks. Desktop
light voice/history, desktop dark error, mobile light/dark voice/history and mobile
dark error screenshots were saved locally as phase8-* in the task visualizations
directory. Fixture controls are explicitly labeled; their overlay is test-only.
No browser console errors. No actual call/request was created by fixture callbacks.

These are isolated fixtures, not authenticated/backend workflows. Live permissions,
real file upload/download, encrypted attachment hydration, database integration
and voice-room entry were not exercised. Unit mocks establish current client
sequencing, not end-to-end correctness. No CSS/theme, server, migration, package,
lockfile, existing SharedObjectCard or feature API changes.

No UI-state semantics changed. No authorization semantics changed.
No encrypted-history semantics changed. No domain/temporal semantics changed.
No file semantics changed. No voice-room semantics changed.
No wire-contract changes. No functional/domain behavior changed.

## Final verification

Focused Spaces tests: 22 passed. Root typecheck: passed. Full suite: 135 passed,
zero failures/skips, including all Phase 2–7 regressions. Architecture guard:
passed, 263 resolved internal edges (baseline 260). Client/server build: passed.
Existing LiveKit chunk-size and jobStore static/dynamic import warnings remain.
Diff review and whitespace checks: passed; no CSS, server or migration diff.
The history checkpoint initially caught its now-unused parent MessageAttachment
import; it was removed and the complete focused/typecheck/full-suite checkpoint
passed again before final architecture/build verification.

Dependency direction remains SpacesPage -> Spaces presentation -> shared types
and existing MessageAttachment. The MessageAttachment edge moves from P to the
history child; two local presentation imports and one shared-type edge add three
resolved edges. No runtime packages or new cross-feature private APIs.
