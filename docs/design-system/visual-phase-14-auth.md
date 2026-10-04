# Visual Phase 14 — Auth / Unlock

Base: `90e5a8517f4e58dd8670a2d3e744809b0a031a3e`. Branch: `design/syncup-auth-14`.

## Actual scope and presentation

Production changes are limited to `client/src/shared/styles/platform-shell.css` and `client/src/shared/styles/platform.css`. Every production TS/TSX byte, field, validation attribute, callback, error string, auth API, router/session effect, crypto/key/bootstrap function, token, package, server and configuration remains unchanged.

Existing states are sign-up (also name/username onboarding), sign-in, device unlock, submitting, native field validation, server/unlock errors, session restoration and service-error retry. Sign-up creates the account and keys in its existing submit flow; there is no separate profile tour, recovery UI or onboarding step. Expired/missing sessions still enter the existing Auth screen. Unlock receives only `onUnlocked`, with no account identity prop; no name or identity lookup was invented.

The oversized two-column story/gradient/orbit presentation is replaced by a compact elevated auth panel on Warm Stone or aubergine/charcoal. The existing story is hidden through CSS; its markup/copy is unchanged. The existing small brand appears on desktop/mobile, followed by the form's product-level heading/hint. Forms use semantic labels, 44px fields and primary actions, restrained mode switching, wrapped danger alerts and visible keyboard focus. Mobile inputs use 16px text to avoid small-input zoom; the document remains naturally scrollable with no fixed form height. Unlock emphasizes the existing device heading, password hint and action without displaying the story's crypto internals.

Obsolete Auth-only rules were removed from both existing stylesheets, preserving the unowned parts of mixed selectors. Shared username, profile and error styles remain intact for Account and other dialogs. No production stylesheet or import was added.

| Stylesheet | Lines before → after | Rules before → after | LF bytes before → after |
|---|---:|---:|---:|
| `platform-shell.css` | 105 → 61 | 62 → 40 | 7,344 → 4,685 |
| `platform.css` | 712 → 728 | 643 → 661 | 90,175 → 94,124 |
| Total | **817 → 789** | **705 → 701** | **97,519 → 98,809** |

Line counts exclude trailing blank lines. Explicit scoped semantic fields, focus and mobile states account for the modest byte increase.

## Focused visual evidence

10 JPEG captures, no matrix or pixel-diff certification. Real AuthScreen, UnlockScreen, AppRouter, API and appearance helper render with isolated synthetic fetch and key boundaries. No real account/password/key is used. The fixture logs request paths only. Reproduce with `node tests/fixtures/auth-visual-preview.mjs`, then `http://127.0.0.1:5190/?scene=auth&theme=light`. Scenes: auth, error, busy, unlock, unlock-error, loading, service-error. Switch to sign-in with the actual mode button. Crypto/workspace aliases apply only to this preview build.

| Capture | Evidence |
|---|---|
| [Desktop Light sign-in](screenshots-14/desktop-light-sign-in.jpg) | Primary/secondary form hierarchy |
| [Desktop Dark sign-up](screenshots-14/desktop-dark-sign-up.jpg) | Name/username onboarding and Dark fields |
| [Mobile Light sign-up validation](screenshots-14/mobile-light-sign-up-validation.jpg) | Native required validation and focused field |
| [Mobile Dark sign-in error](screenshots-14/mobile-dark-sign-in-error.jpg) | Long synthetic backend error, existing alert |
| [Desktop Light unlock](screenshots-14/desktop-light-unlock.jpg) | Device heading, password hint and action |
| [Mobile Dark failed unlock](screenshots-14/mobile-dark-unlock-error.jpg) | Exact existing failed-unlock copy |
| [Desktop System/dark service error](screenshots-14/desktop-system-dark-service-error.jpg) | Existing retry screen |
| [Mobile System/light sign-in focus](screenshots-14/mobile-system-light-sign-in-focus.jpg) | Keyboard Tab reaches visible focused primary action |
| [Mobile Light restoration](screenshots-14/mobile-light-restoring-session.jpg) | Existing loading copy, unchanged timing |
| [Mobile Light submitting](screenshots-14/mobile-light-submitting.jpg) | Existing Please wait… disabled primary action |

Desktop is 1440×900; mobile 390×844 CSS pixels at the same host DPR (~1.19). The existing visual bootstrap emulates the requested OS color preference before CSS/modules initialize; the production appearance helper then applies Light/Dark/System. System/light Auth and System/dark service-error/Unlock were checked for effective `data-theme`, `data-appearance` and color scheme. No native OS preference or production appearance persistence was changed.

Mobile bounds: viewport/document width **390/390**, sign-up card x≈16/right≈373.92/bottom≈724.87px; primary action bottom≈619.10px, height≈44px. Brief 320×844 check: document width **320**, sign-up card x≈16/right≈304.18/bottom≈741.81px; submit remains visible at bottom≈619.10px. Long errors wrap; username prefix fits; required-field focus and keyboard primary-action focus remain visible.

Browser checks exercised actual mode switching, native required-field blocking, synthetic sign-up completion (`POST /api/auth/sign-up`), rejected unlock (existing alert), successful restored-session unlock (router reaches the fixture workspace boundary), pending submit disabling and focus. These prove presentation/control behavior with doubles, not live authentication.

## Regression and gates

Four new bounded guards cover CSS-only production scope, exact unowned CSS selectors/declarations/nesting/order, semantic/focus/mobile rules, and actual form validation/mode/loading/error/autocomplete/controlled-password props. The original 13 Auth/router characterizations cover exact sign-up/sign-in payload and key order, existing/missing key bootstrap, rejected unlock, successful unlock, restoration, expired sessions, service errors and cancellation. The existing real production crypto test uses Node WebCrypto for roundtrips and rejection of wrong password, tampering, wrong identity and locked access. All are included in `npm test`.

Historical visual contracts retain their original baselines. They restore only the hash-checked Phase 14 CSS before earlier-phase assertions, and explicitly include the two approved stylesheets in cumulative scope checks. The first unit run passed 285/286; the remaining historical Inbox allowlist omitted the newly edited `platform-shell.css`. Its correction is test-only; production CSS did not change. Only the failed unit gate was rerun.

| Final gate | Result |
|---|---|
| `npm run typecheck` | PASS client/server |
| `npm test` | PASS **286/286**, zero skipped on the corrected rerun |
| `npm run check:architecture` | PASS **276** resolved edges |
| `npm run build` | PASS client/server; existing chunk-size and ineffective dynamic-import warnings |
| `npm run test:media-v2` | PASS **11/11** |
| `npm run test:integration` | PASS **1/1** composite suite |
| `git diff --check` | PASS |

## Limits

Visual fixtures do not manually certify live credentials, session cookies/refresh, real browser key persistence, crypto or account provisioning. Those implementations remain frozen and have existing unit/crypto/integration coverage. A physical mobile keyboard, mobile autofill, screen reader and IME were not exercised. The existing Unlock component exposes no account name; adding identity data would require a separately scoped change. Existing copy, including the restoration question mark and backend/security errors, is unchanged.

Do not merge without review. Phase 15 was not started.
