# Visual Phase 13 — Calls

Base: `8df5b5f9d00c9a1ae22c136c866bceec4978ee78`. Branch: `design/syncup-calls-13`.

## Scope and actual surfaces

The only production change is `client/src/shared/styles/platform.css`. Every production TS/TSX byte, API, server, package, token and configuration remains unchanged. A guard compares the complete production diff to this one-file allowance and the approved CSS hash. Another compares all unowned CSS selectors, declarations, nesting and order against base, including Conversation's `.call-history-message`, Spaces and Shell.

Existing surfaces: workspace Calls history and landing invitation; direct/group incoming banner; active direct audio/video, group participants/roster and Space voice room; connecting/waiting, mic/camera state, connection failures and terminal Close. History already shows direction, missed/declined/completed/ringing/active status, timestamps and completed-call duration. There is no separate history loading presentation, active elapsed timer, device picker or reconnect button. No features were added.

History uses compact separated rows, semantic avatars/status and callback actions; unusually long names/status wrap rather than overflow. Incoming identity/type and Answer/Decline are distinct. Active calls use a restrained charcoal media stage, readable participant hierarchy, pressed controls, visible keyboard focus and semantic danger End/Leave/Decline. Light/Dark use existing semantic tokens, including `light-dark()` for the immersive stage. No new production raw palette values.

The mobile compression cause was the desktop `.calls-home { display: grid; grid-column: 3 }` rule occurring after an equal-specificity mobile hide. A final Calls-only mobile rule hides it and assigns the Calls history pane to the full first column. Overlay margins are 12px on mobile; controls wrap with 44px minimum heights. Empty/error history flexes within the available pane without unnecessary scrolling. Unrelated Inbox instances are excluded via `.inbox-pane:not(.inbox-content)`.

CSS statistics (LF-normalized, trailing blank lines excluded for line count): **738 → 712 lines**, **648 → 643 rules**, **88,212 → 90,175 bytes**. Obsolete Calls rules and theme overrides were replaced in the existing stylesheet; no production stylesheet or import was added. The byte increase reflects semantic declarations and explicit responsive states, not a separate migration framework.

## Focused visual evidence

12 retained JPEG screenshots; no matrix or pixel-diff certification. Real production components/effects render through a verification-only SDK/HTTP/worker double. Video posters explicitly identify synthetic local/remote media. No fixture controls or overlays appear in captures. Preview: `node tests/fixtures/calls-visual-preview.mjs`, then `http://127.0.0.1:5189/?scene=history&theme=light`; supported scenes are history, empty, incoming, waiting, audio, video, group, voice and error. The SDK alias is confined to this preview build.

Theme is installed before CSS/module initialization using the existing visual bootstrap, then applied with the production appearance helper. Effective `data-theme` was checked in Light/Dark. Desktop is 1440×900 and mobile 390×844 CSS pixels at the same host DPR (~1.19).

| Capture | Evidence |
|---|---|
| [Desktop Light history](screenshots-13/desktop-light-history.jpg) | History, duration, disabled ongoing callback, audio/video invitation |
| [Desktop Dark history](screenshots-13/desktop-dark-history.jpg) | Dark semantic surfaces and status contrast |
| [Mobile Light history](screenshots-13/mobile-light-history.jpg) | Full-width history and long name |
| [Mobile Dark history](screenshots-13/mobile-dark-history.jpg) | Dark mobile pane and navigation |
| [Mobile incoming](screenshots-13/mobile-light-incoming.jpg) | Long caller, video type, Answer/Decline |
| [Mobile waiting](screenshots-13/mobile-light-waiting.jpg) | Outgoing wait and End call |
| [Desktop audio](screenshots-13/desktop-light-audio.jpg) | Joined participant, camera-off state |
| [Desktop video](screenshots-13/desktop-light-video.jpg) | Synthetic remote media and local tile |
| [Mobile video controls](screenshots-13/mobile-light-video-controls.jpg) | Muted/camera-off pressed states, End call |
| [Desktop Dark group](screenshots-13/desktop-dark-group.jpg) | Joined/ringing roster, muted participant, Leave room |
| [Mobile Dark Space voice](screenshots-13/mobile-dark-voice.jpg) | Local/remote/listening-only participants, Leave room |
| [Mobile empty/error](screenshots-13/mobile-light-empty-error.jpg) | Existing error and empty state with Start a call |

Read-only bounds checks: mobile viewport/document width **390/390**, CallsHome `display:none`, pane width **389.92px** (host fractional-DPR rounding). Voice dialog x≈12px, right≈377.91px, footer bottom≈830.86px within 844px; stage content fits. Empty/error list client/scroll height **724/724px**. Brief 320×844 check: document width **320**, dialog x≈12px/right≈308.18px, three controls wrap onto two rows with 44px heights; footer remains inside viewport. Connection-failure DOM shows the existing error and disabled Mute; no new retry behavior.

Browser interactions verified history open/repeat with original chat ID and audio/video type; Start new/Audio/Video callbacks; incoming Answer/Decline; mute/unmute and camera off/on labels/pressed state; End and voice Leave callback forwarding. Fixture callbacks record intent and do not terminate a real call.

## Regression and final gates

Added only three CSS/scope guards and two focused handler characterizations. The Calls suite now has seven tests: device setters and failed-toggle state; End/Leave/terminal Close and listen-only disabled state; direct token/connect/publication cleanup; exact Space voice token/roster paths and no-publish policy; unsupported group encryption fail-closed/key zeroing; group connection-failure worker/key teardown; immediate/4000ms terminal status cleanup. All pass. Existing workspace history/date/order/avatar/callback, incoming/home, Conversation call-start, group crypto and Spaces voice-payload tests also pass as part of `npm test`. Historical visual contracts retain their original baselines and accept only the exact approved Phase 13 CSS before restoring prior-phase views.

Final gates ran once on the final production CSS:

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS client and server |
| `npm test` | PASS **282/282**, zero skipped |
| `npm run check:architecture` | PASS **276** resolved edges |
| `npm run build` | PASS client and server; existing >500kB chunk and ineffective dynamic-import warnings |
| `npm run test:media-v2` | PASS **11/11** |
| `npm run test:integration` | PASS **1/1** composite suite, including direct lifecycle/token/history and group ringing/encrypted-key authorization/decline/end/teardown |
| `git diff --check` | PASS |

## Limits

Synthetic visual calls do not manually certify microphones/cameras, device permissions, real audio/video delivery, network reconnect, multi-device participants or encrypted frames/worker delivery. Existing tests protect these boundaries with doubles or server integration; this is not live WebRTC/E2EE certification. Existing security wording is unchanged, including the broad encrypted-call invitation on CallsHome and the explicit non-E2EE direct/Space voice labels in CallWindow; reconciling that existing wording is outside this presentation-only phase. No runtime defect was repaired or inferred from synthetic connectivity.

Do not merge without review. Phase 14 Auth/Unlock was not started.
