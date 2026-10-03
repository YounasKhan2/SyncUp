# Conversation presentation architecture — Phase 03, Pass 01

## A. Baseline

Required main `3f66945f8765ae7fb8928ba982af329cf97e018b` was fetched and verified exactly; the working tree was clean. Branch: `refactor/syncup-conversation-presentation-pass-01`. Governing evidence read: Component Phase01 contract/inventory, Component Phase02 Workspace report, Foundation Phase07 Conversation characterization, Phase10 ownership and Phase11 validation. The current repository is authoritative.

All six commands ran independently before production edits:

| Command | Baseline result |
| --- | --- |
| `npm run typecheck` | PASS, exit0; client/config/server |
| `npm test` | PASS, exit0;203/203, zero failures/skips;30942.9102ms |
| `npm run check:architecture` | PASS, exit0;267 resolved edges,21 informational,0 violations |
| `npm run build` | PASS, exit0; existing LiveKit chunk >500kB and jobStore ineffective dynamic-import warnings |
| `npm run test:media-v2` | PASS, exit0;11/11, zero failures/skips;214.449ms |
| `npm run test:integration` | PASS, exit0;1/1, zero failures/skips;24745.4559ms |

No environment, rate limiter, credentials, dependencies, configuration or assertion was changed. Local complete command logs: `.git/component-phase03-baseline-*.log`; selected integration logs are committed below. Final committed HEAD commands repeat independently and are reported in the PR/completion report.

## B. Messaging pre-change inventory

[Baseline inventory](component-phase-03-evidence/pre-change-inventory.json) records all15 messaging files from the required SHA: exports, complete declared props/types, static imports, cross-feature/shared imports, every JSX element/attribute, classes, IDs/htmlFor, refs, keys, handlers, effect bodies/dependencies, API/persistence/crypto/browser-resource calls and consumer references. Consumer references are a conservative name-based search, including historical test evidence; live imports were separately checked before/after. Global CSS remains loaded by index/App, not by these components.

| Candidate | Exports/props and actual boundary | DOM/resource contracts |
| --- | --- | --- |
| ConversationWelcome | User only; BrandMark/Avatar/shared User; no state/effect/API | section.conversation-pane.welcome-pane; identity/copy; no refs/keys |
| ConversationHeader |10 existing title/avatar/status/action props; Avatar/icons; no state/effect/API | header.conversation-header; native back/details/search/audio/video buttons; audio/video payloads; no refs/keys |
| ReportDialog | messageId/onClose; four local UI state values; private messaging submitReport plus shared primitives | Dialog overlay/section.report-dialog, report-title; reason-option keys; backdrop target/currentTarget guard and busy suppression; API submit remains here; no effects/resources |
| MessageList | Existing21 props; messages/calls/members, callbacks, parent scroll ref; local viewer/reaction state, media useMemo | Fragment plus div.message-list actual scroll owner; article IDs/keys; reply/action/reaction/attachment DOM; MediaViewer portal and attachment child dependencies; no effects in List |
| MessageComposer | Existing18 props; draft/reply/edit/staging/callbacks; local emoji state, textareaRef, [draft] sizing effect | form.message-composer; textarea Enter/requestSubmit/Shift+Enter and blur;160px sizing; emoji requestAnimationFrame focus/selection; child VoiceRecorder/Preview |
| ChatDetailsScreen | Nine existing chat/member/action props;9 UI/server-result state values; shared api | section.chat-details-screen; member keys, invite ID, upgrade overlay;300ms abortable discovery, membership/leave/conversion API, confirm; permission-sensitive gates |
| NewConversation | User/optional initialUsername/onClose/onCreated; form/discovery state | Overlay/labelled new-chat dialog;300ms abortable discovery; key bundle/member discovery and encrypted initial message/create ordering |
| RequestsPanel | requests/onAccept/onIgnore/onClose; decrypted preview state | section.request-list-panel; request-card keys; [requests] decrypt active-flag cleanup; callbacks receive original request |
| SearchDialog | chats/messages/onClose/onSelectChat/onSelectPerson; existing SearchableMessage type export | Overlay/labelled search-dialog; autofocus;250ms abortable API search and Escape listener; access-filtered plaintext session cache; result keys |
| MessageAttachment | Existing attachment/pending/onOpen props; hydration/playback/download state/effects | Browser observers, aborts, URLs, media refs; V1/V2/cache dependencies; download/retry/playback lifetimes |
| VoiceRecorder / VoicePreview | Existing recording/preview props and VoiceDraft export | MediaRecorder/getUserMedia/tracks/AudioContext/interval; URL/audio lifetime and cleanup |
| useConversationUiState | Four auxiliary UI state values and existing transitions only; React import | No DOM/ref/effect/transport/persistence/crypto |

The additional files are Conversation orchestration, api.ts and outbox.ts. Their full inventory and frozen source digests are included. MessageList/Composer existing contracts are retained rather than redesigned. Types remain in their existing owners; local props travel with their mechanically relocated component.

Before:

```text
messaging/
  Conversation.tsx, ConversationHeader.tsx, ConversationWelcome.tsx
  MessageList.tsx, MessageComposer.tsx, MessageAttachment.tsx, VoiceRecorder.tsx
  ChatDetailsScreen.tsx, NewConversation.tsx, RequestsPanel.tsx
  SearchDialog.tsx, ReportDialog.tsx, useConversationUiState.ts
  api.ts, outbox.ts
```

## C. Risk classification

Moved: Welcome/Header are pure presentation. ReportDialog is presentation plus local form state and one already-characterized private API submission; no effects, browser resources, crypto or persistence. Its submit/error/finally/backdrop semantics remain source-identical. The narrow UI hook is UI-state only.

Retained: MessageList is presentation with meaningful interaction/ref/media-child contracts; Composer additionally owns textarea measurement and native selection/focus behavior. These paths could be relocated in a separately bounded pass, but this pass does not require it. ChatDetails and SearchDialog combine presentation with network/abort/listener lifetimes; ChatDetails has membership/permission mutations. NewConversation and RequestsPanel own crypto, hence are security-sensitive. MessageAttachment and VoiceRecorder are resource-sensitive/high-risk and remain in place by default. Conversation is high-risk runtime orchestration; api/outbox remain infrastructure owners. Folder completeness and line count do not override those boundaries.

## D. Characterization added

Four tests first passed against unchanged production, before extraction/relocation:

- Two search presentation tests protect the exact div root, Search/input/span/button order, icon size/ARIA, autofocus/value/placeholder/label, absence of ref/key/keyboard handlers, immediate Header→search→List→Composer sibling order, whitespace/zero match labels, exact query forwarding, parent filtering and explicit close/reset/conditional unmount. Existing Phase07 search toggle/retention, pending/deleted filtering, jump/highlight and broader callback tests remain unchanged.
- Two source tests freeze all15 messaging modules plus WorkspacePage against the required base. Necessary relative imports resolve to canonical dependency identities; only four approved relocated targets map back. Complete source otherwise matches. Root search imports/conditional region are narrowly excluded from its full digest and separately checked against the exact frozen original or exact approved replacement. The complete extracted component digest was derived and saved from original markup before extraction. The parent match-count expression is copied exactly, not reimplemented in the child. Compatibility copies are forbidden.

Standard203→207 tests. Focused55/55 pass after relocation, including the unchanged Conversation runtime/UI, report API/dialog/primitive and Phase10 ownership assertions. Harness modifications only bind relocated paths/shared dependencies and execute the real SearchBar. No assertion is removed/weakened, no test runner/discovery change.

Browser search actions supplement VM tests: exact query filtering, Enter, Escape, header hide/reopen with retained query/autofocus, keyboard explicit close and reopen with cleared query. Before/after action records are exactly equal; no search keyboard behavior or focus restoration was added.

## E. Files moved

| Original under messaging/ | New path under messaging/ | Mechanical import edits |
| --- | --- | --- |
| ConversationWelcome.tsx | components/ConversationWelcome.tsx | shared imports gain one ../ |
| ConversationHeader.tsx | components/ConversationHeader.tsx | Avatar import gains one ../ |
| ReportDialog.tsx | components/ReportDialog.tsx | shared imports gain one ../; ./api→../api |
| useConversationUiState.ts | hooks/useConversationUiState.ts | None; byte-identical |

Conversation's four direct imports and test-only live consumers update to canonical paths. No selected component is imported by WorkspacePage; that root is source-identical. No new barrel/alias/compatibility file exists.

After:

```text
messaging/
  Conversation.tsx, api.ts, outbox.ts
  MessageList.tsx, MessageComposer.tsx, MessageAttachment.tsx, VoiceRecorder.tsx
  ChatDetailsScreen.tsx, NewConversation.tsx, RequestsPanel.tsx, SearchDialog.tsx
  components/
    ConversationWelcome.tsx, ConversationHeader.tsx, ReportDialog.tsx
    ConversationSearchBar.tsx
  hooks/useConversationUiState.ts
```

## F. Search region extraction

ConversationSearchBar returns the original div.conversation-search-bar and its original four children. Four presentation props: query, precomputed label, onQueryChange, onClose. No state/effect/ref/timer/API/message data/cache/persistence/crypto/navigation/highlight logic. The only child import is lucide-react Search/X. Conditional mounting stays in Conversation. React autofocus stays on the same input; change forwards event.target.value; close uses the same parent callback. No wrapper, key, form, portal or keyboard handler is added. Parent retains trimmed/case-normalized matching, pending/deleted exclusion, count and List filtering separately, with exact existing empty-result copy.

## G. Conversation responsibilities retained

1258→1244 physical non-trailing-blank lines. Approved changes only: four relocated direct imports, replacement of root Search/X import with SearchBar import, and that existing conditional visual region. Full source outside those approved edits is frozen, including all callback bodies, props, refs, comments, effect order and JSX siblings. Reduction is a consequence of the visual boundary, not the objective.

Retained: load/decrypt/read acknowledgement, chat/message/call state, sequence/pagination, layout scroll anchoring/sticky bottom/jump/highlight, SSE/fallback/presence/typing, draft restore/save, reply/edit, encryption/send/outbox/retry, attachment and voice preparation, V2 completion and sent/processing guards, call creation/intent/group keys and searchable decrypted-message publication. The UI hook remains four auxiliary states; no god hook/new runtime hook exists.

## H. Effects/timers/events parity

[Root AST evidence](component-phase-03-evidence/root-runtime-parity.json): all9 complete effect call expressions and17 complete ref declarations are identical, normalizing CRLF only. All non-root named function declarations match; the complete root-source gate also protects arrow callbacks and everything outside the approved search edits.

| Effect | Exact unchanged dependencies |
| --- | --- |
| Search publication | [chat, chatId, messages, onSearchableMessages, user.id] |
| Initial load | [chatId, loadConversation] |
| Layout scroll | [messages, loading, loadingOlder, messageSearch, highlightMessage] |
| SSE/realtime | [chatId, loadConversation, refreshInbox, user.id] |
| Typing reset | [chatId] |
| Draft restore | [chatId] |
| Draft save | [chatId, draft] |
| Media V2 completion | [chat, chatId, onQueued] |
| Call intent | [callIntent, chat, chatId, onCallIntentConsumed] |

Effect movement/dependency/cleanup changes ZERO. Timers retained: highlight1600ms, remote typing3500ms, draft250ms, fallback30000ms, typing throttle2500ms; older<120 and bottom-stick<80. No consolidation. Existing untracked highlight timeout policy remains.

Events retained exactly: message.created, message.updated, message.pinned, message.reactions, message.delivered, chat.read, presence, typing, membership.changed; custom syncup-refresh-chat/close-chat/outbox-wake with same ownership/dispatch ordering. EventSource closure, listener removal, cancelled flags, timer/map cleanup and effect mount placement remain unchanged. Root owns all17 refs, including scroll, sequence, typing, submit/staging/V2 and call-intent guards.

## I. Crypto/outbox/media/calls parity

Message encryption/decryption, reply envelopes, recipients, attachment/call keys, vault/private key and zeroing behavior unchanged. No crypto-owning child relocated. messaging/api.ts and outbox.ts complete source unchanged; direct Conversation API calls remain at root. No persistence namespace, retry, idempotency/order or failure-handling migration. features/media including V2/worker/OPFS/IndexedDB, features/calls, auth, server/database/migrations unchanged. Header call button payloads remain audio/video and Conversation retains the original startCall callbacks/order; existing direct/group intent tests pass. Resource-sensitive MessageAttachment/VoiceRecorder remain source-identical at their original paths, so literal resource/import.meta/worker semantics are not moved.

## J. DOM parity

42/42 complete before/after records are exactly equal: root/every descendant tag, all sorted attributes (classes/IDs/ARIA), every child-node/text order, input values, every computed CSS property, every bounding rectangle, active element label, viewport/DPR/effective appearance and diagnostics. No extra DOM wrapper; List scroll ref remains on its existing div; keys/refs are source/test evidence because React keys are not DOM attributes.

[Comparison](component-phase-03-evidence/comparison.json), [84 full snapshots](component-phase-03-evidence/computed-dom-bounds.ndjson.gz) (standard gzip NDJSON, one record per line), [seven search action comparisons](component-phase-03-evidence/search-actions.json). All completed browser captures/actions have empty console/error/resource/unhandled-rejection diagnostics. Browser renders real selected components/hook/List/Composer/details/report, with seeded plaintext and disabled fetch; it does not mount Conversation runtime. Fixture controls remain explicitly labelled and can overlap the composer, as before.

## K. CSS/style parity

CSS diff ZERO. Phase10 eight ownership tests pass with frozen1157 rule nodes/4507 declarations, all type contracts/import order and these SHA256 values:

| Stream | Digest |
| --- | --- |
| Expanded platform | 5b3f9a226487b5045f85076c98b4e284af92d79eb453437888e1368855cd0e44 |
| Spaces region | 4028bcbccd9e7493ad4c3fdf12e1bc116735086a177e8e3968aa65d592c64ee9 |
| Tokens | ebdf159beeb12fbf09e13130180dabc0dcc96fc833986fe1e3c9b537468fa26d |
| Primitives | c8537a42c94ff98ec2c421d457b729eae191fe37ab8a8e5652243ac7a67b84e1 |

39/42 JPEG pairs byte-identical. The3 differing search screenshots differ only inside decoded pixel bounds `[415,63,426,81]` desktop Light and `[63,63,80,88]` mobile Light/Dark. These are the focused input's blinking caret and nearby JPEG block pixels, confirmed by inspecting original images; every decoded pixel outside those bounds is identical. Full snapshots/focus are exact. [Raster difference bounds](component-phase-03-evidence/raster-differences.json) preserves this distinction; no claim that all42 images are byte-identical and no post-change baseline replacement. Raw JPEG hashes/raster sizes for all42 are committed in comparison.json; representative desktop/mobile before/after images are retained.

CSS-sensitive flex/overflow, message-mine/bubble, hover actions, reply quote, textarea/focus-within, picker containing blocks, absolute-position contexts and search sibling placement unchanged. No inline style/class/selector/palette/typography/spacing/contrast/dialog/known responsive debt fix.

## L. Responsive/theme validation

Seven scenes ×2 sizes ×3 modes =42 pairs: welcome, normal conversation, search open with query, report, contact details, reply and prefilled composer draft (URL scene named edit). Test-only URL scene/theme controls and System option were added before baseline captures; production was still the required base. Same seeded data/config/fixture markup is used afterward, replacing duplicated search markup with the real extracted component.

| Actual CSS viewport and decoded raster | Modes | Complete snapshot equality |
| --- | --- | --- |
| 1440×900 | Light, Dark, System→Light |21/21 |
| 390×844 | Light, Dark, System→Light |21/21 |

Host DPR1.190000057220459; calibrated viewport overrides1714×1071 /464×1004 yield the required actual sizes. SystemDark=false before/after; no OS setting changed and no live OS light/dark switching claim. Search input autofocus is confirmed in all12 search captures. Mobile back and existing shell/control placement remain source-identical. Attachment hydration, recording and network mutations were not activated; those components stayed in place. Temporary viewport/tab and owned fixture5174 server were closed before full gates; pre-existing app/API/infrastructure left running.

## M. Architecture changes

267 resolved/21 informational/0 violations→268/21/0. One new internal edge Conversation→ConversationSearchBar. Search/X external icon import moves to child, which creates no internal edge. Four relocations retain resolved dependency identities. ReportDialog still imports its own messaging api.ts; no Workspace/Messaging inversion, shared→feature, private cross-feature API or type ownership migration.

[Read-only cycle audit](component-phase-03-evidence/dependency-cycles.json) scans static/export/literal dynamic/type imports using TypeScript resolution against exact base and current tree:70→71 client TS files;186→187 resolved client occurrences; zero cycles both. Those client-only occurrence counts are distinct from the guard's client/server267→268. No guard/config changes.

## N. Production diff classification

| Production change | Category |
| --- | --- |
| Welcome→components | Mechanical file move + shared-relative import update |
| Header→components | Mechanical file move + shared-relative import update |
| ReportDialog→components | Mechanical file move + shared/private-local api import update |
| UI hook→hooks | Mechanical file move, byte-identical |
| Conversation four relocated imports | Mechanical import update |
| Conversation icon→SearchBar import and conditional visual region | Bounded presentation extraction |
| components/ConversationSearchBar.tsx | Bounded presentation extraction, original root/markup and parent callbacks |

All other changes are tests/harnesses/fixtures/frozen evidence/documentation. No production file outside messaging changes. Behavior/styling/CSS/runtime lifecycle/API/crypto/server/database/migration/package/lock/config diff ZERO beyond classified structural edits.

Validation incident: the temporary relocation script initially normalized two unrelated Auth crypto import spellings, and focused Auth tests rejected the unexpected mock paths. Both exact imports were restored; final Auth diff is empty and focused55/55 passed. No assertions/mocks were changed to accommodate those unauthorized imports. The failed focused attempt is retained locally; this was a corrected intermediate edit, not a hidden passing run. No fixture watcher crash occurred in this phase.

## O. Integration

Baseline real integration PASS1/1, zero skips,24745.4559ms. It exercises actual local HTTP/PostgreSQL/storage contracts, encrypted messaging/authorization/ordering, Spaces objects/permissions/Updates and direct call/token/history contracts; Node integration is not browser E2E or multi-party media. Synthetic records remain in existing persistent infrastructure; rollback is not claimed. Precommit real integration PASS1/1, zero skips,25100.6451ms. Precommit typecheck/build PASS,207/207 standard tests (25628.365ms),268/21/0 architecture and11/11 Media V2 (223.9706ms). Final HEAD results are separately recorded without altering limits/environment to manufacture passes. [Baseline log](component-phase-03-evidence/baseline-integration.log); [precommit log](component-phase-03-evidence/precommit-integration.log).

Before commit repeat all six gates; after commit repeat them at final HEAD plus git diff --check/status. Final results and SHA are published in the PR/completion report rather than amending a verified commit to insert its own hash. Existing LiveKit/jobStore warnings remain unchanged.

## P. Limitations

VM evidence uses explicit child/API/crypto/storage/media boundaries; it is not React scheduling/concurrency or authenticated delivery. Browser evidence uses real presentation children but an isolated seeded fixture and inert runtime callbacks/disabled fetch, not Conversation orchestration. The URL scene named edit only seeds draft text, not editingMessage; those6 captures are draft presentation, not browser edit-selection proof. Existing unchanged VM characterization covers select/cancel edit. No real authenticated DM/group browser delivery, durable offline outbox/IndexedDB/OPFS recovery, draft concurrency, reconnect endurance, auth refresh races, real attachment hydration/uploads/recording, remote/multi-party E2EE/media/device failure, full accessibility/contrast audit or live OS theme switch. Existing security/persistence/UX debt remains as characterized. No denied-network mutation was attempted. Search caret timing prevents byte identity in3 images; bounded decoded differences and full DOM/style parity are reported explicitly.

## Q. Recommended next structural phase

After actual PR review, consider a separately characterized presentation pass for retained messaging surfaces or the approved Spaces presentation boundary. Draft/realtime/scroll hooks require dedicated lifecycle/race characterization and are deferred. This phase stops after opening an unmerged PR; no Spaces, design-system/Tailwind, styling or UX-debt work starts here.
