# Visual Phase 09 — Composer

Base: `346c0698aadb1f933ed7cce1eefdf5423e579c16`. Branch: `design/syncup-composer-09`.

Production files: `client/src/features/messaging/MessageComposer.tsx` and `client/src/shared/styles/platform.css` only.

The composer uses the existing Warm Stone/Plum surfaces, modest radius and border, semantic body/label type, and a clear brand send action. Attachment, emoji and voice triggers form a restrained 40px control family with visible keyboard focus. The reply strip follows Conversation's Plum-edge treatment; selected filenames wrap while keeping removal reachable. Voice preview/recording colors are normalized through composer-scoped CSS, without changing the recorder, waveform, timer or lifecycle. No token, package, configuration, API or architecture changes. No new send or error state was invented; the existing Preparing… and disabled rules remain.

`platform.css`: **1,104 → 990 lines (114 removed)**. Replaced composer-owned rules and dark/mobile overrides are removed. Shared sent-voice and attachment selectors, Conversation/Inbox and every other screen's declarations/cascade remain exact. TSX changes are classes only; all handlers, state/effects, draft/typing, Enter/Shift+Enter, reply, file input, emoji insertion and disabled conditions retain exact AST identity. Three focused tests protect those contracts; historical guards accept only pinned Phase 09 source hashes.

Seven saved screenshots, eight captures total including one preliminary inspection, manually inspected:

- [Desktop Light, 1440×900](screenshots-09/desktop-light.jpg)
- [Desktop Dark voice preview, 1440×900](screenshots-09/desktop-dark-voice.jpg)
- [Mobile Light reply, 390×844](screenshots-09/mobile-light-reply.jpg)
- [Mobile Dark selected file, 390×844](screenshots-09/mobile-dark-media.jpg)
- [Mobile long text / focus](screenshots-09/mobile-light-long-focus.jpg)
- [Existing emoji picker](screenshots-09/mobile-light-emoji.jpg)
- [Narrow Dark selected file, 320×844](screenshots-09/narrow-dark-media.jpg)

Effective Light/Dark and loaded fonts were verified. No horizontal page overflow at inspected sizes. Long drafts reach the unchanged 160px limit and scroll. Local fixture interactions verified Enter send, Shift+Enter newline, reply cancellation, file removal, emoji insertion/focus restoration and voice-preview deletion. Preparing disables attachment/voice/send. Messages scroll in their own remaining area and the composer stays above mobile navigation.

Verification: typecheck passed; **268/268 tests**, zero skips; architecture passed with **zero violations**, 276 resolved edges; client/server build passed with existing chunk-size/mixed-import warnings; **Media V2 11/11** and **real integration 1/1**, zero skips, run once each. Integration covers ordered/idempotent delivery, read/reactions, backward pagination, encrypted object-storage attachments and calls. `git diff --check` passed.

Limitations: the network-disabled plaintext fixture uses real components with local callbacks and seeded file/voice metadata. It does not manually certify upload/encryption, physical microphone recording/audio playback, or an operating-system mobile keyboard. Existing characterization and real integration carry runtime contracts. FullEmojiPicker and VoiceRecorder source are unchanged. No exhaustive visual matrix, pixel certification, style database or evidence archive.

Stop for ChatGPT review. Do not merge or begin the next visual phase.
