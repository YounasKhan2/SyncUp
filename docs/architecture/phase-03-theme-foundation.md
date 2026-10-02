# Phase 3 — Theme foundation v1

Base main: `05c0de1306357f15afbf2cd9c5066eecda3969f7`. Branch: `design/syncup-theme-foundation-v1`.
Clean baseline passed typecheck, 36 tests, architecture (242 edges), and client/server build without heap overrides. No OOM recurred.

## Implemented semantic palette

All approved foundation values are preserved. Typography, dimensions, spacing, responsive rules, and feature placement are unchanged.

| Role / `--color-` suffix | Light | Dark |
| --- | --- | --- |
| bg-app | #F5F2EE | #17151A |
| bg-navigation | #EEEAE5 | #1D1A20 |
| bg-surface | #FAF8F5 | #211E24 |
| bg-elevated | #FFFCF8 | #29252C |
| bg-hover | #E9E4E0 | #302B33 |
| border | #D9D2CD | #3D3741 |
| border-strong | secondary text | secondary text |
| text-primary | #272228 | #F1ECEF |
| text-secondary | #6F676D | #B7ADB4 |
| text-muted | #8C8389 | #8F858D |
| primary | #76546F | #C99ABD |
| primary-hover | #64465E | #D6A9CA |
| primary-soft | #EADDE6 | #3C2C38 |
| on-primary | #FFFCF8 | #272228 |
| selected | #E7DCE3 | #352A33 |
| focus-ring | #98728F | #D5A7C9 |
| message-incoming | #ECE7E3 | #29262B |
| message-outgoing | #DED0D9 | #4A3545 |
| success | #35745A | #67C79B |
| warning | #A7682A | #E6AC65 |
| danger | #B34D55 | #ED858D |
| info | #536F91 | #83ACD8 |
| overlay | rgb(39 34 40 / 45%) | rgb(23 21 26 / 70%) |
| success-soft, warning-soft, danger-soft, info-soft | `color-mix(in srgb, var(--color-<state>) 10%, var(--color-bg-surface))` | same formula with Dark values |

Legacy brand/brand-accent → primary; brand-strong → primary-hover; brand-soft → primary-soft; canvas → bg-app; surface → bg-surface; surface-subtle → bg-navigation; surface-muted → bg-hover; text → text-primary; focus → focus-ring. Existing token-based consumers retain compatibility.

The old `text-muted` consumers were small labels/body metadata. Their CSS references now use `text-secondary` so the reserved approved muted value does not silently reduce accessibility. No current platform CSS consumer uses `var(--color-text-muted)`.

## Lifecycle and scope

Previously main applied the preference once, while Workspace owned the media-query change listener. Bootstrap now calls `startAppearanceLifecycle`, which applies the persisted preference and listens for system changes regardless of Auth/Unlock/Workspace state. Explicit Light/Dark remain fixed; System resolves the media query and responds to changes. Root `data-appearance`, `data-theme`, inline `colorScheme`, and CSS pre-JS system fallback remain. `syncup-appearance` is unchanged. Failed storage reads fall back to System; writes retain their existing behavior. Vite HMR disposes the listener. Workspace's appearance controls still save and apply the choice; only its theme effect was removed.

Cross-tab UI synchronization and explicit-preference pre-JS flash are not solved here. No auth/session/account lifecycle moved. Media startup is unchanged.

Changed files: tokens.css (palette/aliases), platform.css (visual roles), index.css (canvas/selection/focus), appearance.ts (theme lifecycle/read fallback), main.tsx (theme bootstrap/HMR cleanup), WorkspacePage.tsx (remove only theme listener), theme-lifecycle.test.mjs (five lifecycle tests), tests/fixtures/theme-preview.html and .tsx (isolated visual preview), and this report. Runtime TypeScript changes are limited to appearance handling; fixtures are outside production includes/build entry points.

Migrated areas: app/body canvas; Auth/Unlock story, labels, fields, placeholders and branding; rail/inbox/mobile navigation; conversation header/composer; main/elevated surfaces; primary actions and disabled send; selected/hover/focus treatments; message fills/text/timestamps/links; reply quote; error/success treatments; account form surfaces; representative Spaces sidebar/header/selected channel. The final color-only slice has matching theme specificity to supersede legacy dark patches without reordering existing selectors. Existing CSS is identical to baseline after reversing the documented token substitutions, logo colors, and two malformed background corrections. Added declarations are only color, background, border-color, box-shadow, accent-color, and text-decoration.

Incoming/outgoing alignment, grouping, reactions, menus, attachments, replies, edits/deletion, receipt logic and encryption are unchanged. Timestamps inside bubbles use primary text because secondary fails normal-text contrast on Light message fills.

## Invalid declarations corrected

Two occurrences of `background: var(--color-surface)7f4` were invalid: `.form-error` and `.list-error, .inline-error`. Both now use `--color-danger-soft`. Error copy uses primary text with a danger border and soft danger background; error meaning still appears through textual messages. No unrelated CSS cleanup occurred.

## Contrast measurements

Ratios use sRGB linearized relative luminance, `(Lighter + .05) / (Darker + .05)`, rounded to two decimals. Normal text threshold is 4.5:1; focus indicator/background threshold is 3:1. These measurements cover the listed pairs, not every legacy selector or a complete WCAG audit.

| Foreground | Background | Ratio | Intended use | Result |
| --- | --- | ---: | --- | --- |
| #272228 | #F5F2EE | 13.98 | Light primary / canvas | Pass |
| #272228 | #FAF8F5 | 14.72 | Light primary / surface | Pass |
| #6F676D | #FAF8F5 | 5.16 | Light small secondary | Pass |
| #8C8389 | #FAF8F5 | 3.46 | Reserved muted, small text | Fail; not used for small text |
| #FFFCF8 | #76546F | 6.28 | Light primary action text | Pass |
| #B34D55 | #FAF8F5 | 4.82 | Light danger / surface | Pass |
| #35745A | #FAF8F5 | 5.22 | Light success / surface | Pass |
| #98728F | #F5F2EE | 3.66 | Light focus / canvas | Pass at 3:1 |
| #98728F | #FAF8F5 | 3.86 | Light focus / surface | Pass at 3:1 |
| #272228 | #ECE7E3 | 12.71 | Light incoming text | Pass |
| #272228 | #DED0D9 | 10.50 | Light outgoing text | Pass |
| #F1ECEF | #17151A | 15.52 | Dark primary / canvas | Pass |
| #F1ECEF | #211E24 | 14.10 | Dark primary / surface | Pass |
| #B7ADB4 | #211E24 | 7.56 | Dark small secondary | Pass |
| #8F858D | #211E24 | 4.63 | Dark muted / main surface | Pass for this pair; currently reserved |
| #8F858D | #29252C | 4.23 | Dark muted / elevated, small text | Fail; not used for small text |
| #272228 | #C99ABD | 6.57 | Dark primary action text | Pass |
| #ED858D | #211E24 | 6.54 | Dark danger / surface | Pass |
| #67C79B | #211E24 | 8.01 | Dark success / surface | Pass |
| #D5A7C9 | #211E24 | 7.99 | Dark focus / surface | Pass at 3:1 |
| #F1ECEF | #29262B | 12.79 | Dark incoming text | Pass |
| #F1ECEF | #4A3545 | 9.53 | Dark outgoing text | Pass |
| #A7682A | #FAF8F5 | 4.25 | Light warning, small text | Fail; no new small-text use |

Additional observed limits: Light secondary on incoming is 4.46:1 and outgoing 3.68:1. Bubble timestamps therefore use primary text. Light danger text on a 10% danger-soft surface would fall below 4.5:1; error copy uses primary instead. No approved value changed. Small Light warning labels should use primary text with warning icon/border; changing the warning palette requires separate review. The warning token remains available for appropriate large/nontext use (3:1). Dark muted also remains reserved on elevated surfaces.

## Visual evidence and limitations

The actual app booted locally and reached service-unavailable because an isolated backend was not running. No login, account creation, real credentials, message send, or DB integration was attempted.

The test-only preview renders the real AuthScreen, UnlockScreen and WorkspaceRail; inbox/conversation/messages/composer/account/Spaces are representative CSS fixtures, not authenticated feature flows. Preview fetch always rejects, ensuring no backend calls. Use Vite's `/@fs/<absolute repository path>/tests/fixtures/theme-preview.html` with the existing client dev server to reproduce it; it is not a production navigation route.

Actually inspected: Light/Dark Auth at 1440×900; Light/Dark shell/message/composer fixtures at desktop; Light/Dark account settings fixture at desktop; Light/Dark Unlock at 390×844; Light/Dark Spaces fixture at 900×900. Checked selected, disabled send, error, success, and keyboard focus (Tab from Unlock password to action). System was selected in-browser and resolved to Light; both directions of OS change and explicit-mode stability are covered by isolated lifecycle tests, not actual OS appearance changes. Hover declarations were inspected, but dedicated pointer-hover visual verification is outstanding. Fixture markup is deliberately incomplete, so full responsive feature navigation and mobile Spaces safety remain manual. No pixel-perfect or full-app accessibility verification is claimed.

Screenshots were saved outside the repository in the task visualization directory, including theme-light-auth.png, theme-dark-auth.png, theme-light-shell.png, theme-light-settings.png, theme-dark-settings.png, theme-light-mobile-unlock-focus.png, theme-light-tablet-spaces.png, and theme-dark-tablet-spaces.png. They are local review artifacts, not build inputs.

## Remaining debt and preservation

platform.css retains 678 literal color occurrences (hex plus rgb/rgba calls) and 332 explicit `:root[data-theme="dark"]` selector occurrences. Counts include shadow/overlay colors, retained declarations superseded by the new slice, and feature-specific colors; they are not counts of unique colors or unresolved visible defects. Legacy Calls/LiveKit controls, voice recording/playback, attachment/media states, advanced Spaces permissions/settings/discovery/shared objects/mentions, emoji internals, reaction/read receipt accents, some account/security subpanels and decorative shadows remain. The PR intentionally does not split CSS or introduce UI primitives.

No functional/domain behavior changed. Auth/session, API, DB/schema/migrations, crypto, messaging/outbox, Calls, media, Spaces permissions, realtime, polling/retry, and navigation/domain logic are unchanged. All Phase 2 findings remain unfixed.

Final typecheck, full tests (41 passed, including unchanged 19 Phase 2 tests and five new theme lifecycle tests; zero failed/skipped), architecture (242 edges) and client/server build passed after final CSS review. Working and staged diff checks passed. Existing large LiveKit chunk and ineffective jobStore dynamic-import warnings remain. No heap overrides, dependency additions or changed behavioral expectations. Database integration, authenticated visual flows, real OS switching and full manual responsive/accessibility review were not executed.

Stop after opening the Phase 3 PR. Do not merge, begin Phase 4, or decompose features.
