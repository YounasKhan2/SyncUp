# Component architecture — Phase 01 contract and migration map

## A. Baseline

Foundation final main: `fcb373aae55dabb4277903d0f5454410f7808bae`. Fetched origin, fast-forwarded main to that exact commit, verified a clean working tree, then created `architecture/syncup-component-structure-phase-01`. This phase changes documentation only. All proposed paths below are future work, not implemented moves.

Baseline commands were executed independently on this unchanged production tree:

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS, exit 0, client and server |
| `npm test` | PASS, exit 0, 197/197, zero skipped |
| `npm run check:architecture` | PASS, exit 0, 267 resolved internal edges, 21 informational cross-feature edges, zero violations |
| `npm run build` | PASS, exit 0; existing large LiveKit chunk and ineffective jobStore dynamic-import warnings |
| `npm run test:media-v2` | PASS, exit 0, 11/11, zero skipped |
| `npm run test:integration` | FAIL, exit 1, 0/1, zero skipped; actual HTTP 429 instead of expected 400 at `tests/messaging.integration.test.mjs:740`, invalid-avatar assertion |

The Phase 11 HTTP environment is available. Integration reached the account-avatar portion after messaging, groups, Spaces, permissions and Updates assertions. The existing avatar limiter in `server/features/auth/routes.ts` is 20 changes/hour per default IP key; repeated preceding validation exhausted that shared local window. This differs from Phase 11's authentication-limit failure. No limiter, server, test assertion, credentials, database, or environment was changed to obtain a green result. Integration creates synthetic records in the existing persistent local environment; those records are not claimed to be rolled back. Final HEAD integration must be reported separately even if the limiter remains active.

The first command runner used colon-containing log filenames on Windows; redirection prevented the architecture/media/integration commands from executing. Those three commands were rerun with valid filenames. Only the actual executions above count. Temporary audit scripts/logs live under `.git`, outside the committed diff; no audit tooling dependency was added.

Behavioral reference: [Phase 11 validation](phase-11-final-validation.md), its committed evidence, [Phase 10 ownership](phase-10-types-css-ownership.md), and the existing characterization tests. Future phases compare with this SHA or an explicitly approved descendant. Evidence levels remain distinct: static/unit; fixture/browser with doubles; authenticated browser; real HTTP/database integration; actual external infrastructure; unexecuted E2E. A mocked LiveKit Room is not multi-party E2EE proof. The prior single-participant live room is not remote-video proof. Phase 11's viewport/raster and System-theme caveats remain attached to its evidence.

## B. Current client tree

The complete file tree, physical line counts, exported declarations, all literal static/dynamic/type module specifiers, direct API/browser calls, and state/effect references are recorded in [the source inventory](component-architecture-phase-01-inventory.md). Counts include blank/comment lines, not complexity; compressed VoiceRecorder illustrates why line count cannot rank risk. Binary assets are listed in the tree but have no text line count. No ownership is inferred solely from a filename.

| Feature | Files | Physical lines | Existing nested directories | Implementation ownership |
| --- | ---: | ---: | --- | --- |
| account | 3 | 387 | none | Profile/avatar/session form and safety actions; six narrow API functions |
| auth | 3 | 421 | crypto | Sign-up/sign-in/unlock; module-scoped private key and WebCrypto |
| calls | 2 | 378 | none | LiveKit room/device/track lifecycle and group media-key creation |
| media | 18 | 1595 | v2 | Portal viewer; hydration/cache; record encryption, workers, OPFS, persisted resumable uploads |
| messaging | 15 | 2973 | none | Conversation orchestration; message presentation/actions; dialogs; recording; outbox/drafts |
| spaces | 7 | 1761 | none | Spaces and Updates roots; shared-object interaction; voice/legacy presentation; nine domain types and owned CSS region |
| workspace | 8 | 888 | none | Global feature composition/navigation; inbox; call-history presentation; outbox and incoming-call coordination |

CSS is loaded globally by App/index entrypoints; feature TSX files do not independently load their selectors. A file move must preserve the entry CSS stream. `main.tsx` owns StrictMode, appearance bootstrap and Media V2 runtime startup, outside all page lifetimes.

## C. Large/root file inventory

| File under client/src | Lines | Actual responsibilities / proposed first boundary |
| --- | ---: | --- |
| features/messaging/Conversation.tsx | 1258 | Chat loading/decryption/read acknowledgements, pagination/scroll anchoring, SSE/presence/typing, persisted draft, encrypted send/edit/outbox, V2 completion, call creation; first isolate the existing visual search bar only |
| features/spaces/SpacesPage.tsx | 1156 | Overview/sidebar/channel/messages/composer, seven dialog regions, permission drafts, objects/search/files, SSE/polls, encrypted legacy history, voice payloads; first sidebar presentation |
| features/messaging/MessageAttachment.tsx | 506 | Intersection visibility, image/poster/voice hydration, download/retry/playback state and URL lifetime; postpone lifecycle extraction |
| features/workspace/WorkspacePage.tsx | 505 | Feature selection and modal/call composition, inbox decrypt/refresh, outbox flushing, sign-out/key lock, call intent/answer/end; keep orchestration mounted at root |
| features/calls/CallWindow.tsx | 360 | Room/participant events, injected tracks, permissions/devices, worker/key teardown, status/voice roster; presentation only before lifecycle work |
| features/account/AccountPanel.tsx | 234 | Profile and avatar editing, preview URL, sessions/revocation, appearance, nested SafetySettings |
| features/auth/AuthScreen.tsx / UnlockScreen.tsx | 121 / 68 | Credential forms plus vault creation/initialization/unlock and auth callbacks |
| features/spaces/UpdatesPage.tsx | 106 | Three update stacks/live calls, search/filter, response/state mutations and source navigation |
| features/media/MediaViewer.tsx | 101 | Body portal, hydration and URL ownership, media controls, keyboard navigation/zoom |
| app/AppRouter.tsx | 72 | Session bootstrap, service-error/auth/unlock/workspace transitions; already coherent root |

Infrastructure sizes are not extraction mandates: `media/v2/uploadManager.ts` 300, auth crypto 232, shared types 200, OPFS staging 155, jobStore 142. `platform.css` is 1301 lines but remains frozen.

## D. Responsibility matrix

Legend: C composition, P presentation, S state, E effects, A API, D persistence, K crypto, R realtime, L domain logic, N navigation, B browser/device. Entries identify direct or orchestrated responsibilities; they do not imply new shared services.

| Owner | Responsibilities | Boundary rationale |
| --- | --- | --- |
| AppRouter | C P S E A K N B | User/vault gate must remain above Workspace; reload is existing recovery |
| WorkspacePage | C P S E A D K L N B | Root-wide queues/calls/navigation outlive child regions; polling is not SSE |
| Conversation | C P S E A D K R L N B | Message sequence, reply/edit, key recipients, upload completion and scroll order intersect |
| MessageList / MessageComposer | C P S E L B | Viewer/reaction picker and textarea/emoji state are bounded; parent retains message mutations |
| MessageAttachment / VoiceRecorder | P S E A K L B | Browser resources have explicit teardown, including tracks/audio/URLs |
| SpacesPage | C P S E A K R L N B | Role-derived controls and server checks, channel selection/cursors and legacy decode |
| UpdatesPage / SharedObjectCard | C P S E A L N | Stack mutation remains root; card selection mirrors server response; no encrypted channel runtime |
| CallWindow | C P S E A K R L B | SDK tracks/room and key/worker lifetime form one security boundary |
| AccountPanel / SafetySettings | C P S E A L B | API form/session state, avatar URLs and privacy/report/block actions |
| AuthScreen / UnlockScreen | C P S A K L | Forms are small; success order and secret lifetime dominate risk |
| MediaViewer / hydrators | C P S E A D K N B | Viewer controls vs shared feature hydration/cache/decrypt lifetime |
| Media V2 runtime | E A D K L B | Singleton startup, worker protocol, upload state/retry/resume and staging are infrastructure |

Main page/root contract: primarily compose feature-owned regions and orchestrate feature-level state. Keep coherent orchestration visible. Do not replace a large component with a hook containing all of its state, effects and callbacks. A coherent 300-line root can be preferable to a 100-line root concealing unrelated behavior.

## E. State ownership

The inventory lists every direct useState binding per file, including existing hooks. The grouping below assigns each major state family; classifications overlap where server/persistence data is also security-sensitive.

| Owner / bindings | Classification | Future owner / constraint |
| --- | --- | --- |
| AppRouter user/checkingSession/sessionError/vaultUnlocked | root orchestration; server-derived; security-sensitive | Remain root; do not change initial vault snapshot or auth callback sequence |
| Workspace navigation hook showRequests/showCalls/showUpdates/showSpaces/updatesTarget/activeChatId | root orchestration; pure UI | Existing narrow hook; preserve transition combinations and Conversation key |
| Workspace currentUser/chats/requests/callHistory/incomingCall | server-derived; root orchestration | Root coordinates multiple regions, including decrypted previews |
| Workspace activeCall/callIntent/newCallRequested/newCallRequestedType | root orchestration; security-sensitive | Root owns transfer and zeroing of group keys and call intent consumption |
| Workspace pending/drafts/appearance/online | persistence-backed; security-sensitive for drafts/queue; browser-derived online | Existing stores/lifecycle; root queue flush must not mount with Inbox |
| Workspace accountOpen/filter/newConversation/searchOpen/initialUsername/error/searchableMessages | pure UI / root orchestration; decrypted search cache security-sensitive | Overlay visibility and cross-region search remain root; no universal state prop bag |
| Conversation chat/messages/callHistory/hasOlderMessages/onlineUsers/typingUsers | server-derived; feature-region; decrypted messages security-sensitive | Sequence/ref updates, read receipts and realtime remain coupled until specifically characterized |
| Conversation draft/replyTo/editingMessage/stagedAttachments/voiceDraft/videoSends | feature-region; persistence-backed draft/jobs; security-sensitive send payload | Composer controls may consume focused props; encryption/outbox/V2 completion stay parent |
| Conversation uploading/submitting/callStarting/error/loading/loadingOlder and UI hook reportingMessageId/detailsOpen/messageSearchOpen/messageSearch | pure UI / feature-region | Existing UI hook remains narrow; keep busy/error routing unchanged |
| Spaces spaces/space/channelId/historyCursor/messages/sharedObjects | server-derived / root orchestration / feature-region | Root selects identity/cursor and derives permissions; no independent child fetch duplication |
| Spaces legacyHistory | server-derived; security-sensitive | Channel-tagged decrypted messages, cursor/error/loading retained as a unit |
| Spaces searchOpen/query/after/before/from/has/objectType/results/submitted, filePanelOpen/channelFiles | feature-region; server-derived results | Search/file visual dialogs first; abort/loading semantics cannot be invented |
| Spaces spaceName/description/icon; inviteUsername/role/channels; channelName/type/topic/category; categoryName; settings tabs/topicDraft/permissionDraft | feature-region; permissionDraft security-sensitive | Dialog control props in first pass; later local form ownership only with identical mount/reset behavior |
| Spaces object menus/dialog/title/options/items/assignee/startsAt/location/multiSelect/anonymous | feature-region; domain form | Poll/event/checklist discriminated forms, preserve payloads and validation |
| Spaces highlightedMessageId/mentionNotice/draft/error/busy/collapsedCategories | pure UI / feature-region / root-shared busy | Preserve category state across selection and global busy behavior; no new persistence |
| Calls muted/cameraEnabled/connected/localIdentity/peers/groupRoster/voiceRoster/finished/error | feature-region; SDK/server-derived; permission-sensitive | Room/track/worker refs and passed e2eeKey remain lifecycle owner; controls cannot independently create rooms |
| Account errors/saved/loading/session list/current ID/avatar file/preview/busy | feature-region; server-derived; sessions security-sensitive | Avatar preview child candidate; session mutation/root save ordering preserved |
| Safety blockedUsers/username/report fields/notice/loading/error | feature-region; server-derived; privacy-sensitive | Separate account-owned surface, not generic report hook |
| NewConversation mode/username/matches/selected/group members/firstMessage/busy/errors | feature-region; encrypted first message security-sensitive | Form UI may split; discovery/encryption/creation order frozen |
| ChatDetails discovery/selection/conversion fields/errors; SearchDialog query/searching/results/errors; ReportDialog reason/details/submitting/errors | feature-region / pure UI / server-derived | Preserve each dialog's existing form and keyboard lifetime; different reports have different payloads |
| RequestsPanel previews; SharedObjectCard selectedOptions | server-derived; decrypted previews security-sensitive / card UI | Keep crypto owner and server-response synchronization |
| MediaViewer url/error/zoom/retry/progress; MessageAttachment preview/poster/video/voice states | feature-region; browser-resource / decrypted media security-sensitive | URL owner must revoke exactly its own URL; no root-store promotion |
| VoiceRecorder recording/paused/elapsed/levels; VoicePreview playing | feature-region; browser/device | Recorder refs/chunks/tracks/timing are not parent state; cleanup remains mounted owner |

Refs are part of the contract: Workspace flushing mutex; Conversation sequence, typing timers/throttle, scroll anchors, sent/processing V2 IDs and handled-call-intent; Spaces end/file refs; Calls Room/media stage/worker; recorder/audio refs. Moving state without those refs changes behavior.

## F. Effect/subscription/timer ownership

The inventory records all 46 useEffect/useLayoutEffect call sites with exact dependencies and complete callback/cleanup source. This is source evidence, not a proposal to add/remove dependencies. Conditional early returns, absence of cancellation and untracked timers must be preserved rather than silently repaired.

| Root effect | Dependency array | Lifetime / side effects | Future classification |
| --- | --- | --- | --- |
| AppRouter session | `[]` | GET auth/me; cancelled flag cleanup, no network abort | must remain at root; security-sensitive |
| Workspace incoming calls | `[activeCall]` | immediate direct/group incoming GET; 3000ms interval; active flag and clearInterval | narrow future hook candidate, high risk call coordination |
| Workspace inbox/outbox | `[flushOutbox, refreshInbox]` | 0ms initial timeout; 15000ms refresh/flush; online/offline/outbox-wake listeners; clears/removes and active flag | high risk / freeze; root-mounted |
| Workspace close/refresh events | `[refreshInbox]` | close-chat sets active chat; refresh-chat loads inbox; removes both | must remain root |
| Workspace resize | `[showCalls]` | resize checks max-width 700px and clears active chat; removes listener | root/navigation hook candidate, medium |
| Workspace Ctrl/Cmd K | `[]` | window keydown/preventDefault; removes listener | root search orchestration |
| Conversation search publication | `[chat, chatId, messages, onSearchableMessages, user.id]` | publishes filtered decrypted searchable messages; no cleanup | root orchestration; security-sensitive cache |
| Conversation initial load | `[chatId, loadConversation]` | resets seq and loads/decrypts/read-acks; no effect cancellation | high risk / freeze |
| Conversation layout scroll | `[messages, loading, loadingOlder, messageSearch, highlightMessage]` | useLayoutEffect applies pending jump, history anchor, initial bottom, sticky bottom; no cleanup | narrow future scroll hook only with refs/DOM parity; high risk |
| Conversation SSE | `[chatId, loadConversation, refreshInbox, user.id]` | messages/presence/typing/membership; 30000ms fallback; 3500ms typing expiry; closes source, clears interval and typing timeouts, removes refresh listener | high risk / freeze; later narrow realtime hook with exact lifetime |
| Conversation typing reset | `[chatId]` | resets active/throttle refs; no cleanup | typing unit, not child presentation |
| Conversation draft restore | `[chatId]` | IndexedDB load; cancelled flag cleanup | narrow future draft hook; persistence-sensitive |
| Conversation draft save | `[chatId, draft]` | 250ms debounce save; clears timeout, does not abort already-started write | same draft unit; preserve restore/save race |
| Conversation V2 completion | `[chat, chatId, onQueued]` | manager subscribe returns unsubscribe; sent IDs/processing guards; dynamically reads jobStore, encrypts/posts or queues send | security-sensitive / freeze |
| Conversation call intent | `[callIntent, chat, chatId, onCallIntentConsumed]` | consume once before startCall; no cleanup | root orchestration, security-sensitive key handoff |
| Spaces update target | `[openTarget?.spaceId, openTarget?.channelId, openTarget?.messageId, space?.id]` | optional GET space; selection/cursor/highlight; no cancellation | must remain root; future focused navigation hook |
| Spaces list | `[]` | GET spaces, active flag cleanup | narrow list hook candidate, medium |
| Spaces selected-space refresh | `[space?.id]` | 15000ms interval; no immediate refresh; flag/clear cleanup | high risk permissions-derived data; freeze |
| Spaces channel data | `[space?.id, channelId, activeChannel?.name, historyCursor]` | immediate messages+objects; channel SSE; 5000ms fallback; active flag, clear interval, close stream | high risk / freeze; cursor and permission selection coupled |
| Spaces legacy history | `[legacyChannelId]` | encrypted chat GET limit50; decrypt; AbortController cleanup and aborted guard | security-sensitive / freeze |
| Spaces end scroll | `[messages]` | smooth end scroll, no cleanup | child candidate only with same ref/commit timing |
| Spaces target highlight | `[messages, highlightedMessageId]` | getElementById, smooth center; 4000ms timeout with no cleanup | high risk timing; freeze current semantics |
| Updates initial load | `[]` | GET stacks/calls; active flag cleanup | narrow future hook candidate; mutations remain root |
| Calls room connection | `[callId, video, isGroup, isHost, e2eeKey, isVoiceRoom, voiceSpaceId, voiceChannelId, canPublish]` | SDK events, token POST, worker/provider, mic/camera; cancelled/disconnect/terminate/zero-key cleanup | security-sensitive / freeze |
| Calls status | `[callId, isGroup, e2eeKey, isVoiceRoom]` | immediate+4000ms GET except voice; terminal disconnect/zero/terminate; cancellation/clear interval | security-sensitive / freeze |
| Calls voice roster | `[isVoiceRoom, voiceSpaceId, voiceChannelId]` | immediate+5000ms GET; missing room terminates; cancellation/clear interval | high risk permissions/lifetime; freeze |
| Account preview/session effects | `[avatarPreview]`; `[]` | revoke replaced/unmounted URL; GET sessions guarded by mounted flag | safe future avatar child owner; sessions sensitive |
| Safety initial blocks | `[]` | GET blocks; active flag cleanup | keep SafetySettings owner |
| MediaViewer hydration/keyboard | `[active, retry]`; `[isVideo, next, onChange, onClose, previous]` | V1/V2 hydrate; cancelled/revoke URL; Escape/arrows/zoom listener removed | hydration high risk; keyboard bounded owner |

Other effects: MessageAttachment has six visibility/hydration/cache/URL effects (inventory gives dependencies, observer disconnect, cancellation, voice abort, and URL revocation). MessageComposer `[draft]` writes textarea height capped160px and overflow. NewConversation discovery debounce300ms, ChatDetails discovery300ms and SearchDialog search250ms abort controller/clear timer; SearchDialog Escape `[onClose]` removes listener. RequestsPanel `[requests]` decrypts previews with active flag. SharedObjectCard `[object.my_response]` resets options. VoiceRecorder `[]` stops tracks/closes AudioContext/clears120ms interval; VoicePreview `[draft.url]` revokes URL. Auth/Unlock have no effects; handler async order is still sensitive.

| Remaining effect family | Future classification |
| --- | --- |
| All six MessageAttachment effects | High risk / freeze; keep observer, cancellation/abort and URL refs with attachment identity |
| MessageComposer textarea sizing | Safe existing child ownership; preserve measured node and effect timing |
| NewConversation / ChatDetails discovery | Narrow future hook candidates only inside respective feature surfaces; preserve300ms delay and abort; group/contact filtering remains domain-specific |
| SearchDialog search / Escape | Safe existing child ownership; any hook remains search-specific, with250ms debounce and mounted keyboard lifetime |
| RequestsPanel preview decrypt | Security-sensitive / freeze; no generic preview hook shared with plaintext Spaces |
| SharedObjectCard option synchronization | Safe existing child ownership; preserve object.my_response reference dependency rather than changing equality |
| VoiceRecorder / VoicePreview cleanup | High risk browser resource ownership / freeze; retain tracks/context/timer and preview URL with mounted owner |

Event contract: preserve React onClick/onChange/onSubmit/onKeyDown/onScroll/audio play/pause/ended/time/metadata handlers, target/currentTarget checks, key/ID/ref placement, disabled/permission gates, and preventDefault. Exact direct call sites are in the inventory. Conversation SSE names: message.created/updated/pinned/reactions/delivered, chat.read, presence, typing, membership.changed. Spaces: channel.message/object/mention. Custom window events: syncup-close-chat, syncup-refresh-chat, syncup-outbox-wake. Online/offline are independently consumed by Workspace and the singleton media runtime; do not merge their listeners.

Non-effect timers remain protected: Conversation jump highlight1600ms and typing throttle2500ms; outbox retry min30000ms exponential500ms base; VoiceRecorder chunks500ms and levels120ms; hydration download URL revoke1000ms; upload manager retry1000–30000ms plus jitter and abortable timer. Appearance matchMedia change listener is bootstrap-owned, with HMR disposal. Lifecycle relocation is a behavior change even if the same function body moves.

## G. API ownership

Phase 5 introduced only two private `api.ts` modules, not an API facade for every feature. Account exports listSessions, revokeSession, updateProfile, getCurrentUser, uploadAvatar, removeAvatar. AccountPanel uses these six. Messaging exports submitReport; ReportDialog uses it. Keep these boundaries and their request/refresh behavior.

Direct shared/api consumers bypassing those narrow wrappers: AppRouter session bootstrap; Workspace inbox/requests/auth sign-out/direct+group calls/outbox send; AuthScreen auth/key initialization and UnlockScreen current-user vault fetch; SafetySettings blocks/user reports; Conversation chat/message/read/typing/reaction/pin/calls/upload; NewConversation discovery/contact/group/request; ChatDetails discovery/membership/group-to-Space conversion; SearchDialog search; SpacesPage/UpdatesPage Spaces/search/files/objects/permissions; media hydrators and V2 preparation/manager/transport. Full path expressions are inventoried. These are existing ownership choices, not forbidden violations. A later API consolidation requires a separate bounded request/response contract review, not folder symmetry.

CallWindow's local callApi uses its own fetch/401 refresh path. Shared/api has module-level refreshInFlight and optional navigator.locks `syncup-session-refresh`; the two paths are not one coordinator. Preserve retries, credentials, errors, 204 handling and session-family semantics. V2 range transport directly fetches with Content-Range/AbortSignal and 409 acknowledged-byte recovery; do not replace it with apiUpload. Shared Appwrite initialization is infrastructure, but its presence does not justify moving feature upload orchestration into shared.

## H. Persistence/security-sensitive boundaries

| Boundary | Existing owner and invariant |
| --- | --- |
| Vault/private key | auth/crypto/crypto.ts module-scoped unlocked key; RSA-OAEP/AES-GCM/PBKDF2, envelope recipient semantics, raw-key clearing; Auth/Unlock handler order unchanged |
| Session/refresh | AppRouter/shared api/CallWindow; Workspace sign-out POST then lockKeyBundle then router callback; server session cookies/families and PostgreSQL transactions frozen |
| Draft/outbox | messaging/outbox.ts IndexedDB pending messages and drafts; Workspace flushing mutex/retry/idempotency; plaintext local fields/security debt are not corrected here |
| Legacy media cache | mediaCache encrypted IndexedDB cache128MiB/pruning; mediaHydrator plaintext module memory and in-flight dedupe; no account namespacing/sign-out cleanup introduced |
| V2 jobs/OPFS | jobStore syncup-media-v2/upload-jobs; staging quota/persistence/fingerprints; recordCodec/AAD, worker transferables/termination; prepareVoice/Video envelopes/poster; uploadManager resume/cancel/retry/finalize; singleton started in main |
| V2 playback/source | localMediaCache memory and mediaHydratorV2 OPFS/decrypt/cache; URL owners remain distinct from persisted bytes |
| Calls/group key | groupCallCrypto creates key/envelopes; Conversation/Workspace handoff; CallWindow worker/provider/SDK/track lifetime; zero on failures/end/unmount; direct and voice rooms remain transport-only |
| Spaces | role permissions and can_view/can_send/can_speak; server remains authority; plaintext current channel vs encrypted legacy chat remain distinct; voice join payload stays derived from active permitted channel |
| Appearance | shared/appearance.ts syncup-appearance localStorage and System matchMedia; bootstrap lifecycle, read fallback and write failure semantics frozen |

No server routes, schema/migrations, SQL transactions, encryption algorithms, key lifecycles, cache namespaces, logout cleanup, permission fallbacks or transport protocols change. Future security-sensitive moves need focused characterization and real affected integration; generic render snapshots cannot prove security equivalence.

## I. Cross-feature dependencies

Confirmed guard: 267 client+server resolved internal import/export edges, 21 distinct informational non-Workspace feature-to-feature edges, zero forbidden violations. A full client audit finds **31 distinct cross-feature source→target pairs**: those21 plus10 Workspace pairs. Repeated static/type specifiers count once in this pair inventory; guard's267 counts occurrences. AppRouter/main entry imports are composition outside features and are not cross-feature pairs.

Every pair and classification is listed in the source inventory. Classification is descriptive and can overlap:

- Auth crypto consumers (Calls group key, media V1/V2 hydration/preparation, Conversation/NewConversation/RequestsPanel, Spaces legacy decode, Workspace): legitimate security-sensitive coupling; future candidate for an explicitly reviewed crypto contract, never a mechanical shared promotion.
- Conversation→Calls groupCallCrypto and Workspace→CallWindow: legitimate security-sensitive key creation/composition respectively.
- Conversation→Media preparation/runtime/jobStore/uploadManager: legitimate media integration, temporary deep-infrastructure coupling / architecture smell at the completion boundary; future candidate for a narrow media-owned service contract. The uploadManager edge is type-only; it still matters to ownership.
- MessageAttachment→Media hydrators/localMediaCache and MessageList→MediaViewer/uploadManager: legitimate presentation/media integration; hydration security-sensitive, deep cache dependency a future candidate. Preserve type and runtime import distinctions.
- SpaceLegacyHistoryView→messaging/MessageAttachment: legitimate encrypted-history reuse today; temporary architecture smell because Spaces consumes messaging presentation. Future candidate for an explicit media attachment presentation contract after both uses are characterized; do not move MessageAttachment into shared now.
- Workspace→AccountPanel/NewConversation/RequestsPanel/SearchDialog/Conversation/SpacesPage/UpdatesPage: legitimate shell composition. Workspace→outbox: persistence/security-sensitive and future candidate for a narrow queue boundary, not child-owned flushing.

Guard evolution: current rules forbid shared→feature, importing another feature's private api.ts, React imports inside those APIs, and API→TSX. Workspace exclusion applies only to debt listing. No global cycle detection or general component-private rule exists. Eventually add cycle checking after a full resolved graph baseline; add private-internal allowlists only after explicit entry contracts exist. A blanket page-root ban today would break legitimate Workspace composition; a blanket cross-feature component ban would break legacy attachments. Do not add speculative rules in Phase01.

Type contract: retain nine Spaces types in features/spaces/types.ts and seventeen shared contracts in shared/types.ts. New local props belong beside their feature component; import canonical domain types without duplicates. Shared components cannot receive feature-specific imported types; define a semantically generic prop contract only when justified. Do not add compatibility barrels, relocate shared infrastructure under features then import it back, or create component↔root cycles. Move a local type into a dedicated feature contract only when actual consumers justify it; root-export convenience is not a reason.

## J. CSS/DOM coupling

Frozen stream: index.css imports tokens; App.css imports platform-shell.css → features/spaces/spaces.css → platform.css → primitives.css. The first three concatenate to Phase10's original1678-line platform stream, **1157 rule nodes /4507 declarations**. Spaces region270 rules retains original global ordinals63–332; see [selector-order ledger](phase-10-css-order.csv). Frozen SHA256:

| Content | Digest |
| --- | --- |
| Expanded platform stream | `5b3f9a226487b5045f85076c98b4e284af92d79eb453437888e1368855cd0e44` |
| Moved Spaces region | `4028bcbccd9e7493ad4c3fdf12e1bc116735086a177e8e3968aa65d592c64ee9` |
| tokens.css | `ebdf159beeb12fbf09e13130180dabc0dcc96fc833986fe1e3c9b537468fa26d` |
| primitives.css | `c8537a42c94ff98ec2c421d457b729eae191fe37ab8a8e5652243ac7a67b84e1` |

| Region | Actual selector/DOM coupling | Preservation requirement |
| --- | --- | --- |
| Whole app/auth/account | index reset/global element rules; auth-panel h2 and account-dialog h2 share selectors; profile/auth form descendants; root data-theme overrides in platform.css and tokens | Preserve element tags, classes, inherited variables and global import order; moving TSX does not localize CSS |
| Workspace | workspace grid children primary-rail/inbox-pane/conversation-pane/nav; has-active-chat/calls/space/updates modifiers; footer/overlays placement | Exact siblings/grid placement and Conversation keyed mount; wrapping siblings creates new grid items |
| Mobile Calls | 700px rules, later competing Calls declarations; mobile-bottom-nav compression | Preserve known390×844 16px navigation overlap; do not fix it during structure work |
| Inbox/history | search-box > svg:first-child / span:first-child; search result last-child; chat/call row nested span/button/time structure | Extract same root with same child order; CallHistoryList retains existing day/item grouping |
| Conversation | pane flex/overflow; message list scroll owner; message-mine .message-bubble; actions hover/hover:none; reply quotes; composer textarea/focus-within; absolute emoji/reaction popovers | Keep list ref and scroll node, IDs, article order, popover containing block and conditional siblings |
| Spaces sidebar/channel | space-work-area grid; channel row hover button; channel-header > div:first-child; list-card > span:last-child | Same aside/header/nav/button roots, not extra wrappers; role-gated children stay ordered |
| Objects/Updates | shared-object-heading > span:nth-child(2); updates-header > div > p:last-child; updates-grid/item context | Card heading second span and source-link/card siblings cannot be reordered |
| Dialogs | overlay→account-dialog descendants, nested settings grid/sidebar/form, profile-checkbox > span > small and > input | Preserve overlay root/modal section, DOM placement and labels/IDs; do not convert to portal or add focus UX |
| Attachments/viewer/calls | attachment-file-button first/last spans; media-viewer body portal, stage/pan/video; SDK injects media elements into call-media-stage ref | Preserve portal target, ref node, dynamic track placement, URL/video attributes and controls ordering |

Styles use descendant/direct-child and positional selectors heavily. The selector scan found no `+` or `~` sibling combinator rules; adjacent sibling *DOM/layout* still matters for grid/flex children and conditional fragments. Do not mistake CSS arithmetic `+` for a sibling selector. Responsive conditions include widths420/620/700/760, desktop701–1099, hover:none and prefers-reduced-motion. Dark selectors and later `:root:is([data-theme], :not([data-theme]))` overrides cross file/feature boundaries. Preserve selector order/specificity, media queries, classes, theme values and DOM roots; default extraction returns the original node or fragment with **no added wrapper**.

## K. Shared vs feature ownership rules

Shared requires both cross-feature use and semantic generality. Button/IconButton/Dialog/Avatar/BrandMark and generic emoji UI remain shared. Existing shared transport, appearance, formatting and presentation utilities retain current ownership. MessageBubble/ConversationHeader/WorkspaceRail/SpaceChannelList/CallHistoryItem are feature concepts even when another feature reuses them. Two visually similar components can stay separate. Do not add Input/Tooltip/Badge simply because they are possible primitives; design-system visual convergence is later work. Shared never imports feature contracts or infrastructure.

## L. Component extraction rules

Extract a coherent visual region with a stable semantic purpose, bounded props, understandable interactions and an exact existing root. A future Workspace CallHistoryList, ConversationSearchBar or SpacesSidebar can meet that rule; expose the data/actions actually rendered. Reject every-div extraction, line-count targets, one-use wrappers without ownership value, whole-parent state bags and dozens of unrelated callbacks. If the prop contract cannot be bounded, choose a smaller region or retain root orchestration. Preserve key/ref/form/portal/fragment/mount identity, labels/ARIA, handler closures and conditional rendering. Existing InboxPane's broad shell props are a reason to isolate its coherent history region, not invent a global presenter interface.

## M. Hook extraction rules

Existing useWorkspaceNavigation and useConversationUiState already own narrow UI transitions. Organize them only with their owner; do not broaden them. Future useConversationDraft can own restore/save together with identical dependencies, cancellation flags and250ms debounce, after focused race characterization. A future realtime hook requires typed event semantics, stable callbacks and exact subscribe/unsubscribe lifetimes; it is high risk, not a first-pass cleanup. Scroll anchoring remains high risk because layout-effect timing and DOM refs matter. Never create useWorkspaceEverything/useConversationEverything/useSpacesEverything; no new framework, global store, DI/service container or universal repository. Do not change dependency arrays while extracting.

## N. Proposed target tree

This is a staged destination, not authorization to move the tree in one PR. Existing roots/API/contracts/infrastructure remain in place unless a future bounded phase explicitly approves a move. New names represent identified existing regions, not new features. No empty directories, automatic barrels, or speculative api/utils folders.

```text
client/src/
  app/AppRouter.tsx
  App.tsx, App.css, main.tsx, index.css, assets/       (unchanged entrypoints)
  shared/
    components/{Avatar,BrandMark,Button,Dialog,IconButton,FullEmojiPicker}.tsx
    utils/format.ts
    styles/{platform-shell,platform,tokens,primitives}.css
    api.ts, appwrite.ts, appearance.ts, presentation.ts, types.ts
  features/
    workspace/
      WorkspacePage.tsx
      components/{WorkspaceRail,InboxPane,ChatRow,MobileNavigation,CallsHome,IncomingCallBanner}.tsx
      components/CallHistoryList.tsx                  (existing Inbox history region)
      hooks/useWorkspaceNavigation.ts
    messaging/
      Conversation.tsx, api.ts, outbox.ts
      components/{ConversationHeader,ConversationWelcome,MessageList,MessageComposer,MessageAttachment}.tsx
      components/{ChatDetailsScreen,NewConversation,RequestsPanel,SearchDialog,ReportDialog,VoiceRecorder}.tsx
      components/ConversationSearchBar.tsx            (existing search region)
      hooks/useConversationUiState.ts
      hooks/useConversationDraft.ts                   (later, after race characterization)
    spaces/
      SpacesPage.tsx, UpdatesPage.tsx, types.ts, spaces.css
      components/{SharedObjectCard,SpaceLegacyHistoryView,SpaceVoiceChannelView}.tsx
      components/SpacesSidebar.tsx                    (existing aside)
      components/SpaceChannelHeader.tsx               (existing header)
      components/SpaceSearchDialog.tsx                (existing discovery overlay)
      components/SpaceFilesDialog.tsx                 (existing files overlay)
      components/SpaceObjectDialog.tsx                (existing object form overlay)
      components/SpaceSettingsDialog.tsx              (existing settings overlay)
      components/SpaceChannelSettingsDialog.tsx       (existing permission/topic overlay)
    account/
      AccountPanel.tsx, api.ts
      components/SafetySettings.tsx
      components/AvatarEditor.tsx                     (existing profile-avatar region)
    auth/
      AuthScreen.tsx, UnlockScreen.tsx, crypto/crypto.ts
    calls/
      CallWindow.tsx, groupCallCrypto.ts
      components/CallControls.tsx                     (existing footer; no Room ownership)
    media/
      MediaViewer.tsx, mediaCache.ts, mediaHydrator.ts
      v2/                                            (all fifteen existing modules stay together)
```

Auth and media do not need components/hooks/utils/api directory symmetry: their roots are coherent or resource-sensitive and infrastructure already has a justified v2 category. Account API remains api.ts. Spaces forms with few lines may remain inline; target names are candidates subject to bounded prop review. No invented MessageBubble/MessageActions is mandated before MessageList interaction/DOM review. CallHistoryList remains Workspace-owned because the inbox shell owns display grouping, rather than moving it to Calls for naming symmetry.

## O. Migration ordering

One feature or coherent region per PR; moves and extraction are separately identified in the diff. This sequence orders *regions*, not every runtime module of an entire feature:

| Order | Bounded unit | Evidence / prerequisite |
| --- | --- | --- |
| 1 | Workspace existing presentation files + narrow navigation hook organization; separate PR for Inbox call-history visual region | Phase6 characterization and Workspace fixture already cover props/transitions; no effect relocation. Mobile Calls debt stays frozen |
| 2 | Conversation visual search region and existing presentation organization | Phase7 reply/edit/search characterization; preserve keyed pane/list refs; no send/SSE/draft/V2 movement |
| 3 | Spaces sidebar/header visual regions | Phase8/9/10 fixtures/type/CSS characterization; permission-derived props remain root; exact direct-child selectors |
| 4 | Spaces discovery/object/settings dialogs, one coherent overlay per PR | Forms have real API/permission/domain coupling; establish bounded props and reset/mount parity before localizing state |
| 5 | Account avatar visual region/SafetySettings organization; Updates visual stacks only if useful | Existing profile/API wrapper/browser and object fixture coverage; session and mutation effects remain roots. Small Updates root may reasonably remain unchanged |
| 6 | CallControls presentation only | Phase11 SDK-double characterization plus single real voice room; lifecycle/key/worker stays CallWindow |
| 7 | Narrow Conversation draft/scroll/realtime units only after missing focused cases are added | IndexedDB races, effect remount and refs demand more proof than static tests; queue/media completion not bundled with presentation |
| 8 | Auth/Calls runtime/Media V2/legacy crypto boundaries only under separate explicit risk-scoped phases, if ownership benefit warrants | Missing real concurrent refresh, durable offline/OPFS and multi-party E2EE evidence; no automatic mandate to restructure stable infrastructure |

Workspace starts because presentation boundaries already exist and have characterization, not because it is the smallest feature. Account/Auth is not treated as one low-risk unit: avatar display can precede sensitive auth work. Media is last because file size understates durable and cryptographic coupling. Updates and small auth forms should not be decomposed merely to satisfy the tree.

## P. Risk classification

| Risk | Candidate | Required evidence |
| --- | --- | --- |
| Low | Existing pure visual file organization, bounded header/search/control region | Prop/handler characterization, import/type review and DOM/style matrix; moves can still change fixture resolution |
| Medium | Workspace history grouping/navigation, avatar UI, Updates stacks, Spaces sidebar/dialog presentation | Mount/selection/keyboard/date grouping/form/error/reset parity; responsive positional selectors |
| High | Conversation scrolling/SSE/typing, Spaces channel polling/cursor/highlight, MessageAttachment URLs/observer, VoiceRecorder devices | Controlled clocks, subscription/cleanup counts, abort/error/unmount paths, browser resource behavior and affected integration |
| Security-sensitive | Auth/session/refresh/vault; encrypted sends/outbox; media jobs/OPFS/worker/AAD; group calls/key transfer; permission drafts/voice access/legacy history | Freeze initially; contract-specific crypto/persistence/permission tests plus real affected HTTP/external evidence; report all unexecuted E2E |

Security-sensitive is an additional classification, not an assertion that a presentational child is safe merely because it accepts no key prop. Permission-derived callbacks and retained decrypted state can cross that boundary.

## Q. Verification contract

For every future structural PR, record base/head SHAs, exact scope, moved files vs mechanical extraction, and explicit **behavior changes ZERO / styling changes ZERO**. Run independently at final HEAD: npm run typecheck; npm test (at least197 existing tests, no removed/weakened cases); npm run check:architecture; npm run build; npm run test:media-v2; git diff --check; git status. Preserve existing warnings and all failures with explanations. Run real integration where affected behavior warrants it; if infrastructure/limiter blocks a required run, report it separately and do not describe mocks as substitutes.

Additionally require affected feature characterization with bounded props, handler payloads/order, effect dependency arrays, timer values, subscription/cleanup counts, ref and key identity, race/abort/error handling, and API request parity. Moves alone must preserve literal worker URLs, dynamic imports and entrypoints. Types retain Phase10 ownership; guard/cycle review covers newly introduced dependencies even though the guard does not globally check cycles yet.

Validate affected representative states at1440×900 and390×844 in Light/Dark/System. Compare DOM roots/child order/IDs/refs/ARIA, computed styles and bounds, frozen CSS inventory/digests/order, and screenshots. Record actual viewport and raster sizes and effective System scheme. Use Phase11 or approved-descendant references; investigate screenshot changes instead of automatically accepting them. Check the known Calls defect remains baseline-equivalent while avoiding an accidental fix. Include empty/loading/error/selected/dialog states relevant to the region. An unchanged CSS file is insufficient proof if DOM changed.

Evidence ledger must identify static/unit vs VM/browser fixture doubles vs authenticated browser vs real HTTP/PostgreSQL/storage vs real LiveKit/device vs unexecuted E2E. Phase11 gaps remain explicit: full real DM/group delivery and offline queue durability, full OPFS recovery/large media, parallel refresh cookie-family races, multi-party group E2EE/remote video, complete media viewer/poster and device-error flows, accessibility/contrast. Add missing evidence before a sensitive move; never claim all-system E2E from197 tests.

If accidental behavior or styling changes appear, **STOP and correct before PR approval**. No screenshot auto-update, test weakening, environment reset, CSS cleanup or security rewrite to hide a structural regression. Phase01 final command results are reported with the PR; only docs are committed, and production-path diff must be empty.

## R. Future Design System compatibility

Give each eventual feature component a coherent visual region and selector ownership ledger (selector, source/order, root/descendant constraints, other consumers). The later independent program can migrate that component plus its legacy selectors to Tailwind/semantic tokens/primitives without touching unrelated roots. Shared selectors such as account-dialog/profile-form/eyebrow require a deliberate shared styling decision then. This contract establishes ownership while retaining all legacy styling now. No semantic typography/color/spacing/radius/elevation/motion values change.

## S. Explicit non-goals

No production moves, component/hook extraction, import/type changes, server/migration/database changes, runtime optimizations, new dependencies, barrels, DI/state/router/UI frameworks, generic repository/service containers, Tailwind, CSS modules or styled-components. No platform CSS elimination or design-system implementation. No fixes to mobile Calls compression/overlap, legacy greens, inconsistent palette/typography/spacing, contrast debt, dialog focus UX, redundant post-signup unlock, CallsHome encryption copy, cache isolation/sign-out retention, refresh coordination or missing-row/temporal fallbacks. Those debts retain Phase11 evidence and require separate authorization.

After opening this documentation PR: **STOP. Do not merge, begin Workspace extraction, or start styling/Tailwind/Design System work.**
