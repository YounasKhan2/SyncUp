# Phase 04 — Shared Avatar presentation ownership

## A. Git/base

Verified clean main: `aabff6a4e15cfa73c33fd30287e1771914c3c60f`.
Branch: `design/syncup-avatar-tailwind-migration-04`.
Commit: `design: migrate shared avatar to semantic Tailwind`.
The PR targets main, remains unmerged, and includes no Phase 05 implementation.

## B. Baseline

Before production edits all six gates passed: client/server typecheck; 238/238 standard
tests; architecture 276 resolved edges / 21 informational dependencies / zero
violations; client/server build; Media V2 11/11; real integration 1/1. Zero skips,
cancellations or todos. Logs and the before-edit characterization are archived in
`evidence-04/verification-logs.ndjson.gz` and `verification-ledger.json`.

## C. Existing Avatar contract

Props are exactly `name: string`, `src?: string | null`, `className?: string`.
No native-prop spread, style, title, data attributes, external ARIA, ref, size,
loading, decoding, srcSet, children or other image props are supported. Runtime
extra props are ignored; this phase adds no API. The root is a span with role img
and aria-label equal to the original untrimmed name. The fallback is another span,
aria-hidden="true", always present and ordered after the optional image.

Initials are exactly `name.trim().slice(0, 1).toUpperCase() || '?'`: one UTF-16 code
unit before uppercase, not first letters of words or grapheme-aware slicing.
Examples preserved: whitespace-only → ?, é → É, ß → SS, emoji → its first surrogate.
The latter is a known Unicode limitation, not fixed here.

A truthy src inserts img first with key/src equal to src, alt empty, width/height
attributes 64/64. Falsy undefined/null/empty string inserts no img. No hooks, effects
or React state exist. An image error directly sets the img inline display to none
and removes avatar-has-image from its parent. The failed img stays mounted; the
fallback becomes visible. Optional chaining handles a missing parent.

## D. Consumer inventory

16 production call sites across 12 files. Exact JSX/props and locations are recorded
in `evidence-04/consumer-overrides.json`; no consumer JSX changes.

| File under client/src/features | Sites/context | Source/name/class and geometry |
| --- | --- | --- |
| account/AccountPanel.tsx | 1 profile, layout/runtime sensitive | avatarPreview or user avatar; display_name; profile-avatar; 64px |
| calls/CallWindow.tsx | 1 voice participant, call/layout/runtime sensitive | participant avatar/name; call-voice-avatar; 68px, responsive 56px |
| messaging/ChatDetailsScreen.tsx | 3 details header, member list, invite match | group header has no image; peer/member/match names and avatars; header chat-details-avatar 76px; lists default 31px |
| messaging/components/ConversationHeader.tsx | 1 conversation header | title/avatarUrl; chat-avatar 29px |
| messaging/components/ConversationWelcome.tsx | 1 welcome/profile card | user name/avatar; avatar-card 29px |
| messaging/MessageList.tsx | 1 incoming message, compact | sender name or Member/avatar; message-avatar 26px, 3px top margin; omitted for own messages |
| messaging/RequestsPanel.tsx | 1 request card | request display_name/avatar; default marker, contextual color/background |
| messaging/SearchDialog.tsx | 2 people/chat search rows | person name/avatar or chat title/peer avatar; default 31px |
| workspace/components/ChatRow.tsx | 1 list row | chat title/peer avatar; group-avatar for groups; contextual 30px |
| workspace/components/InboxPane.tsx | 2 call history and request row | call title, group calls omit image; request name/avatar; contextual rows and direction badge |
| workspace/components/IncomingCallBanner.tsx | 1 incoming call | group title or caller name; group omits image; normal 31px, narrow banner override 76px |
| workspace/components/WorkspaceRail.tsx | 1 account/navigation | user display_name/avatar; avatar-you; default 31px |

All consumers fall back through the primitive algorithm when their optional image
is absent or fails. None supplies native props, title, ref or inline style. Avatar
itself has no click/keyboard handler or focusability; any interaction belongs to its
parent button/row/profile control. Inherited font family/line-height/text color can
vary by parent. Existing explicit legacy sizes and consumer colors stay authoritative.

## E. Override inventory

Three primitive selectors live in platform.css: `.avatar`, `.avatar > img`,
`.avatar-has-image > span`. Only four declarations in the first rule transfer.
All contextual/consumer selectors remain byte-identical. The machine inventory
includes selector nesting, complete declarations and ownership labels.

Retained contextual rules include profile-avatar; avatar-you/card/small; chat-list
item avatar/group-avatar; chat-avatar; message-avatar; request-card > avatar;
chat-details-avatar and member-row exclusions; call-history avatar wrapper/badge;
call-voice-avatar, its image rule and responsive dimensions; incoming-call banner
dimensions; dark overrides and final root theme overrides. Wrapper/action rules
that merely contain "avatar" in their class names are also inventoried and retained.

Unused shared extensions such as avatar-small and legacy/raw feature avatar rules
are not consolidated. They are legacy coupling rather than new primitive API.
No contextual sizing, margin, flex behavior or palette is moved into Avatar.

## F. Characterization

Added three tests before production edits and ran them against unchanged Avatar:
3/3 passed, zero skips. They freeze missing/null/empty src, exact fallback algorithm,
root ARIA, image key/attributes/order, consumer class order, unsupported prop behavior
and the error mutation. A real browser before-edit trace additionally characterizes
valid/missing/failing images, same-props rerender, name/class changes and src changes.
That trace is preserved separately from the final paired seven-step traces.

Three additional enforcement tests freeze the exact four-property source/CSS
transfer, every other production/config file, contextual/image/fallback declarations
and actual utility emission. Prior Phase 02/03 guardrails reconstruct only this exact
bounded Avatar change; their other historical freezes remain active.

## G. Image/error behavior

The browser requests `/broken-avatar`, receives a real 404 and invokes production
onError. No manual state toggle substitutes for this behavior. Captured failed imgs
are complete, natural dimensions zero, inline display none; their parent marker is
removed and fallback visibility is visible. Valid fixture SVG images decode to 96×64
natural dimensions; CSS crops them within each original Avatar size using cover.

Paired traces match after removing only the four utility tokens:

1. Initial failure: mounted hidden img; visible R fallback.
2. Same-props parent rerender: failed state remains.
3. Change name: accessible name/fallback update; failed state remains.
4. Change className: React restores avatar-has-image while the failed img remains
   hidden, hiding fallback too. This existing bug is preserved and documented.
5. Valid src: img key changes, new visible image loads, fallback hidden.
6. Missing src: img removed, fallback visible.
7. Broken src again: real failure hides new img and restores visible fallback.

No image interpolation, loading, decoding, intrinsic attribute, error, key or source
behavior changes. Only the explicitly expected broken-image resource event is
excluded from unexpected-error diagnostics; the resulting image state is asserted.

## H. Tailwind mapping

| Original declaration | Static utility | Ownership |
| --- | --- | --- |
| position: relative | ui:relative | Avatar root positioning |
| display: grid | ui:grid | Avatar root layout |
| place-items: center | ui:place-items-center | Image/fallback alignment |
| overflow: hidden | ui:overflow-hidden | Original clipping |

These exact non-color utilities are generated by the approved Phase 02 prefixed
Tailwind infrastructure and emitted in actual production CSS. No dynamic utility,
unprefixed utility, arbitrary color, raw new palette literal, important flag, token,
package or configuration is added. There is no primitive-owned foreground/background
color to safely transfer: those values are inherited or consumer-owned. Applying
brand colors to the root would change existing consumers, so none is introduced.

## I. Legacy CSS ownership

Remove exactly the four declarations listed above from the unlayered `.avatar`
rule. Utilities now own those properties, with no remaining competing primitive or
contextual declaration. No important or layer reorganization is used. Retain root
width/height/flex/radius/font size/weight; entire image and fallback selectors; all
other platform declarations. A one-line platform.css edit is necessary because the
actual primitive rule lives there. No unrelated CSS cleanup or reordering occurs.

## J. DOM contract

Exact root span → optional img → fallback span order is preserved. No new wrapper,
element or pseudo-element is added. The only intentional DOM attribute change is
four utility tokens in the root class string. Marker/consumer/image-state token
order is preserved; native classList error removal can normalize class whitespace.
Non-migrated class strings, attributes, IDs, ARIA, values and child order match.

## K. className/ref/native props

Original order is avatar marker, consumer className, conditional avatar-has-image.
New utility tokens follow the marker, before the consumer extension; conditional
image-state marker remains last. No merge library or API normalization is added.
Avatar does not forward refs or unsupported native props. Image attributes remain
exactly src, empty alt, 64/64 width/height and original error callback/key semantics.

## L. Geometry

All element bounds match exactly. Primitive remains 31×31px, flex 0 0 auto, radius
50%; rounded-full's 9999px is deliberately not substituted. Original consumer sizes
25/26/29/30/64/68/76px and responsive 56px voice sizing remain untouched. Captures
exercise the real responsive voice and incoming-call contexts. Root clipping and
alignment, img absolute positioning/inset, 100% dimensions and object-fit cover
match in every state. No nearest-scale approximation occurs.

## M. Typography

Root legacy body-xs size and weight 600 remain in CSS, with unchanged contextual
profile/card/message/details/voice size overrides and inherited family/line-height/
tracking. Fallback strings and every computed font property are compared exactly.
No new typography-role utility is used.

## N. Colors/themes

All computed foreground/background values remain exact. Light, Dark and System
with OS Light/Dark are tested after the test bootstrap establishes page-world OS
preference before CSS/modules and unchanged appearance initialization. Before every
capture, effective data-theme, data-appearance, inline color-scheme, persisted OS
probes, loaded fonts and unexpected diagnostics are verified. No user OS setting or
production appearance code changes. Existing consumer palettes are retained.

## O. Accessibility

Browser AX exposes one named image for the root; decorative img alt is empty and
fallback aria-hidden remains true. The accessible name survives image failure.
Empty names remain empty even though visual fallback is ?, an existing weakness.
Search parent buttons can expose a duplicated name (Avatar label plus sibling
text); that existing behavior is preserved. Avatar is not itself focusable.

Computed opaque foreground/background ratios are recorded in contrast.json, range
1.630070421–11.877449381:1. The Dark avatar-card pair is 1.63:1 (fallback hidden by
a valid image in the sampled Welcome scene; the same pair would apply when visible).
Legacy list-row initials are 4.415477308:1. These existing color weaknesses are
documented, not redesigned. Transparent backgrounds and image/composited pixels are
not claimed as contrast measurements. This is not a full accessibility audit.

## P. Browser state evidence

96 pairs = two CSS viewports (1440×900, 390×844) × four theme/OS modes × 12 scenes:
Workspace inbox/history/incoming call; Conversation messages/welcome/direct details/
group details; Account profile; voice room; Requests; Search; native-state probe.
These use actual production consumers with synthetic identities and deterministic
fixtures. Voice/search/request runtime effects and hook seeds are isolated only in
the test build, identically on both sides; no media permission/backend is invoked.

One hidden Codex browser tab, DPR 1.190000057220459 and identical build/capture
procedure. Both clients are archived from required main; only Avatar.tsx/platform.css
overlay head. Base is never generated from migrated code. Fixture controls are hidden
in inherited Workspace/Conversation scenes; native probe controls are visible and
identical. No debug overlay differs across builds.

Search auto-focus is separately observed before an identical real pointer click on
its heading blurs both inputs for raster capture. Eight focused DOM/style/bounds
pairs also match. This stabilizes a native caret without CSS hiding or masking.

## Q. Structural/style/bounds parity

96/96 pairs match every enumerated computed property/custom property, bounds, image
natural dimensions/complete/display/object-fit, fallback visibility/typography,
DOM/IDs/ARIA/values/order and active element. Eight automatic-focus observations and
seven image transition steps also match. Only expected Avatar utility tokens are
normalized; consumer token order remains exact. Other class strings are unchanged.
Full observations use bounded chunks; no [Object]/[Array] truncation placeholders
exist. No style tolerance, bounds rounding or property omission is used.

## R. Raster evidence

576 final screenshots; 288/288 cross-build comparisons byte-identical and zero
changed RGB pixels (0%, no bbox, no touched product region). 576 same-build final
repeat comparisons and 384 warmup comparisons also match. Total 1248/1248 exact.
Three consecutive identical warmups precede three final screenshots. Every pixel
is included; any unequal channel counts one changed pixel. No masks/crops/tolerance.

Preserved initial focused Dark Search diagnostic: one cross-build and two repeated
unchanged-head comparisons differ by 170 pixels, 0.013117283950617283%, bbox
[512,232,520,256], connected 32px tile [512,224,544,256]. They touch the actual
Search input and no Avatar. The focused input bounds are identical on both builds.
Sixty further unchanged-head frames (30 Light/30 Dark) reproduce both original caret
hash states. Their 58 comparisons include 32 differing caret states: Dark 170px at
the original bbox; Light 205px at [511,232,522,257]. No Avatar region is touched.

A packaging filename collision overwrote some copied rejected frames and original
snapshot copies with warmups. The comparison logs retained original SHA256 hashes;
18 original Search final-raster hashes were verified/recovered byte-for-byte from
unchanged-build reproduction. Recovery provenance is explicit in caret-reproduction.json.
Original rejected snapshot copies could not be recovered; separately captured full
pre-blur focus observations remain, and final observations are complete. This is a
recorded evidence limitation, not a production regression or tolerated pixel change.
The final stable capture set is unaffected. A timed-out batch was resumed from its
saved boundary and its last pair rechecked; partial raster records are archived.

Raw final rasters, snapshots, pre-blur observations and diagnostics are content-hash
archived in captures.ndjson.gz, with utf8/base64/reference encodings. The archive is
verified against actual files; comparisons.json.gz and summary.json report every
final pixel comparison. Standalone desktop/mobile samples are included.

## S. CSS reduction

Primitive selectors 3 → 3; declarations 16 → 12. Root `.avatar` declarations 10 → 6.
Exactly position/display/place-items/overflow move; no whole selector is removed.
Image rule retains five declarations; fallback-state rule retains one.
Counts are author declarations, not expanded longhands. All contextual declarations
and unrelated Button/IconButton/Dialog styles remain unchanged.

## T. Production scope

Exactly two production files:

- client/src/shared/components/Avatar.tsx: four static root utility tokens only.
- client/src/shared/styles/platform.css: four matching declarations removed from one rule.

All remaining changes are tests/fixtures/helpers/docs/evidence. No feature consumer,
raw avatar/image, token, package/config, auth/session/API, appearance implementation,
realtime/crypto/media/voice/Calls runtime, Spaces permission, server or database edit.

## U. Architecture/build/integration

Candidate gates: typecheck passes; tests 244/244; architecture 276/21/0; client/server
build passes; Media V2 11/11; real integration 1/1; zero skips/cancellations/todos.
All six gates are run again on the committed HEAD before push/PR, with exact results
reported in the PR and final response. Existing large-chunk and ineffective dynamic
import warnings remain. git diff --check passes. Actual production CSS emits all four
literal ui: classes. No production dependency edge changes.

## V. Limitations

One browser engine/DPR, not all browsers/devices. Synthetic product identity and
test-only effect isolation do not prove browser end-to-end account persistence,
encrypted message transport or live voice connection; separate real integration
passes. Group invite-match and Inbox request branch interactions are source-frozen
but not individually driven in the browser; their base layout is represented by
member/request/list contexts. Avatar has no native focus contract to exercise.
Pseudo-element styles are not separately enumerated; Avatar defines none. Contrast
is limited to computed opaque pairs. Existing Unicode, class-change/error fallback
and naming/contrast issues are preserved. The rejected-snapshot packaging limitation
and exact recovered raster provenance are disclosed in R.

## W. Phase 05 recommendation

BrandMark is the lowest-risk existing remaining meaningful boundary: a static,
aria-hidden SVG mark, six consumers in four files, a small prop and no runtime hooks
or events. Its semantic fills/background and contextual geometry need a bounded
inventory/parity pass first. Dialog has overlay sizing, consumer class coupling and
focus/lifecycle concerns; FullEmojiPicker includes lazy vendor/theme/Escape behavior.
Input/Badge/Tooltip are not currently shared primitives. Recommend a narrowly scoped
BrandMark pass rather than automatically creating those primitives or migrating a
shell/page. This is recommendation only. No Phase 05 work has started.
