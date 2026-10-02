# Phase 7 — Conversation decomposition, Pass 01

Baseline: `3b4f7245b7f6efdbf7d39e7de890620abc316b5b`; clean main;
typecheck, 90 unit tests, architecture guard and client/server build passed.
Branch: `refactor/syncup-conversation-decomposition-pass-01`.

## Responsibility audit completed before production movement

Baseline owner for every row is Conversation. C = retained Conversation ownership.
Classification includes security and lifecycle sensitivity where applicable.

| Responsibility | Baseline owner | Risk | Selected? | Final owner |
|---|---|---|---|---|
| Chat metadata | Conversation | High | No | C |
| Decrypted message collection | Conversation | Security-sensitive | No | C |
| Searchable-message projection | Conversation | Medium | No | C |
| Call history | Conversation | High | No | C |
| Composer draft | Conversation | Lifecycle-sensitive | No | C |
| Reply state | Conversation | Medium, coupled to send | No | C |
| Edit state | Conversation | Medium, coupled to draft/encrypted edit | No | C |
| Report selection/open/close state | Conversation | Low | Yes | useConversationUiState |
| Details open/close state | Conversation | Low | Yes | useConversationUiState |
| Message-search open/query/close state | Conversation | Low | Yes | useConversationUiState |
| Pagination state | Conversation | Lifecycle-sensitive | No | C |
| Presence | Conversation | Lifecycle-sensitive | No | C |
| Typing state | Conversation | Lifecycle-sensitive | No | C |
| Staged attachments | Conversation | Security-sensitive | No | C |
| Upload state | Conversation | Security-sensitive | No | C |
| Media v2 snapshots | Conversation | Lifecycle-sensitive | No | C |
| Voice draft | Conversation | Lifecycle-sensitive | No | C |
| Submission state | Conversation | Security-sensitive | No | C |
| Call-start state | Conversation | Security-sensitive | No | C |
| Initial conversation loading | Conversation | Security/lifecycle-sensitive | No | C |
| Message decryption | Conversation | Security-sensitive | No | C |
| Reply-context decryption | Conversation | Security-sensitive | No | C |
| Read receipt | Conversation | High | No | C |
| Older-message pagination | Conversation | Lifecycle-sensitive | No | C |
| Jump-to-message | Conversation | Lifecycle-sensitive | No | C |
| Scroll restoration/stickiness | Conversation | Lifecycle-sensitive | No | C |
| SSE/realtime | Conversation | Lifecycle-sensitive | No | C |
| Fallback polling | Conversation | Lifecycle-sensitive | No | C |
| Draft restoration | Conversation | Lifecycle-sensitive | No | C |
| Draft persistence | Conversation | Lifecycle-sensitive | No | C |
| Media v2 subscription | Conversation | Security/lifecycle-sensitive | No | C |
| Encrypted file upload | Conversation | Security-sensitive | No | C |
| Voice-note upload | Conversation | Security-sensitive | No | C |
| Direct/group call creation | Conversation | Security-sensitive | No | C |
| External call intent | Conversation | Lifecycle-sensitive | No | C |
| Typing transmission | Conversation | Lifecycle-sensitive | No | C |
| Encrypted send/edit | Conversation | Security-sensitive | No | C |
| Pending outbox queue | Conversation | Security-sensitive | No | C |
| Reactions | Conversation | High | No | C |
| Deletion | Conversation | High | No | C |
| Pinning | Conversation | High | No | C |
| Clipboard copy | Conversation | Medium | No | C |
| Header composition | Conversation | Low | No | C + existing ConversationHeader |
| Message-list composition | Conversation | Medium | No | C + existing MessageList |
| Composer composition | Conversation | Medium | No | C + existing MessageComposer |
| Dialog/details/search/report composition | Conversation | Medium | No | C + existing children |
| No-chat welcome presentation | Conversation | Low | Yes | ConversationWelcome |

## Selected and rejected boundaries

useConversationUiState owns only the four auxiliary-view state values:
reportingMessageId, detailsOpen, messageSearchOpen and messageSearch. Its transitions
open/close a report or details, toggle search without clearing its query, and close
search while clearing its query. It imports only React, owns no effects/refs, and
does no transport, storage, crypto, Calls, media, scrolling or message actions.
Search filtering and jump callbacks remain in Conversation.

Reply/edit were deliberately excluded: beginEdit changes editingMessage, replyTo
and draft; cancel edit clears draft and persists it; submit clears them according
to send/edit sequencing. Moving those transitions would couple a presentation hook
to frozen draft/storage/send workflows. Their state, setters and bodies stay intact.

ConversationWelcome owns the standalone no-chat view, including BrandMark, identity
Avatar and existing copy/markup/classes. It receives User, owns no state/effects/refs,
and depends only on shared presentation components/types. This is a complete view,
not a wrapper around an existing child or a generic shell.

Existing header/list/composer/details/report contracts are retained. No pointless
wrappers, pure helper extraction, generic useConversation hook or feature API expansion.
Load/decrypt/pagination/scroll/realtime/drafts/uploads/Media v2/Calls/send/actions
are deferred because they carry security, lifecycle or domain sequencing.

## UI transition parity

Before = after; state changes remain ordered as in the original source.

| Trigger | Current behavior retained |
|---|---|
| Reply | Set replyTo; editing remains unchanged; composer prefers editingMessage |
| Begin edit | Set editingMessage, clear replyTo, set draft to exact message.text |
| Cancel edit | Clear editingMessage and draft; saveDraft(chatId, ""); retain independently selected reply |
| Cancel reply | Clear replyTo only; retain draft |
| Report | Select message.id; close sets null |
| Details | Open true, hide conversation; back false; mount requires chat |
| Search header toggle | Invert open flag; retain query even when hiding search |
| Search close button | Open false, then query empty |
| Search input | Set exact value; filtering uses trimmed locale-lowercase query |
| Search/jump | Retain query/open state; existing jumpToMessage handles IDs/sequences |
| Header back | Dispatch window syncup-close-chat |
| Composer/media/message callbacks | Existing state setters/runtime owners and callback ordering |

No UI-state semantics changed.

## Effects and dependency parity

All existing effects remain in Conversation. None moved or acquired action dependencies.
Stable React setters are preserved by the local custom hook.

| Effect | Dependencies before | Dependencies after |
|---|---|---|
| Searchable projection | [chat, chatId, messages, onSearchableMessages, user.id] | Same |
| Layout/scroll restoration | [messages, loading, loadingOlder, messageSearch, highlightMessage] | Same |
| Initial load | [chatId, loadConversation] | Same |
| SSE/window wake/fallback | [chatId, loadConversation, refreshInbox, user.id] | Same |
| Typing guards reset | [chatId] | Same |
| Draft restore | [chatId] | Same |
| Draft persistence | [chatId, draft] | Same |
| Media v2 subscription | [chat, chatId, onQueued] | Same |
| External call intent | [callIntent, chat, chatId, onCallIntentConsumed] | Same |

## Ref parity

All 17 refs stay in Conversation with identical initialization/ownership:
messagesRef, handledCallIntent, lastSeq, messageListRef, pendingJumpId,
initialScrollPending, scrollAnchor, loadingOlderRef, shouldStickToBottom,
lastTypingSent, typingActive, typingTimers, submittingRef, uploadingFileKeys,
stagedFileKeys, sentV2AttachmentIds, processingV2AttachmentIds.

## Timer and threshold parity

| Contract | Before | After |
|---|---|---|
| Message highlight timeout | 1600 ms | 1600 ms |
| Remote typing expiry | 3500 ms | 3500 ms |
| Draft persistence timeout | 250 ms | 250 ms |
| Realtime fallback interval | 30000 ms | 30000 ms |
| Typing transmission throttle (elapsed-time guard, not timer) | 2500 ms | 2500 ms |
| Older-message scroll threshold | <120px | <120px |
| Bottom-stick threshold | <80px | <80px |

No timers moved/consolidated; highlight's existing timeout cleanup policy is retained.

## Events and realtime

EventSource URL remains /api/events?chat_id=encodeURIComponent(chatId).
Events remain message.created, message.updated, message.pinned, message.reactions,
message.delivered, chat.read, presence, typing and membership.changed. Existing
reloads, receipt/presence/typing patches, reaction refresh and refreshInbox timing
remain untouched. Cleanup closes EventSource, clears typing timers/map and fallback,
and removes the identical window syncup-refresh-chat callback.
syncup-close-chat header/details dispatches and syncup-outbox-wake after send/Media v2
queueing are unchanged. No realtime/event semantics changed.

## Runtime, API and dependency parity

loadConversation, decryptReplyContext, loadOlderMessages, highlightMessage,
jumpToMessage, handleMessageListScroll, uploadFile, sendVoiceNote, startCall,
sendTyping, submitMessage, reactTo, refreshMessageReactions, beginEdit,
deleteMessage, togglePin and copyMessage stay in Conversation unchanged.
No endpoint/method/body/response/error handling migration. All encryption, edit/send,
pending persistence, attachment intent/content/complete, Media v2, voice URL cleanup,
direct/group key creation/call start and intent-consumption sequencing stay intact.

Conversation → messaging-owned UI-state/welcome → React/shared presentation.
No additional cross-feature coupling or private API import; existing crypto/media/
Calls dependencies remain at the runtime owner. Zero runtime dependencies, server,
migrations, CSS/theme, primitive, other feature or architecture guard changes.
Phase 2 persistence ownership/refresh/media findings remain frozen.

## Verification and limitations

Before either extraction, the 23 new Conversation tests passed against the original
component: 14 UI transition/callback tests and 9 runtime tests. Root typecheck and
all 113 unit tests passed at that checkpoint, after the UI-state extraction and
after the welcome extraction. No existing assertion or test runner changed.

Final root typecheck, all 113 unit tests (zero failures/skips), architecture guard
(260 resolved internal import/export edges) and client/server build passed.
Baseline architecture checked 257 edges. The three added edges are the two local
Conversation imports and the welcome component's shared User type import; existing
BrandMark/Avatar edges move to the welcome component. Existing LiveKit chunk-size
and jobStore static/dynamic import build warnings remain.

Conversation measures 1287 non-trailing-blank lines before and 1258 after (the
prompt's approximate count includes the final empty line). Only auxiliary view
state/transitions and the no-chat presentation moved. A TypeScript AST comparison
against the required SHA found all 9 effect call expressions, 17 ref declarations
and 17 named runtime function bodies identical, normalizing CRLF only. Expanded
rendered element trees matched for no-chat, normal, details, report, search, reply
and edit states. Functions are omitted by tree serialization; the 23 behavioral
tests protect callbacks and observable sequencing independently.

The unit harness executes the real component/runtime bodies and extracted modules
through the existing TypeScript/VM test infrastructure. It substitutes explicit
network, crypto, storage, media and child-component boundaries; named state/ref
slots avoid hook-index assertions. Timers and effect mounting are controlled by
tests. Its DOM surface exposes only a supplied highlighted element. It does not
model React scheduling/concurrency, a complete browser, real cryptography,
IndexedDB, backend authorization or real Media v2/LiveKit operation.

The test-only conversation-preview HTML/TSX fixture uses the real UI hook, welcome,
header, list, composer, details and report components, existing workspace shell
components and existing styles. Plaintext messages are seeded; fetch is disabled;
runtime callbacks are inert. Browser checks at 1440×900 and 390×844 covered desktop
light/dark welcome, mobile no-chat inbox (welcome remains display:none), desktop
and mobile search/report/details open/close, query retention across header toggles,
explicit query clearing, mobile back and dark mobile details. Browser console
reported no errors. Fixture controls are visibly labeled and overlap a small
portion of the composer; that overlay is test-only. Screenshots were saved under
the task's local visualizations directory with phase7-* filenames.

No CSS/theme, server, migrations, package/lockfile, existing child component or
feature API diff. Authenticated end-to-end messaging, database integration, actual
uploads/recording and live Calls were not exercised; no claim of those checks is
implied. The fixture and unit boundaries do not establish end-to-end correctness.

## Remaining Conversation debt

The retained workflows are load/decryption, pagination, scroll, realtime, typing,
drafts, uploads, Media v2, Calls, encrypted send/outbox, reactions/delete/pin and
direct API usage. Existing persistence account-ownership, refresh/media lifecycle
and security-sensitive sequencing findings remain deferred. These workflows stay
with their current state, refs and effects until a separately characterized pass.

No UI-state semantics changed. No realtime/event semantics changed.
No crypto/send/upload semantics changed. No Calls semantics changed.
No wire-contract changes. No functional/domain behavior changed.
