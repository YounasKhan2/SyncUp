# Phase 15 — Legacy CSS retirement and visual consistency

Base: `51aa9135f963faea55352ee27ae4c66ae229215c` · Branch: `design/syncup-visual-consistency-15`

This is a CSS-only consolidation. Production changes are limited to `client/src/shared/styles/platform.css`, `platform-shell.css`, and `primitives.css`. All TS/TSX, feature styles, tokens, Tailwind wiring, imports, packages, configuration, APIs, server and database sources remain byte-identical to base.

## Audit and retirement evidence

Reviewed all eight active stylesheets, semantic utility wiring, shared Button/IconButton/Avatar/Dialog/BrandMark contracts, and their production consumers. Existing semantic roles and theme initialization are retained. No new page stylesheet, token, primitive migration or specificity escalation was introduced.

- Retired old `.account-menu-button` (including hover/mobile child rule), `.avatar-small`, `.chevron` and `.inbox-empty` rules. Production TS/TSX string/template AST inventory finds no exact class producer. WorkspaceRail renders `profile-trigger`; InboxPane renders `inbox-empty-state` and `inbox-empty-*`, which never matched the old exact `.inbox-empty` selector. Avatar accepts consumer classes; its actual call sites do not supply the retired class. The source inventory includes conditional/template literals, rather than relying on stylesheet text search.
- Removed the first `.secondary-button` and disabled rules: every property is overwritten by a later identical selector at the same root context and specificity. The effective later declarations are retained.
- Removed obsolete Light declarations and Dark patches only where a later `:root:is([data-theme], :not([data-theme]))` rule targets the same selector/property with higher or equal specificity. This includes placeholder, message-fill/border, error/success, welcome text and muted-text declarations. Mixed rules without an all-selector proof remain intact. Border shorthands that still establish geometry remain intact.
- Removed the resulting empty 420px media block. No active breakpoint changed.

The checked-in [retirement record](../../tests/fixtures/consistency-retirement.json) contains 34 bounded decisions with deleted values and ownership records. Twenty rules were retired outright; nine primitive base rules moved; two semantic welcome rules were added. Net reduction: 18 rules and 24 lines across the three edited stylesheets.

## Ownership and semantic normalization

BrandMark's six base rules moved from platform-shell to primitives; Avatar's three base/image/fallback rules moved from platform to primitives. Their geometry remains unchanged. Avatar's base uses `:where(.avatar)` so the later stylesheet cannot override equal-specificity consumer variants such as the 29px welcome avatar. Contextual overrides remain feature/scoped rules. Image sizing, fallback visibility and overflow contracts remain intact.

Button label size and Avatar caption size now use the existing semantic roles with identical 12px/11px values. Button transition duration remains 150ms through `--ds-duration-normal`. Dialog uses existing semantic surface/border, 14px radius and modal elevation; its shadow loses the green tint. No control dimensions, layout hierarchy or copy changed. Account's scoped modal elevation and Updates' own styles already use semantic contracts, so neither receives a new visual treatment.

Media pending icons/text/progress/actions, voice surfaces/scrubber/recording states, and attachment progress now use brand, border, surface, hover, danger and warning roles. The progress angle variable, gradient structure, waveform geometry, duration, disabled states and animations are unchanged. The recording pulse uses danger-soft. The welcome identity card now uses surface/border and Plum avatar colors in both themes instead of the old green fill.

Existing focus contracts use semantic focus roles on the completed primary surfaces; no broad focus selector or `!important` was added. Destructive states retain their behavior and use existing danger roles. Three existing `!important` declarations across edited files remain unchanged.

## CSS measurements

LF-normalized source; lines exclude trailing whitespace; rules/declarations counted with PostCSS. Raw-color count means declarations containing a hex or rgb/rgba value, including retained exceptions.

| Stylesheet | Lines before → after | Rules | Declarations | Bytes | Raw-color declarations |
|---|---:|---:|---:|---:|---:|
| platform | 728 → 701 | 661 → 640 | 2573 → 2491 | 94124 → 91922 | 196 → 139 |
| platform-shell | 61 → 46 | 40 → 34 | 153 → 133 | 4685 → 4137 | 20 → 20 |
| primitives | 11 → 29 | 6 → 15 | 28 → 60 | 861 → 1840 | 1 → 0 |
| tokens | 281 → 281 | 3 → 3 | 267 → 267 | 10292 → 10292 | 81 → 81 |
| Tailwind wiring | 219 → 219 | 0 → 0 | 143 → 143 | 7205 → 7205 | 0 → 0 |
| Spaces | 557 → 557 | 473 → 473 | 1898 → 1898 | 72110 → 72110 | 15 → 15 |
| index | 23 → 23 | 6 → 6 | 18 → 18 | 762 → 762 | 0 → 0 |
| App imports | 4 → 4 | 0 → 0 | 0 → 0 | 168 → 168 | 0 → 0 |

Edited stylesheet total: 800 → 776 lines, 707 → 689 rules, 99670 → 97899 bytes. Raw-color declarations: 217 → 159. Reduction follows consumer/cascade evidence, not compression or artificial relocation.

## Standard visual review

Exactly **14 JPEG captures**, reviewed in the same in-app browser. Desktop 1440×900; mobile 390×844; host DPR 1.190000057. All captures show the expected effective theme and no horizontal document overflow. No pixel matrix, masks, tolerance gate or computed-style database was created.

| Coverage | Light | Dark |
|---|---|---|
| Desktop Auth | [Signup](screenshots-15/desktop-light-auth.jpg) | [Unlock](screenshots-15/desktop-dark-unlock.jpg) |
| Desktop Inbox + Conversation + Composer | [Focused draft](screenshots-15/desktop-light-messaging.jpg) | [Voice draft](screenshots-15/desktop-dark-messaging-voice.jpg) |
| Desktop Spaces | [Channel/shared items](screenshots-15/desktop-light-spaces.jpg) | [Channel/shared items](screenshots-15/desktop-dark-spaces.jpg) |
| Desktop Calls | [History](screenshots-15/desktop-light-calls-history.jpg) | [Audio call](screenshots-15/desktop-dark-calls-audio.jpg) |
| Mobile messaging | [Conversation](screenshots-15/mobile-light-messaging.jpg) | [Voice draft](screenshots-15/mobile-dark-messaging-voice.jpg) |
| Mobile Spaces | [Channel/shared items](screenshots-15/mobile-light-spaces.jpg) | [Channel/shared items](screenshots-15/mobile-dark-spaces.jpg) |
| Mobile Auth | [Signup](screenshots-15/mobile-light-auth.jpg) | [Unlock error](screenshots-15/mobile-dark-unlock-error.jpg) |

Primary surfaces remain Warm Stone + Plum; controls, text, scrolling and mobile navigation remain legible and unclipped. The composer focus ring and Unlock error were exercised with synthetic input. Account/Updates received no distinct consistency change, so no additional screenshots were generated.

System was spot-checked on the welcome surface with OS preference emulated **before CSS/module/theme initialization** using the existing bootstrap. `system + dark` resolves to dataset theme/color-scheme dark; `system + light` resolves to light. The welcome avatar remains approximately 29×29 CSS pixels in both, with the expected semantic palette. The actual report Dialog retains role/dialog, aria-modal, approximately 430px width and 14px radius with semantic elevation. [Review metadata](screenshots-15/review.json) records these bounded observations. No production theme persistence or listener changed.

## Regression and final gates

Four new focused guards verify production source freeze/exact CSS scope, retired class producers, CSS parsing/resolved semantic variables/ownership, and preserved media gradient/animation structure. A central exact-hash Phase 15 restoration bridge keeps historical phase baselines immutable; three old tests receive narrow read adaptations for relocated CSS. Historical suites were not rewritten or baselines regenerated.

| Gate | Final result |
|---|---|
| `npm run typecheck` | Pass, client and server |
| `npm test` | Pass, 290/290, including all historical visual guards |
| `npm run check:architecture` | Pass, 276 resolved import/export edges |
| `npm run build` | Pass, client and server |
| `npm run test:media-v2` | Pass, 11/11 |
| `npm run test:integration` | Pass, 1 suite; encrypted requests, delivery, pagination, media and authorized Calls assertions |
| `git diff --check` | Pass |

Full gates ran once against final production CSS. Only the failed unit gate was repeated: the initial 288/290 result exposed an old Avatar test reading its former stylesheet location and double restoration of the Calls/Auth baseline. Both fixes are test-only; the repeat passed 290/290. The earlier focused run passed 11/11. Existing build warnings remain: large client chunk and ineffective jobStore dynamic import.

## Retained exceptions, debt and limits

Shared profile/username/safety forms, search, requests, ChatDetails and generic dialog consumers remain active across features; their remaining legacy typography/palette and mixed Dark rules require a separately scoped review. Hidden workspace-footer JSX still owns a callback; its `display:none` rule remains, preventing accidental resurrection. Completed phase native geometry/scoped overrides still live in platform; this pass removes clear primitive ownership without inventing page CSS files.

Media aspect ratios, pixel waveform geometry, progress gradients, white/black video overlays, spinner/recording timing, safe-area handling and literal media-query breakpoints are technical exceptions. BrandMark corner shapes and welcome editorial typography remain intentional existing hierarchy. Tokens contain literal palette definitions by design. No attempt was made to reach zero literals.

This is representative fixture review, not exhaustive state/device or pixel-equivalence certification. Pending transport/error permutations are covered by existing characterization/source freeze and focused CSS guards, not new screenshots. Synthetic API/crypto/SDK boundaries do not certify live authentication, real-device recording, LiveKit transport or E2EE; the Calls preview explicitly reflects its synthetic security state. No production runtime change occurred. Stop for review; do not merge or begin Phase 16.
