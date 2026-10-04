# Visual Phase 12 — Spaces

Base: `be72e8778e9fcb823959e9f7f287eadf0e8b254f` · Branch: `design/syncup-spaces-12`

## Actual surface

Spaces has an overview with inline Space creation and a Space list; selected Space identity, collapsible categories and text/announcement/private/voice channels; channel header, search/files, messages/mentions, decision pinning and a composer with mention/shared-item menus. Polls, events, checklists and decisions use the same renderer as Updates. Settings expose overview, people/invites, guest channel grants and role permissions with fixed owner/admin access. Channel/category/shared-item creation dialogs already exist. Voice provides a welcome/join surface that delegates the call payload to the parent; in-call controls belong to the existing call runtime.

Existing empty/no-channel, error, busy/disabled and encrypted-history loading/pagination states are preserved. There is no channel unread badge in this presentation. Space refresh is 15 seconds; channel messages/objects use SSE plus a 5-second refresh. These effects, permission fallbacks, IDs, routes, messaging, membership and authorization were not changed.

## Production scope

Only two existing stylesheets changed:

- `client/src/features/spaces/spaces.css`: semantic Warm Stone/Plum presentation, compact 232px desktop navigation, selected rows, readable channel metadata, composer, shared items, settings/permissions and creation controls. Mobile uses a 124px channel rail, readable Space identity and wrapping header actions. Guest grant checkboxes keep compact native dimensions.
- `client/src/shared/styles/platform.css`: remove obsolete Spaces-only Dark overrides and relocate responsive/discovery rules into the feature owner. Mixed selectors retain their unowned portions.

Every Spaces TS/TSX source file remains byte-identical, including SharedObjectCard, Updates and extracted dialogs/views. Shared-item defaults remain exact; Spaces normalization is scoped beneath `.spaces-page .space-channel-view`. Updates CSS, Shell placement, direct group-upgrade presentation, other screens, tokens, packages and configuration are unchanged.

CSS line counts (LF split, including final empty line): platform **911 → 739 (−172)**; Spaces **301 → 558 (+257)**. Combined +85 lines reflect relocated rules plus semantic/scoped refinements. No new production stylesheet.

## Focused evidence

Three new tests protect CSS-only production scope/all source bytes, exact unowned CSS declarations/order/nesting and existing semantic tokens/focus/ownership. Historical visual guards restore only the exact approved Phase 12 hashes before checking their unchanged baselines; no baseline was regenerated.

Existing focused Spaces suite: **48/48 pass, no skips**. It covers permission initialization/fallback, View → Send/Speak dependencies, saves, role gating, routing, creation, shared-object callbacks, polling/SSE cleanup, legacy history and voice payloads. Final unit tests also rerun these checks after the last CSS refinements.

Browser checks use real SpacesPage components/effects with local synthetic transport. Vote/assigned checklist responses work and the checklist becomes Completed. Clearing member View clears/disables Send; Save closes the dialog. Guest composer/shared-item tools remain disabled and management controls absent. Creation keeps its fields/type options and autofocus. Voice forwards the existing ID/channel/publish payload. No browser console errors were observed in the inspected preview.

Twelve saved views, manually inspected; no pixel certification:

| View | Screenshot |
|---|---|
| Desktop Light main channel | [Image](screenshots-12/desktop-light-main.jpg) |
| Desktop Dark shared items | [Image](screenshots-12/desktop-dark-main.jpg) |
| Mobile Light main channel | [Image](screenshots-12/mobile-light-main.jpg) |
| Mobile Dark event/decision | [Image](screenshots-12/mobile-dark-main.jpg) |
| Mobile Dark permissions | [Image](screenshots-12/mobile-dark-permissions.jpg) |
| Mobile Light channel creation/focus | [Image](screenshots-12/mobile-light-create-channel.jpg) |
| Desktop Dark Space settings | [Image](screenshots-12/desktop-dark-settings.jpg) |
| Mobile Dark people/guest grants | [Image](screenshots-12/mobile-dark-people.jpg) |
| Desktop Light overview/Space creation | [Image](screenshots-12/desktop-light-overview.jpg) |
| Mobile Dark voice welcome | [Image](screenshots-12/mobile-dark-voice.jpg) |
| Mobile Light empty/read-only guest | [Image](screenshots-12/mobile-light-empty-guest.jpg) |
| Desktop Dark Updates isolation | [Image](screenshots-12/desktop-dark-updates-isolation.jpg) |

Spaces desktop captures are 1440×900; mobile captures are 390×844. Updates isolation was inspected in its separate browser tab at 1080×605. Themes/fonts were checked, and content captures waited for actual fixture data. The 320×844 spot check had no horizontal overflow; composer remained within the viewport. The error alert was also checked without saving another screenshot. Metadata wraps, actions remain reachable and mobile navigation remains usable.

## Standard gates and limits

All standard gates ran once and passed: client/server typecheck; **277/277 unit tests**; architecture (**276 edges**); client/server build; **11/11 Media V2**; **1/1 integration**; `git diff --check`. No skips. Build retains the existing large-chunk and mixed dynamic/static import warnings.

Visual evidence uses synthetic local replies and no live SSE or signed-in production backend. Voice verifies welcome/join callback, not actual LiveKit/device/mute/leave behavior. Creation, search/files, encrypted history and every role/state combination were not visually recertified; existing regression tests carry that coverage. No full accessibility certification or OS System-mode matrix was performed. Existing dialog focus behavior was preserved.

Stop for ChatGPT review; do not merge or begin Phase 13.
