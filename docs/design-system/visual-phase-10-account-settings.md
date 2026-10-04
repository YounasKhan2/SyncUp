# Visual Phase 10 — Account & Settings

Base: `0b34a98e87e0714855a12ece8e3010192b3f0c8a`. Branch: `design/syncup-account-settings-10`.

The actual Account surface is a dialog containing profile/photo editing, display name, username, About, discoverability, read receipts, Light/Dark/System appearance, readonly email, active sessions, and Safety & privacy (block/unblock/report). No password, notification or deletion settings exist here; none were invented. Existing section/field order is preserved.

Production changes: `AccountPanel.tsx`, `components/AccountSessionsSection.tsx`, `SafetySettings.tsx` under `client/src/features/account/`, and `client/src/shared/styles/platform.css` only. TSX changes are classes only. The complete handler/state/effect/ARIA/label/field-validation AST is unchanged, including profile/avatar/session/privacy/theme behavior. Tokens, API, shared primitives, storage and other features remain frozen.

Presentation now uses compact Warm Stone/Plum surfaces and forms, restrained borders, semantic type, clear save priority, visible focus, and danger treatment for revoke/remove-photo/block. Sessions use rows instead of cards; device names wrap so “This device” remains visible on narrow screens. Shared dialog/profile/safety/username selectors exclude only marked Account instances with zero-specificity `:where`; other consumers keep identical declarations, nesting and cascade order.

`platform.css`: **990 → 928 lines (62 removed)**. Three focused tests protect behavior, ownership and semantic controls; historical guards accept only exact recorded Phase 10 source hashes.

Six saved screenshots, eight captures total including two preliminary inspections, manually inspected:

- [Desktop Light save success / sessions, 1440×900](screenshots-10/desktop-light.jpg)
- [Desktop Dark profile, 1440×900](screenshots-10/desktop-dark.jpg)
- [Mobile Light profile, 390×844](screenshots-10/mobile-light.jpg)
- [Mobile Dark sessions / safety / focus, 390×844](screenshots-10/mobile-dark-safety.jpg)
- [Mobile profile/session errors](screenshots-10/mobile-light-errors.jpg)
- [Narrow Dark sessions, 320×844](screenshots-10/narrow-dark-sessions.jpg)

Effective themes and loaded fonts were checked. No horizontal document/dialog overflow at inspected sizes. Local fixture checks exercised profile save/success/error, appearance selection including stabilized System preference, current-session identification, refresh/revoke, readonly email, privacy defaults and closing.

Verification: typecheck passed; **271/271 tests**, zero skips; architecture passed with **zero violations**, 276 resolved edges; client/server build passed with existing chunk-size/mixed-import warnings; **Media V2 11/11** and **real integration 1/1**, zero skips; `git diff --check` passed. The first test run exposed one historical child-class comparison; its loader now uses the exact hash-pinned restore, and only the test gate was rerun. All other gates, including Media V2/integration, ran once.

Limitations: actual Account modules run against synthetic, local API responses; no real account/session was changed. Avatar uploads, server persistence, live privacy enforcement and OS mobile keyboards were not manually certified. Existing characterization/integration carry runtime coverage. No information-architecture rewrite, form-system refactor, exhaustive matrix or pixel certification.

Stop for ChatGPT review. Do not merge or begin Phase 11.
