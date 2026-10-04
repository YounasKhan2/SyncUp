# Visual Phase 08 — Conversation

Base: `1cf130ed5ff675b3c1de7d57f14cffe6ecb6a981`. Branch: `design/syncup-conversation-08`.

Production files:
- `client/src/features/messaging/components/ConversationHeader.tsx`
- `client/src/features/messaging/MessageList.tsx`
- `client/src/shared/styles/platform.css`

Warm Stone/Plum now owns the reading canvas, incoming/outgoing bubbles, header identity and actions, sender labels, metadata, replies, reactions and call-history system messages. Header actions retain their native callbacks/labels with 44px targets. Avatar behavior is unchanged. Bubbles use modest semantic radii, no shadow, readable body type, and timestamps/receipts in normal flow to avoid text overlap. Reactions sit 4px below their own bubble. Existing inline actions remain associated with the same message and retain hover/keyboard/mobile visibility.

There is no existing date/unread separator or three-dot menu branch; none was invented. Typing remains the existing header subtitle. Composer, pickers, attachment/upload controls, Inbox, navigation and Calls screens are unchanged. Spaces retains its shared legacy reaction styles through a zero-specificity `:not(:where(.conversation-reactions))` exclusion of only Conversation instances. Upload placeholder bubble and ancestor styles remain at their original cascade positions; new geometry excludes pending media rows and bubbles. No token, package, architecture, API, encryption, realtime, pagination, draft, outbox or persistence change.

CSS: **1,183 → 1,104 lines (−79)**. Replaced Conversation legacy geometry/palette/type and redundant dark/mobile overrides were removed. Remaining geometry stays in the existing stylesheet; colors/type primarily use semantic utilities. Three focused tests cover class-only AST behavior, unowned CSS/Spaces contracts, and in-flow metadata/reaction attachment. Historical guards admit only the exact recorded Phase 08 sources.

Six saved screenshots (plus three transient inspection views; nine captures total), manually inspected:

| Surface | Light | Dark |
| --- | --- | --- |
| Desktop 1440×900 | [Light](screenshots-08/desktop-light.jpg) | [Dark](screenshots-08/desktop-dark.jpg) |
| Mobile 390×844 | [Light](screenshots-08/mobile-light.jpg) | [Dark](screenshots-08/mobile-dark.jpg) |

[Keyboard contextual action](screenshots-08/desktop-light-focus.jpg) · [Mobile long message / typing / scroll](screenshots-08/mobile-dark-long.jpg).

No horizontal document overflow at either viewport. Replies/Unicode wrap, receipts fit, focus is visible, reactions attach correctly, and the unchanged composer coexists with scrolling. Fixture interactions verified selection/back/reopen, reaction toggling, reply jump, local reply send, chronological order and native PageDown scrolling. Sample body/timestamp contrasts on incoming/outgoing surfaces: Light **12.71/10.50:1**, Dark **12.79/9.53:1**; not a whole-product accessibility certification.

Verification: typecheck passed; **265/265 tests**, zero skips; architecture passed with **zero violations** (276 resolved edges); client/server build passed with existing chunk-size/mixed-import warnings; **Media V2 11/11** and **real integration 1/1**, zero skips, each run once as final gates. Integration includes ordered/idempotent delivery, read/reaction paths, backward pagination and encrypted attachments. `git diff --check` passed.

Limitations: this is a plaintext, network-disabled presentation fixture using real components; it does not manually certify live encrypted/realtime messaging. Existing runtime characterization and real integration carry those contracts. No exhaustive breakpoint/theme matrix, computed-style database, pixel certification or evidence archive was created. Media/voice/upload workflows and the composer were not visually redesigned or manually exercised here.

PR/HEAD are reported in the PR and completion response. Do not merge automatically. Stop for ChatGPT review; Composer Phase 09 is not started.
