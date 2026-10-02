# Phase 01 source inventory

Reference: `fcb373aae55dabb4277903d0f5454410f7808bae`. Read-only TypeScript AST audit plus implementation review; generated documentation, no production/audit-tool changes. Physical lines include blanks/comments and exclude a final empty line. Exports are syntactic named declarations (including types), not a new public API. Imports include literal dynamic and import-type specifiers; nonliteral requests are represented as source expressions. Browser/API call sites are direct evidence, not a transitive completeness claim. CSS is globally loaded; see the main contract section J for selector ownership.

## Current complete tree

```text
client/src/app/AppRouter.tsx
client/src/App.css
client/src/App.tsx
client/src/assets/hero.png
client/src/assets/react.svg
client/src/assets/vite.svg
client/src/features/account/AccountPanel.tsx
client/src/features/account/api.ts
client/src/features/account/SafetySettings.tsx
client/src/features/auth/AuthScreen.tsx
client/src/features/auth/crypto/crypto.ts
client/src/features/auth/UnlockScreen.tsx
client/src/features/calls/CallWindow.tsx
client/src/features/calls/groupCallCrypto.ts
client/src/features/media/mediaCache.ts
client/src/features/media/mediaHydrator.ts
client/src/features/media/MediaViewer.tsx
client/src/features/media/v2/appwriteTransport.ts
client/src/features/media/v2/cryptoWorker.ts
client/src/features/media/v2/jobStore.ts
client/src/features/media/v2/localMediaCache.ts
client/src/features/media/v2/manifest.ts
client/src/features/media/v2/mediaCrypto.worker.ts
client/src/features/media/v2/mediaHydratorV2.ts
client/src/features/media/v2/prepareVideo.ts
client/src/features/media/v2/prepareVoice.ts
client/src/features/media/v2/recordCodec.ts
client/src/features/media/v2/recovery.ts
client/src/features/media/v2/runtime.ts
client/src/features/media/v2/staging.ts
client/src/features/media/v2/uploadManager.ts
client/src/features/media/v2/videoPreparation.ts
client/src/features/messaging/api.ts
client/src/features/messaging/ChatDetailsScreen.tsx
client/src/features/messaging/Conversation.tsx
client/src/features/messaging/ConversationHeader.tsx
client/src/features/messaging/ConversationWelcome.tsx
client/src/features/messaging/MessageAttachment.tsx
client/src/features/messaging/MessageComposer.tsx
client/src/features/messaging/MessageList.tsx
client/src/features/messaging/NewConversation.tsx
client/src/features/messaging/outbox.ts
client/src/features/messaging/ReportDialog.tsx
client/src/features/messaging/RequestsPanel.tsx
client/src/features/messaging/SearchDialog.tsx
client/src/features/messaging/useConversationUiState.ts
client/src/features/messaging/VoiceRecorder.tsx
client/src/features/spaces/SharedObjectCard.tsx
client/src/features/spaces/SpaceLegacyHistoryView.tsx
client/src/features/spaces/spaces.css
client/src/features/spaces/SpacesPage.tsx
client/src/features/spaces/SpaceVoiceChannelView.tsx
client/src/features/spaces/types.ts
client/src/features/spaces/UpdatesPage.tsx
client/src/features/workspace/CallsHome.tsx
client/src/features/workspace/ChatRow.tsx
client/src/features/workspace/InboxPane.tsx
client/src/features/workspace/IncomingCallBanner.tsx
client/src/features/workspace/MobileNavigation.tsx
client/src/features/workspace/useWorkspaceNavigation.ts
client/src/features/workspace/WorkspacePage.tsx
client/src/features/workspace/WorkspaceRail.tsx
client/src/index.css
client/src/main.tsx
client/src/shared/api.ts
client/src/shared/appearance.ts
client/src/shared/appwrite.ts
client/src/shared/components/Avatar.tsx
client/src/shared/components/BrandMark.tsx
client/src/shared/components/Button.tsx
client/src/shared/components/Dialog.tsx
client/src/shared/components/FullEmojiPicker.tsx
client/src/shared/components/IconButton.tsx
client/src/shared/presentation.ts
client/src/shared/styles/platform-shell.css
client/src/shared/styles/platform.css
client/src/shared/styles/primitives.css
client/src/shared/styles/tokens.css
client/src/shared/types.ts
client/src/shared/utils/format.ts
```

## Files, exports and imports

Paths below are relative to client/src. Module specifiers preserve actual source spelling.

### app

| File | Lines | Exported declarations | Module specifiers |
| --- | ---: | --- | --- |
| app/AppRouter.tsx | 72 | AppRouter | react; ../shared/api; ../features/auth/crypto/crypto; ../shared/types; ../features/auth/AuthScreen; ../features/auth/UnlockScreen; ../features/workspace/WorkspacePage |

### account

| File | Lines | Exported declarations | Module specifiers |
| --- | ---: | --- | --- |
| features/account/AccountPanel.tsx | 234 | AccountPanel | react; lucide-react; ./api; ../../shared/types; ../../shared/components/Avatar; ../../shared/components/Button; ../../shared/components/IconButton; ../../shared/components/Dialog; ./SafetySettings; ../../shared/appearance |
| features/account/SafetySettings.tsx | 118 | SafetySettings | react; lucide-react; ../../shared/api |
| features/account/api.ts | 35 | UpdateProfileInput, listSessions, revokeSession, updateProfile, getCurrentUser, uploadAvatar, removeAvatar | ../../shared/api; ../../shared/types |

### auth

| File | Lines | Exported declarations | Module specifiers |
| --- | ---: | --- | --- |
| features/auth/AuthScreen.tsx | 121 | AuthScreen | react; lucide-react; ../../shared/api; ../../shared/types; ../auth/crypto/crypto; ../../shared/components/BrandMark; ../../shared/components/Button |
| features/auth/UnlockScreen.tsx | 68 | UnlockScreen | react; lucide-react; ../../shared/api; ../auth/crypto/crypto; ../../shared/types; ../../shared/components/BrandMark; ../../shared/components/Button |
| features/auth/crypto/crypto.ts | 232 | EncryptedMessage, createKeyBundle, unlockKeyBundle, lockKeyBundle, isKeyBundleUnlocked, encryptMessage, wrapMediaKeyForMembers, encryptAttachment, unwrapMediaKey, decryptAttachment, decryptMessage | ../../../shared/types |

### calls

| File | Lines | Exported declarations | Module specifiers |
| --- | ---: | --- | --- |
| features/calls/CallWindow.tsx | 360 | CallWindow | lucide-react; livekit-client; react; ../../shared/components/Avatar |
| features/calls/groupCallCrypto.ts | 18 | createGroupCallKey | ../../shared/types; ../auth/crypto/crypto; livekit-client |

### media

| File | Lines | Exported declarations | Module specifiers |
| --- | ---: | --- | --- |
| features/media/MediaViewer.tsx | 101 | MediaViewerItem, MediaViewer | react; lucide-react; react-dom; ../../shared/types; ./mediaHydrator; ./v2/mediaHydratorV2 |
| features/media/mediaCache.ts | 83 | getCachedCiphertext, cacheCiphertext | — |
| features/media/mediaHydrator.ts | 52 | hydrateAttachment, downloadAttachment | ../../shared/api; ../../shared/types; ../auth/crypto/crypto; ./mediaCache |
| features/media/v2/appwriteTransport.ts | 56 | appwriteMediaV2Transport | ../../../shared/api; ./staging; ./uploadManager |
| features/media/v2/cryptoWorker.ts | 68 | MediaV2CryptoWorker | ./recordCodec |
| features/media/v2/jobStore.ts | 142 | MediaV2JobState, MediaV2UploadJob, putMediaV2Job, getMediaV2Job, getMediaV2JobByAttachment, listRecoverableMediaV2Jobs, patchMediaV2Job, deleteMediaV2Job | ./recordCodec; ../../../shared/types |
| features/media/v2/localMediaCache.ts | 20 | rememberLocalMediaV2Source, getLocalMediaV2Source | — |
| features/media/v2/manifest.ts | 20 | MEDIA_V2_TRANSPORT_CHUNK_BYTES, MEDIA_V2_RECORD_PLAINTEXT_BYTES, MEDIA_V2_VIDEO_MAX_BYTES, MEDIA_V2_VOICE_MAX_BYTES, mediaV2RecordCount, mediaV2CiphertextSize, mediaV2TransportChunkCount, mediaV2SourceLimit | — |
| features/media/v2/mediaCrypto.worker.ts | 58 | — | ./recordCodec |
| features/media/v2/mediaHydratorV2.ts | 135 | hasCachedMediaV2Playback, hydrateMediaV2, downloadMediaV2 | ../../../shared/api; ../../../shared/types; ../../auth/crypto/crypto; ./cryptoWorker; ./localMediaCache; ./recordCodec |
| features/media/v2/prepareVideo.ts | 112 | prepareVideoV2 | ../../../shared/api; ../../../shared/types; ../../auth/crypto/crypto; ./cryptoWorker; ./jobStore; ./manifest; ./localMediaCache; ./recordCodec; ./staging; ./runtime; ./videoPreparation |
| features/media/v2/prepareVoice.ts | 64 | prepareVoiceV2 | ../../../shared/api; ../../../shared/types; ../../auth/crypto/crypto; ./cryptoWorker; ./jobStore; ./recordCodec; ./staging |
| features/media/v2/recordCodec.ts | 132 | MEDIA_V2_ENCRYPTION_VERSION, MEDIA_V2_IV_BYTES, MEDIA_V2_TAG_BYTES, MEDIA_V2_HEADER_BYTES, MediaV2Kind, MediaV2RecordContext, mediaV2Aad, importMediaV2Key, encodeMediaV2Record, decodeMediaV2Record, encryptMediaV2Record, decryptMediaV2Record | — |
| features/media/v2/recovery.ts | 25 | MediaV2RecoveryCandidate, inspectMediaV2Recovery, markMediaV2JobRecoverableFailure, cleanupMediaV2Job | ./jobStore; ./staging |
| features/media/v2/runtime.ts | 22 | mediaV2UploadManager, startMediaV2Runtime, stopMediaV2Runtime | ./appwriteTransport; ./uploadManager |
| features/media/v2/staging.ts | 155 | MediaV2StorageCapacity, inspectMediaV2Storage, requestMediaV2Persistence, assertMediaV2StageCapacity, stageMediaV2Blob, openMediaV2Stage, hasMediaV2Stage, deleteMediaV2Stage, fingerprintMediaV2Source, sourceMatchesMediaV2Fingerprint, createMediaV2StageWriter | — |
| features/media/v2/uploadManager.ts | 300 | MediaV2PublicStatus, MediaV2UploadSnapshot, MediaV2Transport, MediaV2UploadManager | ../../../shared/api; ./jobStore; ./staging |
| features/media/v2/videoPreparation.ts | 50 | VideoProbe, probeVideo, createVideoPoster | — |

### messaging

| File | Lines | Exported declarations | Module specifiers |
| --- | ---: | --- | --- |
| features/messaging/ChatDetailsScreen.tsx | 216 | ChatDetailsScreen | react; lucide-react; ../../shared/api; ../../shared/types; ../../shared/components/Avatar |
| features/messaging/Conversation.tsx | 1258 | Conversation | react; lucide-react; ../../shared/api; ../auth/crypto/crypto; ./outbox; ../../shared/types; ./ConversationHeader; ./ChatDetailsScreen; ./MessageComposer; ./MessageList; ./ReportDialog; ./useConversationUiState; ./ConversationWelcome; ../media/v2/prepareVideo; ../media/v2/prepareVoice; ./VoiceRecorder; ../media/v2/runtime; ../media/v2/uploadManager; ../calls/groupCallCrypto; ./SearchDialog; ../media/v2/jobStore |
| features/messaging/ConversationHeader.tsx | 37 | ConversationHeader | lucide-react; ../../shared/components/Avatar |
| features/messaging/ConversationWelcome.tsx | 32 | ConversationWelcome | ../../shared/components/BrandMark; ../../shared/components/Avatar; ../../shared/types |
| features/messaging/MessageAttachment.tsx | 506 | MessageAttachment | react; lucide-react; ../../shared/types; ../../shared/utils/format; ../media/mediaHydrator; ../media/v2/mediaHydratorV2; ../media/v2/localMediaCache |
| features/messaging/MessageComposer.tsx | 103 | MessageComposer | react; lucide-react; ./VoiceRecorder; ../../shared/types; ../../shared/presentation; ../../shared/components/FullEmojiPicker |
| features/messaging/MessageList.tsx | 205 | MessageList | lucide-react; react; ../../shared/types; ../../shared/components/Avatar; ../../shared/components/FullEmojiPicker; ../media/v2/uploadManager; ./MessageAttachment; ../media/MediaViewer; ../../shared/presentation |
| features/messaging/NewConversation.tsx | 174 | NewConversation | react; lucide-react; ../../shared/api; ../../shared/types; ../auth/crypto/crypto |
| features/messaging/ReportDialog.tsx | 55 | ReportDialog | react; lucide-react; ./api; ../../shared/components/Button; ../../shared/components/IconButton; ../../shared/components/Dialog |
| features/messaging/RequestsPanel.tsx | 47 | RequestsPanel | react; lucide-react; ../auth/crypto/crypto; ../../shared/types; ../../shared/components/Avatar |
| features/messaging/SearchDialog.tsx | 139 | SearchableMessage, SearchDialog | react; lucide-react; ../../shared/components/Avatar; ../../shared/api; ../../shared/types |
| features/messaging/VoiceRecorder.tsx | 43 | VoiceDraft, VoiceRecorder, VoicePreview | react; lucide-react |
| features/messaging/api.ts | 10 | SubmitReportInput, submitReport | ../../shared/api |
| features/messaging/outbox.ts | 122 | PendingMessage, listPendingMessages, savePendingMessage, removePendingMessage, loadDraft, listAllDrafts, saveDraft | — |
| features/messaging/useConversationUiState.ts | 26 | useConversationUiState | react |

### spaces

| File | Lines | Exported declarations | Module specifiers |
| --- | ---: | --- | --- |
| features/spaces/SharedObjectCard.tsx | 70 | SharedObjectCard | react; lucide-react; ./types |
| features/spaces/SpaceLegacyHistoryView.tsx | 49 | SpaceLegacyHistoryView | lucide-react; ../messaging/MessageAttachment; ../../shared/types; ./types |
| features/spaces/SpaceVoiceChannelView.tsx | 11 | SpaceVoiceChannelView | lucide-react |
| features/spaces/SpacesPage.tsx | 1156 | SpacesPage | react; lucide-react; ../auth/crypto/crypto; ../../shared/api; ../../shared/types; ./types; ./SharedObjectCard; ./SpaceVoiceChannelView; ./SpaceLegacyHistoryView |
| features/spaces/UpdatesPage.tsx | 106 | UpdatesPage | react; lucide-react; ../../shared/api; ./types; ./SharedObjectCard |
| features/spaces/spaces.css | 272 | — | — |
| features/spaces/types.ts | 97 | SpaceSummary, SpaceIcon, SpaceCategory, SpaceChannel, SpaceChannelRolePermission, SpaceChannelMember, SpaceMember, SpaceMessage, SpaceSharedObject | — |

### workspace

| File | Lines | Exported declarations | Module specifiers |
| --- | ---: | --- | --- |
| features/workspace/CallsHome.tsx | 24 | CallsHome | lucide-react |
| features/workspace/ChatRow.tsx | 17 | ChatRow | lucide-react; ../../shared/types; ../../shared/components/Avatar |
| features/workspace/InboxPane.tsx | 156 | InboxPane | lucide-react; ../../shared/types; ./ChatRow; ../../shared/components/Avatar |
| features/workspace/IncomingCallBanner.tsx | 19 | IncomingCallBanner | ../../shared/components/Avatar; ../../shared/types |
| features/workspace/MobileNavigation.tsx | 39 | MobileNavigation | lucide-react |
| features/workspace/WorkspacePage.tsx | 505 | WorkspacePage | react; ../../shared/api; ../auth/crypto/crypto; ../messaging/outbox; ../../shared/types; ../account/AccountPanel; ../messaging/NewConversation; ../messaging/RequestsPanel; ../messaging/SearchDialog; ../messaging/Conversation; ../calls/CallWindow; ./InboxPane; ./MobileNavigation; ./WorkspaceRail; ./useWorkspaceNavigation; ./CallsHome; ./IncomingCallBanner; ../spaces/SpacesPage; ../spaces/UpdatesPage; ../../shared/presentation; ../../shared/appearance; livekit-client |
| features/workspace/WorkspaceRail.tsx | 41 | WorkspaceRail | lucide-react; ../../shared/components/BrandMark; ../../shared/types; ../../shared/components/Avatar |
| features/workspace/useWorkspaceNavigation.ts | 87 | useWorkspaceNavigation | react |

### shared

| File | Lines | Exported declarations | Module specifiers |
| --- | ---: | --- | --- |
| shared/api.ts | 58 | api, apiUpload | — |
| shared/appearance.ts | 41 | AppearancePreference, parseAppearancePreference, readAppearancePreference, saveAppearancePreference, applyAppearancePreference, startAppearanceLifecycle | — |
| shared/appwrite.ts | 7 | appwriteClient, appwriteAccount | appwrite |
| shared/components/Avatar.tsx | 18 | Avatar | — |
| shared/components/BrandMark.tsx | 10 | BrandMark | — |
| shared/components/Button.tsx | 6 | Button | react |
| shared/components/Dialog.tsx | 16 | Dialog | react |
| shared/components/FullEmojiPicker.tsx | 39 | FullEmojiPicker | react; emoji-picker-react |
| shared/components/IconButton.tsx | 7 | IconButton | react |
| shared/presentation.ts | 57 | TextLinkPart, countUnreadConversations, sortChronologically, splitMessageLinks, insertAtSelection | — |
| shared/styles/platform-shell.css | 105 | — | — |
| shared/styles/platform.css | 1301 | — | — |
| shared/styles/primitives.css | 12 | — | — |
| shared/styles/tokens.css | 119 | — | — |
| shared/types.ts | 200 | KeyBundle, PublicMember, User, Session, AuthMode, ChatKind, Chat, ChatMember, EncryptedChatMessage, EncryptedMessageReplyContext, DisplayMessage, CallRecord, IncomingCall, ActiveCall, StagedAttachment, IncomingRequest, DiscoveredUser | — |
| shared/utils/format.ts | 5 | formatFileSize | — |

### entrypoints

| File | Lines | Exported declarations | Module specifiers |
| --- | ---: | --- | --- |
| App.css | 4 | — | — |
| App.tsx | 6 | App | ./app/AppRouter; ./App.css |
| index.css | 22 | — | — |
| main.tsx | 16 | — | react; react-dom/client; ./index.css; ./App.tsx; ./features/media/v2/runtime; ./shared/appearance |

## All cross-feature pairs

31 unique source → target pairs, including10 Workspace composition pairs. The guard reports the other21 as informational. Classes may overlap; future candidate is a plan, not a move.

| Source | Target | Classification / ownership |
| --- | --- | --- |
| calls/groupCallCrypto.ts | auth/crypto/crypto.ts | legitimate; security-sensitive; future explicitly reviewed crypto contract |
| media/mediaHydrator.ts | auth/crypto/crypto.ts | legitimate; security-sensitive; future explicitly reviewed crypto contract |
| media/v2/mediaHydratorV2.ts | auth/crypto/crypto.ts | legitimate; security-sensitive; future explicitly reviewed crypto contract |
| media/v2/prepareVideo.ts | auth/crypto/crypto.ts | legitimate; security-sensitive; future explicitly reviewed crypto contract |
| media/v2/prepareVoice.ts | auth/crypto/crypto.ts | legitimate; security-sensitive; future explicitly reviewed crypto contract |
| messaging/Conversation.tsx | auth/crypto/crypto.ts | legitimate; security-sensitive; future explicitly reviewed crypto contract |
| messaging/Conversation.tsx | media/v2/prepareVideo.ts | legitimate; security-sensitive media preparation; future media boundary |
| messaging/Conversation.tsx | media/v2/prepareVoice.ts | legitimate; security-sensitive media preparation; future media boundary |
| messaging/Conversation.tsx | media/v2/runtime.ts | legitimate; temporary deep-runtime architecture smell; security-sensitive; future narrow media boundary |
| messaging/Conversation.tsx | media/v2/uploadManager.ts | legitimate type-only media upload snapshot contract; future boundary |
| messaging/Conversation.tsx | calls/groupCallCrypto.ts | legitimate; security-sensitive; group key creation |
| messaging/Conversation.tsx | media/v2/jobStore.ts | legitimate; temporary deep-runtime architecture smell; security-sensitive; future narrow media boundary |
| messaging/MessageAttachment.tsx | media/mediaHydrator.ts | legitimate; security-sensitive decryption/resource lifetime |
| messaging/MessageAttachment.tsx | media/v2/mediaHydratorV2.ts | legitimate; security-sensitive decryption/resource lifetime |
| messaging/MessageAttachment.tsx | media/v2/localMediaCache.ts | legitimate; temporary deep-cache coupling; future media contract |
| messaging/MessageList.tsx | media/v2/uploadManager.ts | legitimate type-only media upload snapshot contract; future boundary |
| messaging/MessageList.tsx | media/MediaViewer.tsx | legitimate media presentation integration |
| messaging/NewConversation.tsx | auth/crypto/crypto.ts | legitimate; security-sensitive; future explicitly reviewed crypto contract |
| messaging/RequestsPanel.tsx | auth/crypto/crypto.ts | legitimate; security-sensitive; future explicitly reviewed crypto contract |
| spaces/SpaceLegacyHistoryView.tsx | messaging/MessageAttachment.tsx | temporary architecture smell; legitimate legacy reuse; future attachment presentation contract |
| spaces/SpacesPage.tsx | auth/crypto/crypto.ts | legitimate; security-sensitive; future explicitly reviewed crypto contract |
| workspace/WorkspacePage.tsx | auth/crypto/crypto.ts | legitimate; security-sensitive; future explicitly reviewed crypto contract |
| workspace/WorkspacePage.tsx | messaging/outbox.ts | legitimate; security-sensitive persistence; future queue boundary |
| workspace/WorkspacePage.tsx | account/AccountPanel.tsx | legitimate Workspace feature composition |
| workspace/WorkspacePage.tsx | messaging/NewConversation.tsx | legitimate Workspace feature composition |
| workspace/WorkspacePage.tsx | messaging/RequestsPanel.tsx | legitimate Workspace feature composition |
| workspace/WorkspacePage.tsx | messaging/SearchDialog.tsx | legitimate Workspace feature composition |
| workspace/WorkspacePage.tsx | messaging/Conversation.tsx | legitimate Workspace feature composition |
| workspace/WorkspacePage.tsx | calls/CallWindow.tsx | legitimate Workspace feature composition |
| workspace/WorkspacePage.tsx | spaces/SpacesPage.tsx | legitimate Workspace feature composition |
| workspace/WorkspacePage.tsx | spaces/UpdatesPage.tsx | legitimate Workspace feature composition |

## State bindings and direct API/browser infrastructure

Every direct useState binding is listed. Main contract E assigns ownership categories; refs and module singleton lifetimes also matter. Calls include API path expressions, timer delays, events, storage and URL/device operations. A callback argument is abbreviated to180 characters here; full effect callbacks below and source at the frozen SHA are authoritative. Calls nested in effects also appear here by design.

### app/AppRouter.tsx

State: `[user, setUser]`, `[checkingSession, setCheckingSession]`, `[sessionError, setSessionError]`, `[vaultUnlocked, setVaultUnlocked]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 17 | api<{ user: User }>("/api/auth/me") .then((result) => { if (!cancelled) setUser(result.user); }) .catch((error: unknown) => { if ( !cancelled && error instanceof Error && error.message !== "Sign in required." && error.message !== "Session expired." ) { setSessionError(error.message); } }) .finally | () => { if (!cancelled) setCheckingSession(false); } |
| 17 | api<{ user: User }>("/api/auth/me") .then((result) => { if (!cancelled) setUser(result.user); }) .catch | (error: unknown) => { if ( !cancelled && error instanceof Error && error.message !== "Sign in required." && error.message !== "Session expired." ) { setSessionError(error.message); |
| 17 | api<{ user: User }>("/api/auth/me") .then | (result) => { if (!cancelled) setUser(result.user); } |
| 17 | api | "/api/auth/me" |

### features/account/AccountPanel.tsx

State: `[error, setError]`, `[saved, setSaved]`, `[loading, setLoading]`, `[sessions, setSessions]`, `[currentSessionId, setCurrentSessionId]`, `[sessionsError, setSessionsError]`, `[avatarFile, setAvatarFile]`, `[avatarPreview, setAvatarPreview]`, `[avatarBusy, setAvatarBusy]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 31 | URL.revokeObjectURL | avatarPreview |
| 105 | URL.createObjectURL | file |

### features/account/SafetySettings.tsx

State: `[blockedUsers, setBlockedUsers]`, `[username, setUsername]`, `[reportUsername, setReportUsername]`, `[reportReason, setReportReason]`, `[reportDetails, setReportDetails]`, `[error, setError]`, `[notice, setNotice]`, `[loading, setLoading]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 28 | api | '/api/blocks' |
| 34 | api<{ blockedUsers: BlockedUser[] }>('/api/blocks') .then((result) => { if (active) setBlockedUsers(result.blockedUsers) }) .catch | (loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load blocked users.') } |
| 34 | api<{ blockedUsers: BlockedUser[] }>('/api/blocks') .then | (result) => { if (active) setBlockedUsers(result.blockedUsers) } |
| 34 | api | '/api/blocks' |
| 48 | api | '/api/blocks'; { method: 'POST', body: JSON.stringify({ username }), } |
| 66 | api | `/api/blocks/${encodeURIComponent(user.id)}`; { method: 'DELETE' } |
| 80 | api | '/api/reports'; { method: 'POST', body: JSON.stringify({ username: reportUsername, reason: reportReason, details: reportDetails }), } |

### features/account/api.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 14 | api | '/api/auth/sessions' |
| 18 | api | `/api/auth/sessions/${encodeURIComponent(sessionId)}/revoke`; { method: 'POST' } |
| 22 | api | '/api/auth/me'; { method: 'PATCH', body: JSON.stringify(input) } |
| 26 | api | '/api/auth/me' |
| 30 | apiUpload | '/api/auth/me/avatar'; bytes; contentType |
| 34 | api | '/api/auth/me/avatar'; { method: 'DELETE' } |

### features/auth/AuthScreen.tsx

State: `[mode, setMode]`, `[error, setError]`, `[loading, setLoading]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 30 | api | '/api/auth/' + mode; { method: 'POST', body: JSON.stringify({ ...payload, ...(generated ? { keyBundle: generated.keyBundle } : {}), }), } |
| 39 | api | '/api/auth/encryption/initialize'; { method: 'POST', body: JSON.stringify({ password, keyBundle: generated.keyBundle }), } |

### features/auth/UnlockScreen.tsx

State: `[password, setPassword]`, `[loading, setLoading]`, `[error, setError]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 19 | api | '/api/auth/key-bundle' |
| 27 | api | '/api/auth/encryption/initialize'; { method: 'POST', body: JSON.stringify({ password, keyBundle: generated.keyBundle }), } |

### features/calls/CallWindow.tsx

State: `[muted, setMuted]`, `[cameraEnabled, setCameraEnabled]`, `[connected, setConnected]`, `[localIdentity, setLocalIdentity]`, `[peers, setPeers]`, `[groupRoster, setGroupRoster]`, `[voiceRoster, setVoiceRoster]`, `[finished, setFinished]`, `[error, setError]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 7 | fetch | path; { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers }, } |
| 14 | fetch | '/api/auth/refresh'; { method: 'POST', credentials: 'same-origin' } |
| 73 | (async () => { try { const { ExternalE2EEKeyProvider, isE2EESupported, ParticipantEvent, Room, RoomEvent } = await import('livekit-client') if (cancelled) return let roomOptions: ConstructorParameters<typeof Room>[0] = { adaptiveStream: true, dynacast: true } if (isGroup) { if (!e2eeKey \|\| !isE2EESupported()) { throw new Error('This browser cannot securely encrypt group-call media.') } const keyProvider = new ExternalE2EEKeyProvider() await keyProvider.setKey(e2eeKey.slice().buffer) encryptionWorker = new Worker(new URL('livekit-client/e2ee-worker', import.meta.url), { type: 'module' }) encryptionWorkerRef.current = encryptionWorker roomOptions = { ...roomOptions, encryption: { keyProvider, worker: encryptionWorker }, } } const room = new Room(roomOptions) if (isGroup) await room.setE2EEEnabled(true) roomRef.current = room disconnect = () => { void room.disconnect() encryptionWorkerRef.current?.terminate() encryptionWorkerRef.current = null encryptionWorker = null } const attach = (track: { attach: () => HTMLMediaElement }, identity: string, local = false) => { const element = track.attach() element.dataset.participant = identity element.autoplay = true if (element instanceof HTMLVideoElement) { element.playsInline = true element.muted = local element.className = `call-video-tile${local ? ' call-video-local' : ''}` } else if (element instanceof HTMLAudioElement) { element.className = 'call-audio-track' } mediaStage.current?.append(element) } const detach = (track: { detach: () => HTMLMediaElement[] }) => { for (const element of track.detach()) element.remove() } const syncedParticipants = new Set<string>() const syncPeer = (participant: RemoteParticipant) => { const update = () => setPeers((current) => ({ ...current, [participant.identity]: { id: participant.identity, name: participant.name \|\| participant.identity, microphoneEnabled: participant.isMicrophoneEnabled, cameraEnabled: participant.isCameraEnabled, }, })) if (!syncedParticipants.has(participant.identity)) { participant.on(ParticipantEvent.TrackMuted, update) participant.on(ParticipantEvent.TrackUnmuted, update) syncedParticipants.add(participant.identity) } update() } room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => { attach(track, participant.identity) syncPeer(participant) }) room.on(RoomEvent.TrackUnsubscribed, detach) room.on(RoomEvent.ParticipantConnected, syncPeer) room.on(RoomEvent.ParticipantDisconnected, (participant) => { syncedParticipants.delete(participant.identity) setPeers((current) => { const next = { ...current } delete next[participant.identity] return next }) }) room.on(RoomEvent.Disconnected, () => setConnected(false)) if (isGroup) { room.on(RoomEvent.EncryptionError, (encryptionError) => { setError(`Group-call encryption failed: ${encryptionError.message}`) setConnected(false) setFinished(true) e2eeKey?.fill(0) void room.disconnect() encryptionWorkerRef.current?.terminate() encryptionWorkerRef.current = null void callApi(`/api/group-calls/${callId}/${isHost ? 'end' : 'leave'}`, { method: 'POST' }) .catch((leaveError: unknown) => { setError(`Group-call encryption failed, and ending your call participation also failed: ${leaveError instanceof Error ? leaveError.message : 'unknown error'}`) }) }) } const credentialsPath = isVoiceRoom && voiceSpaceId && voiceChannelId ? `/api/spaces/${voiceSpaceId}/channels/${voiceChannelId}/voice/token` : `/api/${isGroup ? 'group-calls' : 'calls'}/${callId}/token` const credentials = await callApi<{ url: string; token: string }>(credentialsPath, { method: 'POST' }) if (cancelled) return await room.connect(credentials.url, credentials.token) if (cancelled) return setLocalIdentity(room.localParticipant.identity) for (const participant of room.remoteParticipants.values()) syncPeer(participant) await room.localParticipant.setMicrophoneEnabled(!isVoiceRoom \|\| canPublish) if (video) await room.localParticipant.setCameraEnabled(true) for (const publication of room.localParticipant.videoTrackPublications.values()) { if (publication.track) attach(publication.track, room.localParticipant.identity, true) } setConnected(true) } catch (connectionError) { encryptionWorker?.terminate() encryptionWorkerRef.current?.terminate() encryptionWorkerRef.current = null encryptionWorker = null if (!cancelled) { const message = connectionError instanceof Error ? connectionError.message : 'Unable to join this call.' setError(message) if (isGroup) { setFinished(true) e2eeKey?.fill(0) void callApi(`/api/group-calls/${callId}/${isHost ? 'end' : 'leave'}`, { method: 'POST' }) .catch((leaveError: unknown) => { setError(`${message} Unable to end your group-call participation: ${leaveError instanceof Error ? leaveError.message : 'unknown error'}`) }) } } } }) |  |
| 128 | participant.on | ParticipantEvent.TrackMuted; update |
| 129 | participant.on | ParticipantEvent.TrackUnmuted; update |
| 134 | room.on | RoomEvent.TrackSubscribed; (track, _publication, participant) => { attach(track, participant.identity) syncPeer(participant) } |
| 138 | room.on | RoomEvent.TrackUnsubscribed; detach |
| 139 | room.on | RoomEvent.ParticipantConnected; syncPeer |
| 140 | room.on | RoomEvent.ParticipantDisconnected; (participant) => { syncedParticipants.delete(participant.identity) setPeers((current) => { const next = { ...current } delete next[participant.identity] return next }) } |
| 148 | room.on | RoomEvent.Disconnected; () => setConnected(false) |
| 150 | room.on | RoomEvent.EncryptionError; (encryptionError) => { setError(`Group-call encryption failed: ${encryptionError.message}`) setConnected(false) setFinished(true) e2eeKey?.fill(0) void room.disconnect() encryption |
| 158 | callApi(`/api/group-calls/${callId}/${isHost ? 'end' : 'leave'}`, { method: 'POST' }) .catch | (leaveError: unknown) => { setError(`Group-call encryption failed, and ending your call participation also failed: ${leaveError instanceof Error ? leaveError.message : 'unknown err |
| 190 | callApi(`/api/group-calls/${callId}/${isHost ? 'end' : 'leave'}`, { method: 'POST' }) .catch | (leaveError: unknown) => { setError(`${message} Unable to end your group-call participation: ${leaveError instanceof Error ? leaveError.message : 'unknown error'}`) } |
| 214 | callApi<{ status: string; participants?: { user_id: string; display_name: string; status: string }[] }>(`/api/${isGroup ? 'group-calls' : 'calls'}/${callId}/status`) .then(({ status, participants }) => { if (isGroup && participants) setGroupRoster(participants.map((participant) => ({ user_id: participant.user_id, display_name: participant.display_name, status: participant.status, }))) if (cancelled \|\| finished \|\| !['declined', 'missed', 'ended'].includes(status)) return finished = true setFinished(true) setConnected(false) setError(status === 'declined' ? 'The other person declined the call.' : status === 'missed' ? 'The call was missed.' : 'The other person ended the call.') void roomRef.current?.disconnect() roomRef.current = null e2eeKey?.fill(0) encryptionWorkerRef.current?.terminate() encryptionWorkerRef.current = null }) .catch | (statusError: unknown) => { if (cancelled) return if (isGroup && statusError instanceof Error && statusError.message === 'Group call not found.') { finished = true setFinished(true |
| 214 | callApi<{ status: string; participants?: { user_id: string; display_name: string; status: string }[] }>(`/api/${isGroup ? 'group-calls' : 'calls'}/${callId}/status`) .then | ({ status, participants }) => { if (isGroup && participants) setGroupRoster(participants.map((participant) => ({ user_id: participant.user_id, display_name: participant.display_nam |
| 249 | window.setInterval | checkStatus; 4000 |
| 259 | callApi<{ participants: typeof voiceRoster }>( `/api/spaces/${voiceSpaceId}/channels/${voiceChannelId}/voice`, ).then(({ participants }) => { if (!cancelled) setVoiceRoster(participants) }).catch | (rosterError: unknown) => { if (cancelled) return const message = rosterError instanceof Error ? rosterError.message : 'Unable to refresh voice room access.' setError(message) if ( |
| 259 | callApi<{ participants: typeof voiceRoster }>( `/api/spaces/${voiceSpaceId}/channels/${voiceChannelId}/voice`, ).then | ({ participants }) => { if (!cancelled) setVoiceRoster(participants) } |
| 275 | window.setInterval | () => { void refreshRoster() }; 5000 |

### features/media/MediaViewer.tsx

State: `[url, setUrl]`, `[error, setError]`, `[zoom, setZoom]`, `[retry, setRetry]`, `[loadProgress, setLoadProgress]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 43 | hydrate .then((blob) => { if (cancelled) return objectUrl = URL.createObjectURL(blob) setUrl(objectUrl) }) .catch | (loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to open this media.') } |
| 46 | URL.createObjectURL | blob |
| 54 | URL.revokeObjectURL | objectUrl |
| 66 | window.addEventListener | 'keydown'; handleKey |

### features/media/mediaCache.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 15 | indexedDB.open | DB_NAME; DB_VERSION |

### features/media/mediaHydrator.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 22 | (async () => { const { attachment: metadata } = await api<{ attachment: AttachmentMetadata }>(`/api/uploads/${attachment.id}`) let ciphertext = await getCachedCiphertext(attachment.id).catch(() => null) if (!ciphertext) { const response = await fetch(metadata.downloadUrl, { credentials: 'same-origin' }) if (!response.ok) throw new Error('Unable to load this encrypted media.') ciphertext = await response.arrayBuffer() await cacheCiphertext(attachment.id, ciphertext).catch(() => undefined) } const keyEnvelope = metadata.keyEnvelope ?? attachment.key_envelope if (!keyEnvelope) throw new Error('This media was not encrypted for your account.') const plaintext = await decryptAttachment(ciphertext, metadata.nonce, keyEnvelope) const blob = new Blob([plaintext], { type: attachment.content_type }) plaintextMemoryCache.set(attachment.id, blob) return blob })().finally | () => inFlight.delete(attachment.id) |
| 22 | (async () => { const { attachment: metadata } = await api<{ attachment: AttachmentMetadata }>(`/api/uploads/${attachment.id}`) let ciphertext = await getCachedCiphertext(attachment.id).catch(() => null) if (!ciphertext) { const response = await fetch(metadata.downloadUrl, { credentials: 'same-origin' }) if (!response.ok) throw new Error('Unable to load this encrypted media.') ciphertext = await response.arrayBuffer() await cacheCiphertext(attachment.id, ciphertext).catch(() => undefined) } const keyEnvelope = metadata.keyEnvelope ?? attachment.key_envelope if (!keyEnvelope) throw new Error('This media was not encrypted for your account.') const plaintext = await decryptAttachment(ciphertext, metadata.nonce, keyEnvelope) const blob = new Blob([plaintext], { type: attachment.content_type }) plaintextMemoryCache.set(attachment.id, blob) return blob }) |  |
| 23 | api | `/api/uploads/${attachment.id}` |
| 26 | fetch | metadata.downloadUrl; { credentials: 'same-origin' } |
| 46 | URL.createObjectURL | blob |
| 51 | window.setTimeout | () => URL.revokeObjectURL(url); 1000 |
| 51 | URL.revokeObjectURL | url |

### features/media/v2/appwriteTransport.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 9 | fetch | path; { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${start}-${end}/${total}`, }, body: bytes, signal, } |
| 54 | api | `/api/uploads/v2/${job.attachmentId}/finalize`; { method: 'POST', signal } |

### features/media/v2/jobStore.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 54 | indexedDB.open | DB_NAME; DB_VERSION |

### features/media/v2/mediaHydratorV2.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 24 | navigator.storage.getDirectory |  |
| 25 | root.getDirectoryHandle | ROOT; { create: true } |
| 26 | app.getDirectoryHandle | PLAYBACK; { create: true } |
| 68 | api | `/api/uploads/v2/${attachment.id}`; { signal } |
| 84 | fetch | metadata.downloadUrl; { credentials: 'same-origin', headers: { Range: `bytes=${cipherOffset}-${cipherOffset + recordLength - 1}` }, signal, } |
| 129 | URL.createObjectURL | file |
| 134 | window.setTimeout | () => URL.revokeObjectURL(url); 1000 |
| 134 | URL.revokeObjectURL | url |

### features/media/v2/prepareVideo.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 27 | api | '/api/uploads/intent'; { method: 'POST', body: JSON.stringify({ chatId, filename: posterFile.name, contentType: posterFile.type, sizeBytes: posterFile.size, nonce: encryptedPoster.nonce, keyEnvelopes: en |
| 38 | apiUpload | `/api/uploads/${posterIntent.attachmentId}/content`; encryptedPoster.ciphertext |
| 39 | api | `/api/uploads/${posterIntent.attachmentId}/complete`; { method: 'POST' } |
| 58 | api | '/api/uploads/v2/intent'; { method: 'POST', body: JSON.stringify({ attachmentId, chatId, filename: file.name, contentType: file.type, mediaKind: 'video', mediaMode: 'original', posterAttachmentId: previewAt |

### features/media/v2/prepareVoice.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 21 | api | '/api/uploads/v2/intent'; {method:'POST',body:JSON.stringify({attachmentId,chatId,filename:file.name,contentType,mediaKind:'voice',plaintextSize:file.size,ciphertextSize,chunkSize:TRANSPORT_BYTES,chunkCount |
| 31 | api(`/api/uploads/v2/${attachmentId}/session`,{method:'DELETE'}).catch | ()=>undefined |
| 31 | api | `/api/uploads/v2/${attachmentId}/session`; {method:'DELETE'} |
| 46 | api(`/api/uploads/v2/${attachmentId}/session`,{method:'DELETE'}).catch | ()=>undefined |
| 46 | api | `/api/uploads/v2/${attachmentId}/session`; {method:'DELETE'} |

### features/media/v2/runtime.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 11 | window.addEventListener | 'offline'; mediaV2UploadManager.handleOffline |
| 12 | window.addEventListener | 'online'; mediaV2UploadManager.handleOnline |

### features/media/v2/staging.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 52 | storageManager().getDirectory |  |
| 53 | root.getDirectoryHandle | ROOT_DIRECTORY; { create } |
| 54 | syncup.getDirectoryHandle | STAGING_DIRECTORY; { create } |

### features/media/v2/uploadManager.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 86 | window.setTimeout | resolve; ms |
| 87 | signal.addEventListener | 'abort'; () => { window.clearTimeout(timeout) reject(signal.reason ?? new DOMException('Aborted', 'AbortError')) }; { once: true } |
| 156 | api | `/api/uploads/v2/${job.attachmentId}/session`; { method: 'DELETE' } |
| 190 | api | `/api/uploads/v2/${job.attachmentId}/session` |

### features/media/v2/videoPreparation.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 5 | URL.createObjectURL | file |
| 13 | URL.revokeObjectURL | url |
| 17 | URL.createObjectURL | file |
| 48 | URL.revokeObjectURL | url |

### features/messaging/ChatDetailsScreen.tsx

State: `[username, setUsername]`, `[matches, setMatches]`, `[selected, setSelected]`, `[searching, setSearching]`, `[busy, setBusy]`, `[error, setError]`, `[convertOpen, setConvertOpen]`, `[spaceName, setSpaceName]`, `[generalChannelName, setGeneralChannelName]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 37 | window.setTimeout | () => { setSearching(true) void Promise.all([ api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal }), api<{ contacts: D; 300 |
| 39 | Promise.all([ api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal }), api<{ contacts: DiscoveredUser[] }>('/api/contacts', { signal: controller.signal }), ]) .then(([{ users }, { contacts }]) => setMatches(users.filter((user) => contacts.some((contact) => contact.id === user.id) && !members.some((member) => member.id === user.id), ))) .catch((searchError: unknown) => { if (!controller.signal.aborted) setError(searchError instanceof Error ? searchError.message : 'Unable to search usernames.') }) .finally | () => { if (!controller.signal.aborted) setSearching(false) } |
| 39 | Promise.all([ api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal }), api<{ contacts: DiscoveredUser[] }>('/api/contacts', { signal: controller.signal }), ]) .then(([{ users }, { contacts }]) => setMatches(users.filter((user) => contacts.some((contact) => contact.id === user.id) && !members.some((member) => member.id === user.id), ))) .catch | (searchError: unknown) => { if (!controller.signal.aborted) setError(searchError instanceof Error ? searchError.message : 'Unable to search usernames.') } |
| 39 | Promise.all([ api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal }), api<{ contacts: DiscoveredUser[] }>('/api/contacts', { signal: controller.signal }), ]) .then | ([{ users }, { contacts }]) => setMatches(users.filter((user) => contacts.some((contact) => contact.id === user.id) && !members.some((member) => member.id === user.id), )) |
| 40 | api | `/api/users?username=${encodeURIComponent(query)}`; { signal: controller.signal } |
| 41 | api | '/api/contacts'; { signal: controller.signal } |
| 65 | api | `/api/chats/${chatId}/members`; { method: 'POST', body: JSON.stringify({ username: selected.username }), } |
| 85 | api | `/api/chats/${chatId}/leave`; { method: 'POST' } |
| 98 | api | `/api/chats/${chatId}/upgrade-to-space`; { method: 'POST', body: JSON.stringify({ name: spaceName, generalChannelName }), } |

### features/messaging/Conversation.tsx

State: `[chat, setChat]`, `[messages, setMessages]`, `[callHistory, setCallHistory]`, `[draft, setDraft]`, `[replyTo, setReplyTo]`, `[editingMessage, setEditingMessage]`, `[hasOlderMessages, setHasOlderMessages]`, `[loadingOlder, setLoadingOlder]`, `[onlineUsers, setOnlineUsers]`, `[typingUsers, setTypingUsers]`, `[stagedAttachments, setStagedAttachments]`, `[uploading, setUploading]`, `[videoSends, setVideoSends]`, `[voiceDraft, setVoiceDraft]`, `[submitting, setSubmitting]`, `[callStarting, setCallStarting]`, `[error, setError]`, `[loading, setLoading]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 157 | api | `/api/chats/${id}` |
| 167 | api | `/api/chats/${id}/messages?${initial ? "limit=50" : `after_seq=${lastSeq.current}&limit=100`}` |
| 170 | api | `/api/chats/${id}/calls` |
| 171 | api | `/api/chats/${id}/group-calls` |
| 207 | api | `/api/chats/${id}/read`; { method: "POST", body: JSON.stringify({ lastSeq: lastSeq.current }), } |
| 238 | api | `/api/chats/${chatId}/messages?before_seq=${encodeURIComponent(firstMessage.server_seq)}&limit=50` |
| 291 | window.setTimeout | () => target.classList.remove("message-jump-highlight"); 1600 |
| 306 | api | `/api/chats/${chatId}/messages?before_seq=${encodeURIComponent(beforeSeq)}&limit=50` |
| 382 | source.addEventListener | "message.created"; () => { void loadConversation(chatId, false); refreshInbox(); } |
| 387 | source.addEventListener | eventName; () => void loadConversation(chatId, false) |
| 389 | source.addEventListener | "message.reactions"; (event) => { const update = JSON.parse((event as MessageEvent<string>).data) as { messageId: string; }; void refreshMessageReactions(update.messageId); } |
| 395 | source.addEventListener | "message.delivered"; (event) => { const update = JSON.parse((event as MessageEvent<string>).data) as { userId: string; messageIds: string[]; }; const messageIds = new Set(update.messageIds); setMessage |
| 411 | source.addEventListener | "chat.read"; (event) => { const update = JSON.parse((event as MessageEvent<string>).data) as { userId: string; lastReadSeq: string; }; setMessages((current) => current.map((message) => { if (me |
| 424 | source.addEventListener | "presence"; (event) => { const update = JSON.parse((event as MessageEvent<string>).data) as { userId: string; online: boolean; }; setOnlineUsers((current) => { const next = new Set(current); i |
| 436 | source.addEventListener | "typing"; (event) => { const update = JSON.parse((event as MessageEvent<string>).data) as { userId: string; displayName: string; active: boolean; }; if (update.active) { setTypingUsers((curr |
| 451 | window.setTimeout | () => { setTypingUsers((current) => { const next = { ...current }; delete next[update.userId]; return next; }); timers.delete(update.userId); }; 3500 |
| 471 | source.addEventListener | "membership.changed"; () => { void loadConversation(chatId, true); refreshInbox(); } |
| 478 | window.addEventListener | "syncup-refresh-chat"; wake |
| 479 | window.setInterval | () => { if (navigator.onLine) void loadConversation(chatId, false); }; 30_000 |
| 518 | window.setTimeout | () => { void saveDraft(chatId, draft).catch((draftError: unknown) => { setError( draftError instanceof Error ? draftError.message : "Unable to save your draft.", ); }); }; 250 |
| 532 | mediaV2UploadManager.subscribe | (snapshots) => { setVideoSends( snapshots.filter( (item) => item.chatId === chatId && item.status !== "sent", ), ); for (const item of snapshots) { if (item.status !== "sent") cont |
| 547 | import("../media/v2/jobStore").then( async ({ getMediaV2Job }) => { const job = await getMediaV2Job(item.jobId); if (!job?.keyEnvelope) return; const attachment: StagedAttachment = { id: job.attachmentId, filename: job.filename, content_type: job.contentType, size_bytes: job.plaintextSize, nonce: null, key_envelope: job.keyEnvelope, transport_version: 2, duration_ms: job.durationMs ?? null, waveform: job.waveform ?? null, width: job.width ?? null, height: job.height ?? null, poster_attachment_id: job.previewAttachment?.id ?? null, preview: job.previewAttachment ?? null, }; if (job.sendOnComplete && job.messageIdempotencyKey) { const members = job.chatId === chat?.id ? chat.members : ( await api<{ chat: { members: ChatMember[] } }>( `/api/chats/${job.chatId}`, ) ).chat.members; const attachments = [ attachment, ...(job.mediaKind === "video" && job.previewAttachment ? [job.previewAttachment] : []), ]; const encrypted = await encryptMessage("", members); const pendingMessage: PendingMessage = { chatId: job.chatId, localId: crypto.randomUUID(), idempotencyKey: job.messageIdempotencyKey, ...encrypted, attachmentIds: attachments.map((item) => item.id), attachments, createdAt: new Date().toISOString(), attempts: 0, nextAttemptAt: 0, }; await savePendingMessage(pendingMessage); const { patchMediaV2Job } = await import("../media/v2/jobStore"); await patchMediaV2Job(job.id, { sendOnComplete: false }); sentV2AttachmentIds.current.add(job.attachmentId); onQueued(pendingMessage); window.dispatchEvent(new Event("syncup-outbox-wake")); return; } if (job.chatId !== chatId) return; setStagedAttachments((current) => { const additions = [ attachment, ...(job.mediaKind === "video" && job.previewAttachment ? [job.previewAttachment] : []), ].filter( (candidate) => !current.some((item) => item.id === candidate.id), ); return additions.length ? [...current, ...additions] : current; }); }, ) .catch((queueError: unknown) => { setError( queueError instanceof Error ? queueError.message : "Unable to queue uploaded media.", ); }) .finally | () => { processingV2AttachmentIds.current.delete(item.attachmentId); } |
| 547 | import("../media/v2/jobStore").then( async ({ getMediaV2Job }) => { const job = await getMediaV2Job(item.jobId); if (!job?.keyEnvelope) return; const attachment: StagedAttachment = { id: job.attachmentId, filename: job.filename, content_type: job.contentType, size_bytes: job.plaintextSize, nonce: null, key_envelope: job.keyEnvelope, transport_version: 2, duration_ms: job.durationMs ?? null, waveform: job.waveform ?? null, width: job.width ?? null, height: job.height ?? null, poster_attachment_id: job.previewAttachment?.id ?? null, preview: job.previewAttachment ?? null, }; if (job.sendOnComplete && job.messageIdempotencyKey) { const members = job.chatId === chat?.id ? chat.members : ( await api<{ chat: { members: ChatMember[] } }>( `/api/chats/${job.chatId}`, ) ).chat.members; const attachments = [ attachment, ...(job.mediaKind === "video" && job.previewAttachment ? [job.previewAttachment] : []), ]; const encrypted = await encryptMessage("", members); const pendingMessage: PendingMessage = { chatId: job.chatId, localId: crypto.randomUUID(), idempotencyKey: job.messageIdempotencyKey, ...encrypted, attachmentIds: attachments.map((item) => item.id), attachments, createdAt: new Date().toISOString(), attempts: 0, nextAttemptAt: 0, }; await savePendingMessage(pendingMessage); const { patchMediaV2Job } = await import("../media/v2/jobStore"); await patchMediaV2Job(job.id, { sendOnComplete: false }); sentV2AttachmentIds.current.add(job.attachmentId); onQueued(pendingMessage); window.dispatchEvent(new Event("syncup-outbox-wake")); return; } if (job.chatId !== chatId) return; setStagedAttachments((current) => { const additions = [ attachment, ...(job.mediaKind === "video" && job.previewAttachment ? [job.previewAttachment] : []), ].filter( (candidate) => !current.some((item) => item.id === candidate.id), ); return additions.length ? [...current, ...additions] : current; }); }, ) .catch | (queueError: unknown) => { setError( queueError instanceof Error ? queueError.message : "Unable to queue uploaded media.", ); } |
| 571 | api | `/api/chats/${job.chatId}` |
| 598 | window.dispatchEvent | new Event("syncup-outbox-wake") |
| 700 | api | "/api/uploads/intent"; { method: "POST", body: JSON.stringify({ chatId, filename: file.name, contentType: file.type, sizeBytes: file.size, nonce: encrypted.nonce, keyEnvelopes: encrypted.keyEnvelopes, }) |
| 714 | apiUpload | `/api/uploads/${intent.attachmentId}/content`; encrypted.ciphertext |
| 718 | api | `/api/uploads/${intent.attachmentId}/complete`; { method: "POST", } |
| 759 | URL.revokeObjectURL | voiceDraft.url |
| 781 | api | "/api/group-calls"; { method: "POST", body: JSON.stringify({ chatId, callType, keyEnvelopes: preparedKey.keyEnvelopes }), } |
| 797 | api | "/api/calls"; { method: "POST", body: JSON.stringify({ chatId, callType }), } |
| 833 | api | `/api/chats/${chatId}/typing`; { method: "POST", body: JSON.stringify({ active }), } |
| 871 | api | `/api/messages/${editingMessage.id}`; { method: "PATCH", body: JSON.stringify(encrypted), } |
| 923 | window.dispatchEvent | new Event("syncup-outbox-wake") |
| 938 | api | `/api/messages/${message.id}/reactions`; { method: "POST", body: JSON.stringify({ emoji }), } |
| 974 | api | `/api/chats/${chatId}/messages?before_seq=${Number(target.server_seq) + 1}&limit=1` |
| 1011 | api | `/api/messages/${message.id}/delete`; { method: "POST", body: JSON.stringify({ scope }), } |
| 1028 | api | `/api/messages/${message.id}/pin`; { method: "POST" } |
| 1129 | window.dispatchEvent | new Event("syncup-close-chat") |
| 1227 | URL.revokeObjectURL | voiceDraft.url |
| 1251 | window.dispatchEvent | new Event("syncup-close-chat") |

### features/messaging/MessageAttachment.tsx

State: `[previewUrl, setPreviewUrl]`, `[visible, setVisible]`, `[attempt, setAttempt]`, `[error, setError]`, `[videoPosterUrl, setVideoPosterUrl]`, `[videoPosterError, setVideoPosterError]`, `[videoReady, setVideoReady]`, `[videoDownloading, setVideoDownloading]`, `[videoDownloadProgress, setVideoDownloadProgress]`, `[videoDownloadError, setVideoDownloadError]`, `[voiceUrl, setVoiceUrl]`, `[voiceLoading, setVoiceLoading]`, `[voicePlaying, setVoicePlaying]`, `[voiceReady, setVoiceReady]`, `[voiceAttempt, setVoiceAttempt]`, `[voiceCurrent, setVoiceCurrent]`, `[voiceDuration, setVoiceDuration]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 97 | hydrateAttachment(attachment) .then((blob) => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setPreviewUrl(objectUrl); }) .catch | (loadError: unknown) => { if (!cancelled) setError( loadError instanceof Error ? loadError.message : "Unable to open this media.", ); } |
| 100 | URL.createObjectURL | blob |
| 113 | URL.revokeObjectURL | objectUrl |
| 120 | URL.revokeObjectURL | videoPlaybackObjectUrl.current |
| 130 | hydrateAttachment(attachment.preview) .then((file) => { if (cancelled) return; objectUrl = URL.createObjectURL(file); setVideoPosterUrl(objectUrl); }) .catch | (previewError: unknown) => { if (!cancelled) { setVideoPosterError( previewError instanceof Error ? previewError.message : "Unable to load this video preview.", ); } } |
| 133 | URL.createObjectURL | file |
| 147 | URL.revokeObjectURL | objectUrl |
| 169 | hydrateMediaV2(attachment, undefined, controller.signal) .then((file) => { if (cancelled) return; objectUrl = URL.createObjectURL(file); voiceUrlRef.current = objectUrl; setVoiceUrl(objectUrl); setVoiceReady(true); }) .catch(() => { if (!cancelled) setError("Couldn’t load this voice note."); }) .finally | () => { if (!cancelled) setVoiceLoading(false); } |
| 169 | hydrateMediaV2(attachment, undefined, controller.signal) .then((file) => { if (cancelled) return; objectUrl = URL.createObjectURL(file); voiceUrlRef.current = objectUrl; setVoiceUrl(objectUrl); setVoiceReady(true); }) .catch | () => { if (!cancelled) setError("Couldn’t load this voice note."); } |
| 172 | URL.createObjectURL | file |
| 187 | URL.revokeObjectURL | objectUrl |
| 236 | URL.createObjectURL | file |

### features/messaging/MessageComposer.tsx

State: `[emojiPickerOpen, setEmojiPickerOpen]`.

### features/messaging/MessageList.tsx

State: `[viewerAttachmentId, setViewerAttachmentId]`, `[reactionPickerMessageId, setReactionPickerMessageId]`.

### features/messaging/NewConversation.tsx

State: `[mode, setMode]`, `[username, setUsername]`, `[usernameMatches, setUsernameMatches]`, `[selectedUser, setSelectedUser]`, `[searchingUsers, setSearchingUsers]`, `[searchError, setSearchError]`, `[groupName, setGroupName]`, `[groupMembers, setGroupMembers]`, `[firstMessage, setFirstMessage]`, `[error, setError]`, `[loading, setLoading]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 45 | window.setTimeout | () => { void api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal }) .then(({ users }) => setUsernameMatches(users)) .ca; 300 |
| 46 | api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal }) .then(({ users }) => setUsernameMatches(users)) .catch((searchError: unknown) => { if (!controller.signal.aborted) { setUsernameMatches([]) setSearchError(searchError instanceof Error ? searchError.message : 'Unable to search usernames.') } }) .finally | () => { if (!controller.signal.aborted) setSearchingUsers(false) } |
| 46 | api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal }) .then(({ users }) => setUsernameMatches(users)) .catch | (searchError: unknown) => { if (!controller.signal.aborted) { setUsernameMatches([]) setSearchError(searchError instanceof Error ? searchError.message : 'Unable to search usernames |
| 46 | api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal }) .then | ({ users }) => setUsernameMatches(users) |
| 46 | api | `/api/users?username=${encodeURIComponent(query)}`; { signal: controller.signal } |
| 72 | api | '/api/auth/key-bundle' |
| 73 | api | '/api/contacts' |
| 80 | api | '/api/requests'; { method: 'POST', body: JSON.stringify({ username: target.username, message: { ...encrypted, idempotencyKey: crypto.randomUUID() }, }), } |
| 89 | api | '/api/chats/direct'; { method: 'POST', body: JSON.stringify({ username: target.username }), } |
| 93 | api | `/api/chats/${result.chatId}` |
| 95 | api | '/api/chats/' + result.chatId + '/messages'; { method: 'POST', body: JSON.stringify({ ...encrypted, idempotencyKey: crypto.randomUUID() }), } |
| 103 | api | '/api/chats/groups'; { method: 'POST', body: JSON.stringify({ title: groupName, usernames }), } |

### features/messaging/ReportDialog.tsx

State: `[reason, setReason]`, `[details, setDetails]`, `[error, setError]`, `[submitting, setSubmitting]`.

### features/messaging/RequestsPanel.tsx

State: `[previews, setPreviews]`.

### features/messaging/SearchDialog.tsx

State: `[query, setQuery]`, `[results, setResults]`, `[searching, setSearching]`, `[error, setError]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 49 | window.setTimeout | () => { void api<SearchResults>(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal }) .then((response) => { setResults(response); setError('') }) .catch((sea; 250 |
| 50 | api<SearchResults>(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal }) .then((response) => { setResults(response); setError('') }) .catch((searchError: unknown) => { if (!controller.signal.aborted) setError(searchError instanceof Error ? searchError.message : 'Unable to search SyncUp.') }) .finally | () => { if (!controller.signal.aborted) setSearching(false) } |
| 50 | api<SearchResults>(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal }) .then((response) => { setResults(response); setError('') }) .catch | (searchError: unknown) => { if (!controller.signal.aborted) setError(searchError instanceof Error ? searchError.message : 'Unable to search SyncUp.') } |
| 50 | api<SearchResults>(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal }) .then | (response) => { setResults(response); setError('') } |
| 50 | api | `/api/search?q=${encodeURIComponent(value)}`; { signal: controller.signal } |
| 69 | window.addEventListener | 'keydown'; closeOnEscape |

### features/messaging/VoiceRecorder.tsx

State: `[recording,setRecording]`, `[paused,setPaused]`, `[elapsed,setElapsed]`, `[levels,setLevels]`, `[playing,setPlaying]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 13 | navigator.mediaDevices.getUserMedia | {audio:true} |
| 16 | URL.createObjectURL | blob |
| 19 | window.setInterval | ()=>{if(r.state==='recording'){setElapsed(Date.now()-started.current-pausedTotal.current);analyser.getByteTimeDomainData(data);let peak=0;for(const value of data)peak=Math.max(peak; 120 |
| 34 | URL.revokeObjectURL | draft.url |

### features/messaging/api.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 6 | api | '/api/reports'; { method: 'POST', body: JSON.stringify({ messageId, reason, details }), } |

### features/messaging/outbox.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 41 | indexedDB.open | databaseName; databaseVersion |

### features/messaging/useConversationUiState.ts

State: `[reportingMessageId, setReportingMessageId]`, `[detailsOpen, setDetailsOpen]`, `[messageSearchOpen, setMessageSearchOpen]`, `[messageSearch, setMessageSearch]`.

### features/spaces/SharedObjectCard.tsx

State: `[selectedOptions, setSelectedOptions]`.

### features/spaces/SpacesPage.tsx

State: `[spaces, setSpaces]`, `[space, setSpace]`, `[channelId, setChannelId]`, `[messages, setMessages]`, `[legacyHistory, setLegacyHistory]`, `[sharedObjects, setSharedObjects]`, `[searchOpen, setSearchOpen]`, `[searchQuery, setSearchQuery]`, `[searchAfter, setSearchAfter]`, `[searchBefore, setSearchBefore]`, `[searchFrom, setSearchFrom]`, `[searchHas, setSearchHas]`, `[searchObjectType, setSearchObjectType]`, `[searchResults, setSearchResults]`, `[searchSubmitted, setSearchSubmitted]`, `[filePanelOpen, setFilePanelOpen]`, `[channelFiles, setChannelFiles]`, `[historyCursor, setHistoryCursor]`, `[spaceName, setSpaceName]`, `[spaceDescription, setSpaceDescription]`, `[spaceIcon, setSpaceIcon]`, `[inviteUsername, setInviteUsername]`, `[inviteRole, setInviteRole]`, `[inviteChannels, setInviteChannels]`, `[channelName, setChannelName]`, `[channelType, setChannelType]`, `[channelTopic, setChannelTopic]`, `[channelCategoryId, setChannelCategoryId]`, `[channelDialogOpen, setChannelDialogOpen]`, `[categoryDialogOpen, setCategoryDialogOpen]`, `[categoryName, setCategoryName]`, `[spaceSettingsTab, setSpaceSettingsTab]`, `[channelSettingsTab, setChannelSettingsTab]`, `[topicDraft, setTopicDraft]`, `[permissionDraft, setPermissionDraft]`, `[mentionMenuOpen, setMentionMenuOpen]`, `[objectMenuOpen, setObjectMenuOpen]`, `[objectDialogType, setObjectDialogType]`, `[objectTitle, setObjectTitle]`, `[objectOptions, setObjectOptions]`, `[objectItemsText, setObjectItemsText]`, `[objectAssigneeId, setObjectAssigneeId]`, `[objectStartsAt, setObjectStartsAt]`, `[objectLocation, setObjectLocation]`, `[objectMultiSelect, setObjectMultiSelect]`, `[objectAnonymous, setObjectAnonymous]`, `[highlightedMessageId, setHighlightedMessageId]`, `[mentionNotice, setMentionNotice]`, `[draft, setDraft]`, `[error, setError]`, `[busy, setBusy]`, `[collapsedCategories, setCollapsedCategories]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 188 | api | '/api/spaces' |
| 193 | api | `/api/spaces/${id}` |
| 212 | api<{ space: SpaceDetails }>(`/api/spaces/${openTarget.spaceId}`) .then(({ space: nextSpace }) => { setSpace(nextSpace) setChannelId(openTarget.channelId) setHistoryCursor(null) setHighlightedMessageId(openTarget.messageId) }) .catch | (loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to open this update.') |
| 212 | api<{ space: SpaceDetails }>(`/api/spaces/${openTarget.spaceId}`) .then | ({ space: nextSpace }) => { setSpace(nextSpace) setChannelId(openTarget.channelId) setHistoryCursor(null) setHighlightedMessageId(openTarget.messageId) } |
| 212 | api | `/api/spaces/${openTarget.spaceId}` |
| 258 | api | `/api/spaces/${space.id}/channels/${activeChannel.id}/permissions`; { method: 'PATCH', body: JSON.stringify({ permissions: permissionDraft }), } |
| 273 | api<{ spaces: SpaceSummary[] }>('/api/spaces') .then(({ spaces: nextSpaces }) => { if (active) setSpaces(nextSpaces) }) .catch | (loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load Spaces.') } |
| 273 | api<{ spaces: SpaceSummary[] }>('/api/spaces') .then | ({ spaces: nextSpaces }) => { if (active) setSpaces(nextSpaces) } |
| 273 | api | '/api/spaces' |
| 282 | api<{ space: SpaceDetails }>(`/api/spaces/${space.id}`) .then(({ space: nextSpace }) => { if (active) setSpace(nextSpace) }) .catch | (loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to refresh this Space.') } |
| 282 | api<{ space: SpaceDetails }>(`/api/spaces/${space.id}`) .then | ({ space: nextSpace }) => { if (active) setSpace(nextSpace) } |
| 282 | api | `/api/spaces/${space.id}` |
| 285 | window.setInterval | () => { void refresh() }; 15_000 |
| 301 | api | path |
| 302 | api | `/api/spaces/${space.id}/channels/${channelId}/objects` |
| 319 | stream.addEventListener | 'channel.message'; refreshOnEvent |
| 320 | stream.addEventListener | 'channel.object'; refreshOnEvent |
| 321 | stream.addEventListener | 'channel.mention'; onMention |
| 322 | window.setInterval | () => { void refresh() }; 5000 |
| 329 | api<{ messages: EncryptedChatMessage[]; hasMore: boolean }>( `/api/chats/${legacyChannelId}/messages?limit=50`, { signal: controller.signal }, ).then(async ({ messages: encryptedMessages, hasMore }) => { const decoded = await decodeLegacyMessages(encryptedMessages) if (controller.signal.aborted) return setLegacyHistory({ channelId: legacyChannelId, messages: decoded, hasMore, loading: false, error: '' }) }).catch | (loadError: unknown) => { if (!controller.signal.aborted) setLegacyHistory({ channelId: legacyChannelId, messages: [], hasMore: false, loading: false, error: loadError instanceof E |
| 329 | api<{ messages: EncryptedChatMessage[]; hasMore: boolean }>( `/api/chats/${legacyChannelId}/messages?limit=50`, { signal: controller.signal }, ).then | async ({ messages: encryptedMessages, hasMore }) => { const decoded = await decodeLegacyMessages(encryptedMessages) if (controller.signal.aborted) return setLegacyHistory({ channel |
| 329 | api | `/api/chats/${legacyChannelId}/messages?limit=50`; { signal: controller.signal } |
| 354 | api | `/api/chats/${requestedChannelId}/messages?limit=50&before_seq=${encodeURIComponent(beforeSeq)}` |
| 377 | window.setTimeout | () => setHighlightedMessageId(null); 4000 |
| 386 | api | '/api/spaces'; { method: 'POST', body: JSON.stringify({ name: spaceName, description: spaceDescription, icon: spaceIcon, template: 'client-room' }), } |
| 408 | api | `/api/spaces/${space.id}/channels`; { method: 'POST', body: JSON.stringify({ name: channelName, type: channelType, categoryId: channelCategoryId, topic: channelTopic }), } |
| 431 | api | `/api/spaces/${space.id}`; { method: 'PATCH', body: JSON.stringify({ name: space.name, description: space.description, icon: space.icon }), } |
| 451 | api | `/api/spaces/${space.id}/categories`; { method: 'POST', body: JSON.stringify({ name: categoryName }), } |
| 472 | api | `/api/spaces/${space.id}/channels/${activeChannel.id}`; { method: 'PATCH', body: JSON.stringify({ topic: topicDraft }), } |
| 496 | api | `/api/spaces/${space.id}/members`; { method: 'POST', body: JSON.stringify({ username: inviteUsername, role: inviteRole, ...(channels ? { channels } : {}) }), } |
| 517 | api | `/api/spaces/${space.id}/channels/${channelId}/messages`; { method: 'POST', body: JSON.stringify({ body: draft }), } |
| 522 | api | `/api/spaces/${space.id}/channels/${channelId}/messages` |
| 581 | api | `/api/spaces/${space.id}/channels/${activeChannel.id}/objects`; { method: 'POST', body: JSON.stringify(body), } |
| 596 | api | `/api/spaces/${spaceId}/channels/${targetChannelId}/messages` |
| 597 | api | `/api/spaces/${spaceId}/channels/${targetChannelId}/objects` |
| 615 | api | `/api/spaces/${space.id}/search?${params}` |
| 630 | api | `/api/spaces/${space.id}/channels/${activeChannel.id}/files` |
| 642 | api | `/api/spaces/${space.id}/channels/${activeChannel.id}/files`; { method: 'POST', body: JSON.stringify({ filename: file.name, contentType: file.type \|\| 'application/octet-stream', sizeBytes: file.size }), } |
| 647 | apiUpload | `${filePath}/content`; file; file.type \|\| 'application/octet-stream' |
| 648 | api | `${filePath}/complete`; { method: 'POST', body: JSON.stringify({}) } |
| 649 | api | `/api/spaces/${space.id}/channels/${activeChannel.id}/files` |
| 672 | api | `/api/spaces/${space.id}/channels/${object.chat_id}/objects/${object.id}/respond`; { method: 'POST', body: JSON.stringify(response), } |
| 689 | api | `/api/spaces/${space.id}/channels/${object.chat_id}/objects/${object.id}/state`; { method: 'PATCH', body: JSON.stringify({ state }), } |
| 708 | api | `/api/spaces/${space.id}/channels/${activeChannel.id}/messages/${message.id}/decision`; { method: 'POST', body: JSON.stringify({ title: title.trim() }), } |

### features/spaces/UpdatesPage.tsx

State: `[stacks, setStacks]`, `[activeCalls, setActiveCalls]`, `[query, setQuery]`, `[filter, setFilter]`, `[error, setError]`, `[busy, setBusy]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 23 | api | `/api/spaces/updates${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}` |
| 30 | api<{ stacks: Stacks; activeCalls: ActiveCall[] }>('/api/spaces/updates') .then(({ stacks: result, activeCalls: calls }) => { if (active) { setStacks(result); setActiveCalls(calls) } }) .catch | (loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load Updates.') } |
| 30 | api<{ stacks: Stacks; activeCalls: ActiveCall[] }>('/api/spaces/updates') .then | ({ stacks: result, activeCalls: calls }) => { if (active) { setStacks(result); setActiveCalls(calls) } } |
| 30 | api | '/api/spaces/updates' |
| 40 | api | `/api/spaces/${object.space_id}/channels/${object.chat_id}/objects/${object.id}/respond`; { method: 'POST', body: JSON.stringify(data), } |
| 56 | api | `/api/spaces/${object.space_id}/channels/${object.chat_id}/objects/${object.id}/state`; { method: 'PATCH', body: JSON.stringify({ state }), } |

### features/workspace/WorkspacePage.tsx

State: `[accountOpen, setAccountOpen]`, `[appearance, setAppearance]`, `[currentUser, setCurrentUser]`, `[chats, setChats]`, `[searchableMessages, setSearchableMessages]`, `[requests, setRequests]`, `[filter, setFilter]`, `[callHistory, setCallHistory]`, `[callIntent, setCallIntent]`, `[newCallRequested, setNewCallRequested]`, `[newCallRequestedType, setNewCallRequestedType]`, `[incomingCall, setIncomingCall]`, `[activeCall, setActiveCall]`, `[newConversation, setNewConversation]`, `[searchOpen, setSearchOpen]`, `[initialUsername, setInitialUsername]`, `[pending, setPending]`, `[drafts, setDrafts]`, `[online, setOnline]`, `[error, setError]`.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 66 | api | '/api/calls' |
| 67 | api | '/api/group-calls' |
| 74 | api | '/api/inbox' |
| 75 | api | '/api/requests' |
| 105 | api | `/api/chats/${message.chatId}/messages`; { method: 'POST', body: JSON.stringify({ bodyCiphertext: message.bodyCiphertext, bodyNonce: message.bodyNonce, keyEnvelopes: message.keyEnvelopes, idempotencyKey: message.idempoten |
| 119 | window.dispatchEvent | new Event('syncup-refresh-chat') |
| 151 | Promise.all([ api<{ calls: IncomingCall[] }>('/api/calls/incoming'), api<{ calls: IncomingCall[] }>('/api/group-calls/incoming'), ]) .then(([direct, groups]) => { if (active) setIncomingCall([...direct.calls, ...groups.calls][0] ?? null) }) .catch | (loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to check incoming calls.') } |
| 151 | Promise.all([ api<{ calls: IncomingCall[] }>('/api/calls/incoming'), api<{ calls: IncomingCall[] }>('/api/group-calls/incoming'), ]) .then | ([direct, groups]) => { if (active) setIncomingCall([...direct.calls, ...groups.calls][0] ?? null) } |
| 152 | api | '/api/calls/incoming' |
| 153 | api | '/api/group-calls/incoming' |
| 163 | window.setInterval | pollIncomingCalls; 3000 |
| 172 | window.setTimeout | () => { refreshInbox().catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load the inbox.') }) listPendingMessages().t; 0 |
| 179 | window.setInterval | () => { refreshInbox().catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to refresh the inbox.') }) void flushOutbox() }; 15_000 |
| 187 | window.addEventListener | 'online'; updateOnline |
| 188 | window.addEventListener | 'offline'; updateOnline |
| 189 | window.addEventListener | 'syncup-outbox-wake'; wake |
| 203 | window.addEventListener | 'syncup-close-chat'; closeChat |
| 204 | window.addEventListener | 'syncup-refresh-chat'; refreshChat |
| 215 | window.addEventListener | 'resize'; adjustMobileCallsView |
| 226 | window.addEventListener | 'keydown'; openSearch |
| 232 | api | `/api/requests/${item.id}/accept`; { method: 'POST' } |
| 243 | api | `/api/requests/${item.id}/ignore`; { method: 'POST' } |
| 252 | api | '/api/auth/sign-out'; { method: 'POST' } |
| 269 | api | `/api/group-calls/${incomingCall.id}/answer`; { method: 'POST' } |
| 285 | api | `/api/calls/${incomingCall.id}/accept`; { method: 'POST' } |
| 299 | api | `/api/group-calls/${incomingCall.id}/leave`; { method: 'POST' } |
| 312 | api | `/api/${incomingCall.is_group ? 'group-calls' : 'calls'}/${incomingCall.id}/decline`; { method: 'POST' } |
| 327 | api | `/api/group-calls/${activeCall.id}/${activeCall.isHost ? 'end' : 'leave'}`; { method: 'POST' } |
| 329 | api | `/api/calls/${activeCall.id}/end`; { method: 'POST' } |
| 337 | window.dispatchEvent | new Event('syncup-refresh-chat') |

### features/workspace/useWorkspaceNavigation.ts

State: `[showRequests, setShowRequests]`, `[showCalls, setShowCalls]`, `[showUpdates, setShowUpdates]`, `[showSpaces, setShowSpaces]`, `[updatesTarget, setUpdatesTarget]`, `[activeChatId, setActiveChatId]`.

### shared/api.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 4 | fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin', }).then((refreshResponse) => refreshResponse.ok).catch | () => false |
| 4 | fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin', }).then | (refreshResponse) => refreshResponse.ok |
| 4 | fetch | '/api/auth/refresh'; { method: 'POST', credentials: 'same-origin', } |
| 28 | fetch | path; { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers }, } |
| 45 | fetch | path; { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': contentType }, body, } |

### shared/appearance.ts

State: none.

| Line | Call | Argument expressions |
| ---: | --- | --- |
| 11 | window.localStorage.getItem | storageKey |
| 18 | window.localStorage.setItem | storageKey; preference |
| 39 | system.addEventListener | 'change'; updateSystem |

## Complete effect callbacks and dependency arrays

46 useEffect/useLayoutEffect sites. Exact frozen callback source includes subscriptions, conditional early returns, API calls and cleanup, making cancellation gaps explicit. Main contract F provides future risk/ownership decisions; this section does not authorize migrating an effect. Source lines refer to the baseline, not this Markdown.

### app/AppRouter.tsx

<details>
<summary>useEffect, source line 15; dependencies []</summary>

```tsx
() => {
    let cancelled = false;
    api<{ user: User }>("/api/auth/me")
      .then((result) => {
        if (!cancelled) setUser(result.user);
      })
      .catch((error: unknown) => {
        if (
          !cancelled &&
          error instanceof Error &&
          error.message !== "Sign in required." &&
          error.message !== "Session expired."
        ) {
          setSessionError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }
// dependency array: []
```

</details>

### features/account/AccountPanel.tsx

<details>
<summary>useEffect, source line 30; dependencies [avatarPreview]</summary>

```tsx
() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
  }
// dependency array: [avatarPreview]
```

</details>

<details>
<summary>useEffect, source line 41; dependencies []</summary>

```tsx
() => {
    let mounted = true
    listSessions()
      .then((result) => {
        if (mounted) {
          setSessions(result.sessions)
          setCurrentSessionId(result.currentSessionId)
        }
      })
      .catch((sessionsLoadError: unknown) => {
        if (mounted) {
          setSessionsError(sessionsLoadError instanceof Error ? sessionsLoadError.message : 'Unable to load sessions.')
        }
      })
    return () => { mounted = false }
  }
// dependency array: []
```

</details>

### features/account/SafetySettings.tsx

<details>
<summary>useEffect, source line 32; dependencies []</summary>

```tsx
() => {
    let active = true
    api<{ blockedUsers: BlockedUser[] }>('/api/blocks')
      .then((result) => { if (active) setBlockedUsers(result.blockedUsers) })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load blocked users.')
      })
    return () => { active = false }
  }
// dependency array: []
```

</details>

### features/calls/CallWindow.tsx

<details>
<summary>useEffect, source line 68; dependencies [callId, video, isGroup, isHost, e2eeKey, isVoiceRoom, voiceSpaceId, voiceChannelId, canPublish]</summary>

```tsx
() => {
    let cancelled = false
    let disconnect: (() => void) | null = null
    let encryptionWorker: Worker | null = null

    void (async () => {
      try {
        const { ExternalE2EEKeyProvider, isE2EESupported, ParticipantEvent, Room, RoomEvent } = await import('livekit-client')
        if (cancelled) return
        let roomOptions: ConstructorParameters<typeof Room>[0] = { adaptiveStream: true, dynacast: true }
        if (isGroup) {
          if (!e2eeKey || !isE2EESupported()) {
            throw new Error('This browser cannot securely encrypt group-call media.')
          }
          const keyProvider = new ExternalE2EEKeyProvider()
          await keyProvider.setKey(e2eeKey.slice().buffer)
          encryptionWorker = new Worker(new URL('livekit-client/e2ee-worker', import.meta.url), { type: 'module' })
          encryptionWorkerRef.current = encryptionWorker
          roomOptions = {
            ...roomOptions,
            encryption: { keyProvider, worker: encryptionWorker },
          }
        }
        const room = new Room(roomOptions)
        if (isGroup) await room.setE2EEEnabled(true)
        roomRef.current = room
        disconnect = () => {
          void room.disconnect()
          encryptionWorkerRef.current?.terminate()
          encryptionWorkerRef.current = null
          encryptionWorker = null
        }
        const attach = (track: { attach: () => HTMLMediaElement }, identity: string, local = false) => {
          const element = track.attach()
          element.dataset.participant = identity
          element.autoplay = true
          if (element instanceof HTMLVideoElement) {
            element.playsInline = true
            element.muted = local
            element.className = `call-video-tile${local ? ' call-video-local' : ''}`
          } else if (element instanceof HTMLAudioElement) {
            element.className = 'call-audio-track'
          }
          mediaStage.current?.append(element)
        }
        const detach = (track: { detach: () => HTMLMediaElement[] }) => {
          for (const element of track.detach()) element.remove()
        }
        const syncedParticipants = new Set<string>()
        const syncPeer = (participant: RemoteParticipant) => {
          const update = () => setPeers((current) => ({
            ...current,
            [participant.identity]: {
              id: participant.identity,
              name: participant.name || participant.identity,
              microphoneEnabled: participant.isMicrophoneEnabled,
              cameraEnabled: participant.isCameraEnabled,
            },
          }))
          if (!syncedParticipants.has(participant.identity)) {
            participant.on(ParticipantEvent.TrackMuted, update)
            participant.on(ParticipantEvent.TrackUnmuted, update)
            syncedParticipants.add(participant.identity)
          }
          update()
        }
        room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          attach(track, participant.identity)
          syncPeer(participant)
        })
        room.on(RoomEvent.TrackUnsubscribed, detach)
        room.on(RoomEvent.ParticipantConnected, syncPeer)
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          syncedParticipants.delete(participant.identity)
          setPeers((current) => {
            const next = { ...current }
            delete next[participant.identity]
            return next
          })
        })
        room.on(RoomEvent.Disconnected, () => setConnected(false))
        if (isGroup) {
          room.on(RoomEvent.EncryptionError, (encryptionError) => {
            setError(`Group-call encryption failed: ${encryptionError.message}`)
            setConnected(false)
            setFinished(true)
            e2eeKey?.fill(0)
            void room.disconnect()
            encryptionWorkerRef.current?.terminate()
            encryptionWorkerRef.current = null
            void callApi(`/api/group-calls/${callId}/${isHost ? 'end' : 'leave'}`, { method: 'POST' })
              .catch((leaveError: unknown) => {
                setError(`Group-call encryption failed, and ending your call participation also failed: ${leaveError instanceof Error ? leaveError.message : 'unknown error'}`)
              })
          })
        }
        const credentialsPath = isVoiceRoom && voiceSpaceId && voiceChannelId
          ? `/api/spaces/${voiceSpaceId}/channels/${voiceChannelId}/voice/token`
          : `/api/${isGroup ? 'group-calls' : 'calls'}/${callId}/token`
        const credentials = await callApi<{ url: string; token: string }>(credentialsPath, { method: 'POST' })
        if (cancelled) return
        await room.connect(credentials.url, credentials.token)
        if (cancelled) return
        setLocalIdentity(room.localParticipant.identity)
        for (const participant of room.remoteParticipants.values()) syncPeer(participant)
        await room.localParticipant.setMicrophoneEnabled(!isVoiceRoom || canPublish)
        if (video) await room.localParticipant.setCameraEnabled(true)
        for (const publication of room.localParticipant.videoTrackPublications.values()) {
          if (publication.track) attach(publication.track, room.localParticipant.identity, true)
        }
        setConnected(true)
      } catch (connectionError) {
        encryptionWorker?.terminate()
        encryptionWorkerRef.current?.terminate()
        encryptionWorkerRef.current = null
        encryptionWorker = null
        if (!cancelled) {
          const message = connectionError instanceof Error ? connectionError.message : 'Unable to join this call.'
          setError(message)
          if (isGroup) {
            setFinished(true)
            e2eeKey?.fill(0)
            void callApi(`/api/group-calls/${callId}/${isHost ? 'end' : 'leave'}`, { method: 'POST' })
              .catch((leaveError: unknown) => {
                setError(`${message} Unable to end your group-call participation: ${leaveError instanceof Error ? leaveError.message : 'unknown error'}`)
              })
          }
        }
      }
    })()

    return () => {
      cancelled = true
      disconnect?.()
      encryptionWorkerRef.current?.terminate()
      encryptionWorkerRef.current = null
      e2eeKey?.fill(0)
      roomRef.current = null
    }
  }
// dependency array: [callId, video, isGroup, isHost, e2eeKey, isVoiceRoom, voiceSpaceId, voiceChannelId, canPublish]
```

</details>

<details>
<summary>useEffect, source line 209; dependencies [callId, isGroup, e2eeKey, isVoiceRoom]</summary>

```tsx
() => {
    if (isVoiceRoom || !callId) return
    let cancelled = false
    let finished = false
    const checkStatus = () => {
      callApi<{ status: string; participants?: { user_id: string; display_name: string; status: string }[] }>(`/api/${isGroup ? 'group-calls' : 'calls'}/${callId}/status`)
        .then(({ status, participants }) => {
          if (isGroup && participants) setGroupRoster(participants.map((participant) => ({
            user_id: participant.user_id,
            display_name: participant.display_name,
            status: participant.status,
          })))
          if (cancelled || finished || !['declined', 'missed', 'ended'].includes(status)) return
          finished = true
          setFinished(true)
          setConnected(false)
          setError(status === 'declined' ? 'The other person declined the call.' : status === 'missed' ? 'The call was missed.' : 'The other person ended the call.')
          void roomRef.current?.disconnect()
          roomRef.current = null
          e2eeKey?.fill(0)
          encryptionWorkerRef.current?.terminate()
          encryptionWorkerRef.current = null
        })
        .catch((statusError: unknown) => {
          if (cancelled) return
          if (isGroup && statusError instanceof Error && statusError.message === 'Group call not found.') {
            finished = true
            setFinished(true)
            setConnected(false)
            e2eeKey?.fill(0)
            void roomRef.current?.disconnect()
            roomRef.current = null
            encryptionWorkerRef.current?.terminate()
            encryptionWorkerRef.current = null
            return
          }
          setError(statusError instanceof Error ? statusError.message : 'Unable to check call status.')
        })
    }
    checkStatus()
    const interval = window.setInterval(checkStatus, 4000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }
// dependency array: [callId, isGroup, e2eeKey, isVoiceRoom]
```

</details>

<details>
<summary>useEffect, source line 256; dependencies [isVoiceRoom, voiceSpaceId, voiceChannelId]</summary>

```tsx
() => {
    if (!isVoiceRoom || !voiceSpaceId || !voiceChannelId) return
    let cancelled = false
    const refreshRoster = () => callApi<{ participants: typeof voiceRoster }>(
      `/api/spaces/${voiceSpaceId}/channels/${voiceChannelId}/voice`,
    ).then(({ participants }) => {
      if (!cancelled) setVoiceRoster(participants)
    }).catch((rosterError: unknown) => {
      if (cancelled) return
      const message = rosterError instanceof Error ? rosterError.message : 'Unable to refresh voice room access.'
      setError(message)
      if (/not found/iu.test(message)) {
        setFinished(true)
        setConnected(false)
        void roomRef.current?.disconnect()
        roomRef.current = null
      }
    })
    void refreshRoster()
    const interval = window.setInterval(() => { void refreshRoster() }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }
// dependency array: [isVoiceRoom, voiceSpaceId, voiceChannelId]
```

</details>

### features/media/MediaViewer.tsx

<details>
<summary>useEffect, source line 32; dependencies [active, retry]</summary>

```tsx
() => {
    if (!active) return
    let cancelled = false
    let objectUrl = ''
    setUrl('')
    setError('')
    setZoom(1)
    setLoadProgress(0)
    const hydrate = active.attachment.transport_version === 2
      ? hydrateMediaV2(active.attachment, setLoadProgress)
      : hydrateAttachment(active.attachment)
    hydrate
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to open this media.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }
// dependency array: [active, retry]
```

</details>

<details>
<summary>useEffect, source line 58; dependencies [isVideo, next, onChange, onClose, previous]</summary>

```tsx
() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && previous) onChange(previous.attachment.id)
      if (event.key === 'ArrowRight' && next) onChange(next.attachment.id)
      if (!isVideo && (event.key === '+' || event.key === '=')) setZoom((value) => Math.min(4, value + .25))
      if (!isVideo && event.key === '-') setZoom((value) => Math.max(1, value - .25))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }
// dependency array: [isVideo, next, onChange, onClose, previous]
```

</details>

### features/messaging/ChatDetailsScreen.tsx

<details>
<summary>useEffect, source line 33; dependencies [isGroup, members, selected, username]</summary>

```tsx
() => {
    const query = username.trim().replace(/^@/u, '').toLowerCase()
    if (!isGroup || !query || selected?.username === query || query.length < 3 || !/^[a-z0-9_]+$/u.test(query)) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setSearching(true)
      void Promise.all([
        api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal }),
        api<{ contacts: DiscoveredUser[] }>('/api/contacts', { signal: controller.signal }),
      ])
        .then(([{ users }, { contacts }]) => setMatches(users.filter((user) =>
          contacts.some((contact) => contact.id === user.id)
          && !members.some((member) => member.id === user.id),
        )))
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) setError(searchError instanceof Error ? searchError.message : 'Unable to search usernames.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, 300)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }
// dependency array: [isGroup, members, selected, username]
```

</details>

### features/messaging/Conversation.tsx

<details>
<summary>useEffect, source line 139; dependencies [chat, chatId, messages, onSearchableMessages, user.id]</summary>

```tsx
() => {
    if (!chatId || !chat) return;
    onSearchableMessages(chatId, messages
      .filter((message) => !message.pending && !message.deleted_at && message.text.trim() && !message.text.startsWith("Unable to decrypt"))
      .map((message) => ({
        id: message.id,
        chatId,
        senderName: chat.members.find((member) => member.id === message.sender_id)?.displayName
          ?? (message.sender_id === user.id ? "You" : "Member"),
        text: message.text,
        createdAt: message.created_at,
      })));
  }
// dependency array: [chat, chatId, messages, onSearchableMessages, user.id]
```

</details>

<details>
<summary>useLayoutEffect, source line 340; dependencies [messages, loading, loadingOlder, messageSearch, highlightMessage]</summary>

```tsx
() => {
    const container = messageListRef.current;
    if (!container) return;
    if (pendingJumpId.current) {
      const targetId = pendingJumpId.current;
      pendingJumpId.current = null;
      highlightMessage(targetId);
      return;
    }
    if (scrollAnchor.current) {
      const anchor = scrollAnchor.current;
      container.scrollTop = container.scrollHeight - anchor.height + anchor.top;
      scrollAnchor.current = null;
    } else if (initialScrollPending.current && !loading) {
      container.scrollTop = container.scrollHeight;
      initialScrollPending.current = false;
      shouldStickToBottom.current = true;
    } else if (shouldStickToBottom.current) {
      container.scrollTop = container.scrollHeight;
    }
  }
// dependency array: [messages, loading, loadingOlder, messageSearch, highlightMessage]
```

</details>

<details>
<summary>useEffect, source line 371; dependencies [chatId, loadConversation]</summary>

```tsx
() => {
    lastSeq.current = 0;
    if (chatId) void loadConversation(chatId, true);
  }
// dependency array: [chatId, loadConversation]
```

</details>

<details>
<summary>useEffect, source line 376; dependencies [chatId, loadConversation, refreshInbox, user.id]</summary>

```tsx
() => {
    if (!chatId) return;
    const timers = typingTimers.current;
    const source = new EventSource(
      `/api/events?chat_id=${encodeURIComponent(chatId)}`,
    );
    source.addEventListener("message.created", () => {
      void loadConversation(chatId, false);
      refreshInbox();
    });
    for (const eventName of ["message.updated", "message.pinned"]) {
      source.addEventListener(eventName, () => void loadConversation(chatId, false));
    }
    source.addEventListener("message.reactions", (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as {
        messageId: string;
      };
      void refreshMessageReactions(update.messageId);
    });
    source.addEventListener("message.delivered", (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as {
        userId: string;
        messageIds: string[];
      };
      const messageIds = new Set(update.messageIds);
      setMessages((current) => current.map((message) => {
        if (message.sender_id !== user.id || !messageIds.has(message.id)) return message;
        const receipts = message.delivery_receipts ?? [];
        if (receipts.includes(update.userId)) return message;
        return {
          ...message,
          delivery_receipts: [...receipts, update.userId],
        };
      }));
    });
    source.addEventListener("chat.read", (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as {
        userId: string;
        lastReadSeq: string;
      };
      setMessages((current) => current.map((message) => {
        if (message.sender_id !== user.id || Number(message.server_seq) > Number(update.lastReadSeq)) return message;
        const readBy = message.read_by ?? [];
        return readBy.includes(update.userId)
          ? message
          : { ...message, read_by: [...readBy, update.userId] };
      }));
    });
    source.addEventListener("presence", (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as {
        userId: string;
        online: boolean;
      };
      setOnlineUsers((current) => {
        const next = new Set(current);
        if (update.online) next.add(update.userId);
        else next.delete(update.userId);
        return next;
      });
    });
    source.addEventListener("typing", (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as {
        userId: string;
        displayName: string;
        active: boolean;
      };
      if (update.active) {
        setTypingUsers((current) => ({
          ...current,
          [update.userId]: update.displayName,
        }));
        const previous = timers.get(update.userId);
        if (previous) window.clearTimeout(previous);
        timers.set(
          update.userId,
          window.setTimeout(() => {
            setTypingUsers((current) => {
              const next = { ...current };
              delete next[update.userId];
              return next;
            });
            timers.delete(update.userId);
          }, 3500),
        );
      } else {
        const previous = timers.get(update.userId);
        if (previous) window.clearTimeout(previous);
        timers.delete(update.userId);
        setTypingUsers((current) => {
          const next = { ...current };
          delete next[update.userId];
          return next;
        });
      }
    });
    source.addEventListener("membership.changed", () => {
      void loadConversation(chatId, true);
      refreshInbox();
    });
    const wake = () => {
      void loadConversation(chatId, false);
    };
    window.addEventListener("syncup-refresh-chat", wake);
    const fallback = window.setInterval(() => {
      if (navigator.onLine) void loadConversation(chatId, false);
    }, 30_000);
    return () => {
      source.close();
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
      window.clearInterval(fallback);
      window.removeEventListener("syncup-refresh-chat", wake);
    };
  }
// dependency array: [chatId, loadConversation, refreshInbox, user.id]
```

</details>

<details>
<summary>useEffect, source line 491; dependencies [chatId]</summary>

```tsx
() => {
    typingActive.current = false;
    lastTypingSent.current = 0;
  }
// dependency array: [chatId]
```

</details>

<details>
<summary>useEffect, source line 496; dependencies [chatId]</summary>

```tsx
() => {
    if (!chatId) return;
    let cancelled = false;
    loadDraft(chatId)
      .then((value) => {
        if (!cancelled) setDraft(value);
      })
      .catch((draftError: unknown) => {
        if (!cancelled)
          setError(
            draftError instanceof Error
              ? draftError.message
              : "Unable to restore your draft.",
          );
      });
    return () => {
      cancelled = true;
    };
  }
// dependency array: [chatId]
```

</details>

<details>
<summary>useEffect, source line 516; dependencies [chatId, draft]</summary>

```tsx
() => {
    if (!chatId) return;
    const timeout = window.setTimeout(() => {
      void saveDraft(chatId, draft).catch((draftError: unknown) => {
        setError(
          draftError instanceof Error
            ? draftError.message
            : "Unable to save your draft.",
        );
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }
// dependency array: [chatId, draft]
```

</details>

<details>
<summary>useEffect, source line 530; dependencies [chat, chatId, onQueued]</summary>

```tsx
() =>
      mediaV2UploadManager.subscribe((snapshots) => {
        setVideoSends(
          snapshots.filter(
            (item) => item.chatId === chatId && item.status !== "sent",
          ),
        );
        for (const item of snapshots) {
          if (item.status !== "sent") continue;
          if (
            sentV2AttachmentIds.current.has(item.attachmentId) ||
            processingV2AttachmentIds.current.has(item.attachmentId)
          ) {
            continue;
          }
          processingV2AttachmentIds.current.add(item.attachmentId);
          void import("../media/v2/jobStore").then(
            async ({ getMediaV2Job }) => {
              const job = await getMediaV2Job(item.jobId);
              if (!job?.keyEnvelope) return;
              const attachment: StagedAttachment = {
                id: job.attachmentId,
                filename: job.filename,
                content_type: job.contentType,
                size_bytes: job.plaintextSize,
                nonce: null,
                key_envelope: job.keyEnvelope,
                transport_version: 2,
                duration_ms: job.durationMs ?? null,
                waveform: job.waveform ?? null,
                width: job.width ?? null,
                height: job.height ?? null,
                poster_attachment_id: job.previewAttachment?.id ?? null,
                preview: job.previewAttachment ?? null,
              };
              if (job.sendOnComplete && job.messageIdempotencyKey) {
                const members =
                  job.chatId === chat?.id
                    ? chat.members
                    : (
                        await api<{ chat: { members: ChatMember[] } }>(
                          `/api/chats/${job.chatId}`,
                        )
                      ).chat.members;
                const attachments = [
                  attachment,
                  ...(job.mediaKind === "video" && job.previewAttachment
                    ? [job.previewAttachment]
                    : []),
                ];
                const encrypted = await encryptMessage("", members);
                const pendingMessage: PendingMessage = {
                  chatId: job.chatId,
                  localId: crypto.randomUUID(),
                  idempotencyKey: job.messageIdempotencyKey,
                  ...encrypted,
                  attachmentIds: attachments.map((item) => item.id),
                  attachments,
                  createdAt: new Date().toISOString(),
                  attempts: 0,
                  nextAttemptAt: 0,
                };
                await savePendingMessage(pendingMessage);
                const { patchMediaV2Job } = await import("../media/v2/jobStore");
                await patchMediaV2Job(job.id, { sendOnComplete: false });
                sentV2AttachmentIds.current.add(job.attachmentId);
                onQueued(pendingMessage);
                window.dispatchEvent(new Event("syncup-outbox-wake"));
                return;
              }
              if (job.chatId !== chatId) return;
              setStagedAttachments((current) => {
                const additions = [
                  attachment,
                  ...(job.mediaKind === "video" && job.previewAttachment
                    ? [job.previewAttachment]
                    : []),
                ].filter(
                  (candidate) =>
                    !current.some((item) => item.id === candidate.id),
                );
                return additions.length ? [...current, ...additions] : current;
              });
            },
          )
            .catch((queueError: unknown) => {
              setError(
                queueError instanceof Error
                  ? queueError.message
                  : "Unable to queue uploaded media.",
              );
            })
            .finally(() => {
              processingV2AttachmentIds.current.delete(item.attachmentId);
            });
        }
      })
// dependency array: [chat, chatId, onQueued]
```

</details>

<details>
<summary>useEffect, source line 814; dependencies [callIntent, chat, chatId, onCallIntentConsumed]</summary>

```tsx
() => {
    if (!callIntent || callIntent.chatId !== chatId || !chat || handledCallIntent.current === callIntent.id) return;
    handledCallIntent.current = callIntent.id;
    onCallIntentConsumed(callIntent.id);
    void startCall(callIntent.callType);
  }
// dependency array: [callIntent, chat, chatId, onCallIntentConsumed]
```

</details>

### features/messaging/MessageAttachment.tsx

<details>
<summary>useEffect, source line 65; dependencies [isVisualMedia, pending, visible]</summary>

```tsx
() => {
    if (!isVisualMedia || pending || visible) return;
    const element = hostRef.current;
    if (!element || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }
// dependency array: [isVisualMedia, pending, visible]
```

</details>

<details>
<summary>useEffect, source line 85; dependencies [attachment, attempt, isImage, isMediaV2, pending, visible]</summary>

```tsx
() => {
    if (
      pending ||
      isMediaV2 ||
      !isImage ||
      !visible ||
      !attachment.key_envelope
    )
      return;
    let cancelled = false;
    let objectUrl = "";
    setError("");
    hydrateAttachment(attachment)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((loadError: unknown) => {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to open this media.",
          );
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }
// dependency array: [attachment, attempt, isImage, isMediaV2, pending, visible]
```

</details>

<details>
<summary>useEffect, source line 117; dependencies []</summary>

```tsx
() => () => {
      if (videoPlaybackObjectUrl.current) {
        URL.revokeObjectURL(videoPlaybackObjectUrl.current);
      }
    }
// dependency array: []
```

</details>

<details>
<summary>useEffect, source line 126; dependencies [attachment.preview, isMediaV2, isVideo, pending]</summary>

```tsx
() => {
    if (!isMediaV2 || !isVideo || pending || !attachment.preview) return;
    let cancelled = false;
    let objectUrl = "";
    hydrateAttachment(attachment.preview)
      .then((file) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setVideoPosterUrl(objectUrl);
      })
      .catch((previewError: unknown) => {
        if (!cancelled) {
          setVideoPosterError(
            previewError instanceof Error
              ? previewError.message
              : "Unable to load this video preview.",
          );
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }
// dependency array: [attachment.preview, isMediaV2, isVideo, pending]
```

</details>

<details>
<summary>useEffect, source line 151; dependencies [attachment, isMediaV2, isVideo, pending]</summary>

```tsx
() => {
    if (!isMediaV2 || !isVideo || pending) return;
    let cancelled = false;
    hasCachedMediaV2Playback(attachment).then((cached) => {
      if (!cancelled && cached) setVideoReady(true);
    });
    return () => {
      cancelled = true;
    };
  }
// dependency array: [attachment, isMediaV2, isVideo, pending]
```

</details>

<details>
<summary>useEffect, source line 162; dependencies [attachment, isMediaV2, isVoice, pending, voiceAttempt]</summary>

```tsx
() => {
    if (!isMediaV2 || !isVoice || pending || voiceUrlRef.current) return;
    let cancelled = false;
    let objectUrl = "";
    const controller = new AbortController();
    setVoiceLoading(true);
    setError("");
    hydrateMediaV2(attachment, undefined, controller.signal)
      .then((file) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        voiceUrlRef.current = objectUrl;
        setVoiceUrl(objectUrl);
        setVoiceReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn’t load this voice note.");
      })
      .finally(() => {
        if (!cancelled) setVoiceLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        if (voiceUrlRef.current === objectUrl) voiceUrlRef.current = "";
      }
    };
  }
// dependency array: [attachment, isMediaV2, isVoice, pending, voiceAttempt]
```

</details>

### features/messaging/MessageComposer.tsx

<details>
<summary>useEffect, source line 47; dependencies [draft]</summary>

```tsx
() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
    textarea.style.overflowY = textarea.scrollHeight > 160 ? 'auto' : 'hidden'
  }
// dependency array: [draft]
```

</details>

### features/messaging/NewConversation.tsx

<details>
<summary>useEffect, source line 36; dependencies [mode, selectedUser, username]</summary>

```tsx
() => {
    const query = username.trim().replace(/^@/u, '').toLowerCase()
    if (selectedUser?.username === query) {
      return
    }
    if (mode !== 'direct' || query.length < 3 || !/^[a-z0-9_]+$/u.test(query)) {
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(({ users }) => setUsernameMatches(users))
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) {
            setUsernameMatches([])
            setSearchError(searchError instanceof Error ? searchError.message : 'Unable to search usernames.')
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchingUsers(false)
        })
    }, 300)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }
// dependency array: [mode, selectedUser, username]
```

</details>

### features/messaging/RequestsPanel.tsx

<details>
<summary>useEffect, source line 14; dependencies [requests]</summary>

```tsx
() => {
    let active = true
    Promise.all(requests.map(async (item) => {
      try {
        const text = await decryptMessage({
          bodyCiphertext: item.body_ciphertext,
          bodyNonce: item.body_nonce,
          keyEnvelope: item.key_envelope,
        })
        return [item.id, text] as const
      } catch {
        return [item.id, 'Encrypted message'] as const
      }
    })).then((entries) => {
      if (active) setPreviews(Object.fromEntries(entries))
    })
    return () => { active = false }
  }
// dependency array: [requests]
```

</details>

### features/messaging/SearchDialog.tsx

<details>
<summary>useEffect, source line 41; dependencies [value]</summary>

```tsx
() => {
    if (value.length < 2) {
      setSearching(false)
      setResults({ people: [], chats: [], privacy: '' })
      setError('')
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void api<SearchResults>(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then((response) => { setResults(response); setError('') })
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) setError(searchError instanceof Error ? searchError.message : 'Unable to search SyncUp.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, 250)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }
// dependency array: [value]
```

</details>

<details>
<summary>useEffect, source line 65; dependencies [onClose]</summary>

```tsx
() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }
// dependency array: [onClose]
```

</details>

### features/messaging/VoiceRecorder.tsx

<details>
<summary>useEffect, source line 11; dependencies []</summary>

```tsx
()=>()=>stopTracks()
// dependency array: []
```

</details>

<details>
<summary>useEffect, source line 34; dependencies [draft.url]</summary>

```tsx
()=>()=>URL.revokeObjectURL(draft.url)
// dependency array: [draft.url]
```

</details>

### features/spaces/SharedObjectCard.tsx

<details>
<summary>useEffect, source line 13; dependencies [object.my_response]</summary>

```tsx
() => setSelectedOptions(object.my_response?.optionIds ?? [])
// dependency array: [object.my_response]
```

</details>

### features/spaces/SpacesPage.tsx

<details>
<summary>useEffect, source line 209; dependencies [openTarget?.spaceId, openTarget?.channelId, openTarget?.messageId, space?.id]</summary>

```tsx
() => {
    if (!openTarget) return
    if (!space || space.id !== openTarget.spaceId) {
      void api<{ space: SpaceDetails }>(`/api/spaces/${openTarget.spaceId}`)
        .then(({ space: nextSpace }) => {
          setSpace(nextSpace)
          setChannelId(openTarget.channelId)
          setHistoryCursor(null)
          setHighlightedMessageId(openTarget.messageId)
        })
        .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to open this update.'))
      return
    }
    setHistoryCursor(null)
    setChannelId(openTarget.channelId)
    setHighlightedMessageId(openTarget.messageId)
  }
// dependency array: [openTarget?.spaceId, openTarget?.channelId, openTarget?.messageId, space?.id]
```

</details>

<details>
<summary>useEffect, source line 271; dependencies []</summary>

```tsx
() => {
    let active = true
    api<{ spaces: SpaceSummary[] }>('/api/spaces')
      .then(({ spaces: nextSpaces }) => { if (active) setSpaces(nextSpaces) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load Spaces.') })
    return () => { active = false }
  }
// dependency array: []
```

</details>

<details>
<summary>useEffect, source line 279; dependencies [space?.id]</summary>

```tsx
() => {
    if (!space?.id) return
    let active = true
    const refresh = () => api<{ space: SpaceDetails }>(`/api/spaces/${space.id}`)
      .then(({ space: nextSpace }) => { if (active) setSpace(nextSpace) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to refresh this Space.') })
    const timer = window.setInterval(() => { void refresh() }, 15_000)
    return () => { active = false; window.clearInterval(timer) }
  }
// dependency array: [space?.id]
```

</details>

<details>
<summary>useEffect, source line 289; dependencies [space?.id, channelId, activeChannel?.name, historyCursor]</summary>

```tsx
() => {
    if (!space || !channelId || space.channels.find((channel) => channel.id === channelId)?.type === 'voice') {
      setMessages([])
      return
    }
    setMentionNotice('')
    let active = true
    const beforeSeq = historyCursor?.channelId === channelId ? historyCursor.beforeSeq : null
    const path = `/api/spaces/${space.id}/channels/${channelId}/messages${beforeSeq ? `?before_seq=${encodeURIComponent(beforeSeq)}` : ''}`
    const refresh = async () => {
      try {
        const [messageResult, objectResult] = await Promise.all([
          api<{ messages: SpaceMessage[] }>(path),
          api<{ objects: SpaceSharedObject[] }>(`/api/spaces/${space.id}/channels/${channelId}/objects`),
        ])
        if (active) {
          setMessages(messageResult.messages)
          setSharedObjects(objectResult.objects)
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load channel messages.')
      }
    }
    void refresh()
    const stream = new EventSource(`/api/events?chat_id=${encodeURIComponent(channelId)}`)
    const refreshOnEvent = () => { void refresh() }
    const onMention = () => {
      if (active) setMentionNotice(`You were mentioned in #${space.channels.find((channel) => channel.id === channelId)?.name ?? 'channel'}.`)
      refreshOnEvent()
    }
    stream.addEventListener('channel.message', refreshOnEvent)
    stream.addEventListener('channel.object', refreshOnEvent)
    stream.addEventListener('channel.mention', onMention)
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => { active = false; window.clearInterval(timer); stream.close() }
  }
// dependency array: [space?.id, channelId, activeChannel?.name, historyCursor]
```

</details>

<details>
<summary>useEffect, source line 326; dependencies [legacyChannelId]</summary>

```tsx
() => {
    if (!legacyChannelId) return
    const controller = new AbortController()
    void api<{ messages: EncryptedChatMessage[]; hasMore: boolean }>(
      `/api/chats/${legacyChannelId}/messages?limit=50`,
      { signal: controller.signal },
    ).then(async ({ messages: encryptedMessages, hasMore }) => {
      const decoded = await decodeLegacyMessages(encryptedMessages)
      if (controller.signal.aborted) return
      setLegacyHistory({ channelId: legacyChannelId, messages: decoded, hasMore, loading: false, error: '' })
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setLegacyHistory({
        channelId: legacyChannelId,
        messages: [],
        hasMore: false,
        loading: false,
        error: loadError instanceof Error ? loadError.message : 'Unable to load encrypted group history.',
      })
    })
    return () => controller.abort()
  }
// dependency array: [legacyChannelId]
```

</details>

<details>
<summary>useEffect, source line 368; dependencies [messages]</summary>

```tsx
() => {
    messageEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }
// dependency array: [messages]
```

</details>

<details>
<summary>useEffect, source line 372; dependencies [messages, highlightedMessageId]</summary>

```tsx
() => {
    if (!highlightedMessageId) return
    const message = document.getElementById(`space-message-${highlightedMessageId}`)
    if (message) {
      message.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => setHighlightedMessageId(null), 4000)
    }
  }
// dependency array: [messages, highlightedMessageId]
```

</details>

### features/spaces/UpdatesPage.tsx

<details>
<summary>useEffect, source line 28; dependencies []</summary>

```tsx
() => {
    let active = true
    api<{ stacks: Stacks; activeCalls: ActiveCall[] }>('/api/spaces/updates')
      .then(({ stacks: result, activeCalls: calls }) => { if (active) { setStacks(result); setActiveCalls(calls) } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load Updates.') })
    return () => { active = false }
  }
// dependency array: []
```

</details>

### features/workspace/WorkspacePage.tsx

<details>
<summary>useEffect, source line 147; dependencies [activeCall]</summary>

```tsx
() => {
    if (activeCall) return
    let active = true
    const pollIncomingCalls = () => {
      Promise.all([
        api<{ calls: IncomingCall[] }>('/api/calls/incoming'),
        api<{ calls: IncomingCall[] }>('/api/group-calls/incoming'),
      ])
        .then(([direct, groups]) => {
          if (active) setIncomingCall([...direct.calls, ...groups.calls][0] ?? null)
        })
        .catch((loadError: unknown) => {
          if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to check incoming calls.')
        })
    }
    pollIncomingCalls()
    const interval = window.setInterval(pollIncomingCalls, 3000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }
// dependency array: [activeCall]
```

</details>

<details>
<summary>useEffect, source line 170; dependencies [flushOutbox, refreshInbox]</summary>

```tsx
() => {
    let active = true
    const initialLoad = window.setTimeout(() => {
      refreshInbox().catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load the inbox.')
      })
      listPendingMessages().then((items) => { if (active) setPending(items) })
        .catch((queueError: unknown) => { if (active) setError(queueError instanceof Error ? queueError.message : 'Unable to load pending messages.') })
    }, 0)
    const interval = window.setInterval(() => {
      refreshInbox().catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to refresh the inbox.')
      })
      void flushOutbox()
    }, 15_000)
    const wake = () => { void flushOutbox() }
    const updateOnline = () => { setOnline(navigator.onLine); if (navigator.onLine) void flushOutbox() }
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    window.addEventListener('syncup-outbox-wake', wake)
    return () => {
      active = false
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      window.removeEventListener('syncup-outbox-wake', wake)
    }
  }
// dependency array: [flushOutbox, refreshInbox]
```

</details>

<details>
<summary>useEffect, source line 200; dependencies [refreshInbox]</summary>

```tsx
() => {
    const closeChat = () => setActiveChatId(null)
    const refreshChat = () => { void refreshInbox() }
    window.addEventListener('syncup-close-chat', closeChat)
    window.addEventListener('syncup-refresh-chat', refreshChat)
    return () => {
      window.removeEventListener('syncup-close-chat', closeChat)
      window.removeEventListener('syncup-refresh-chat', refreshChat)
    }
  }
// dependency array: [refreshInbox]
```

</details>

<details>
<summary>useEffect, source line 211; dependencies [showCalls]</summary>

```tsx
() => {
    const adjustMobileCallsView = () => {
      if (showCalls && window.matchMedia('(max-width: 700px)').matches) setActiveChatId(null)
    }
    window.addEventListener('resize', adjustMobileCallsView)
    return () => window.removeEventListener('resize', adjustMobileCallsView)
  }
// dependency array: [showCalls]
```

</details>

<details>
<summary>useEffect, source line 219; dependencies []</summary>

```tsx
() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', openSearch)
    return () => window.removeEventListener('keydown', openSearch)
  }
// dependency array: []
```

</details>
