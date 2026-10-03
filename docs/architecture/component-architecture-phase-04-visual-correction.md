# Phase 04 visual verification correction

Evidence-only correction for PR #29. Previous HEAD: `5ec4e3532df83b68be3f695f961f115598b3761a`; base remains `c8ae377c756038992dd0f02fe303e66f83a6c698`. No production edit or new baseline derived from HEAD. The original baseline JSON and original evidence directory files are retained byte-for-byte.

## Deterministic setup and scope

Both sides are static Vite builds of `git archive` client trees at the two fixed revisions, using identical build options, dependencies, fixture adaptation, HTML bootstrap, origin, browser, tab and screenshot procedure. The recovered pre-refactor fixture includes the frozen original header; a test reconstructs it exactly from HEAD's fixture by reversing only the approved header/import changes. Build/source hashes are in `visual-correction/build-manifest.json`.

The IAB exposes viewport control but no native color-preference emulation. A test-only inline bootstrap runs before CSS and the React module. It emulates the application's exact Light/Dark `prefers-color-scheme` matchMedia queries, delegates other queries, sets the requested root theme/colorScheme before CSS, and records page-world query results in DOM attributes. Real production appearance initialization subsequently executes. Every capture checks requested appearance, effective theme, colorScheme, both OS-query results, font readiness and empty diagnostics. Unit tests flip the native preference and exercise real appearance initialization. This is application-boundary OS emulation; native browser CSS media emulation is not claimed. The only relevant native CSS fallback is gated by `:root:not([data-theme])`, which is inactive before CSS initialization here.

Actual CSS viewport and raster dimensions are 1440×900 and 390×844. DPR is exactly 1.190000057220459 on both sides. Because the viewport capability uses host-scaled dimensions, requested sizes are 1714×1071 and 464×1004; actual dimensions are asserted before capturing. Screenshots are full viewport JPEG bytes returned by the same API, without cropping, masking, tolerance or editing.

Fixture controls have the identical HTML `hidden` attribute on both sides, retaining callbacks/DOM while preventing inconsistent overlay capture. Fonts and two animation frames precede sampling. The corrected capture procedure preserves every warm-up frame and requires three consecutive byte-identical screenshots before saving three final repeats. A unit test proves transient frames are retained and cannot satisfy this rule prematurely.

## Exact structural results

Eight scenes (home, text, announcement, private, voice, history, object, collapsed), two viewports and four modes (Light, Dark, System with OS Light, System with OS Dark): **64/64 exact paired snapshots**. Ten representative button actions add **10/10 exact paired action snapshots**, including focus identity. Equality includes every root descendant's attributes (classes, IDs, ARIA), text and child order, values, every computed CSS property, floating-point bounds, focus path/markup, theme/root attributes and diagnostics. Snapshot equality is asserted after each final repeat. No normalization of product DOM or style values is used.

Three fresh navigations of the two raster outliers add **6/6 exact structural pairs**. The unchanged baseline state in these rechecks also equals the stabilized cohort's state exactly.

## Screenshots and decoded differences

Every unequal screenshot is decoded to RGB. Any unequal channel counts one changed pixel; all pixels participate. The reports include byte SHA256, count, exact percentage, half-open bounding box, connected 32px tile regions, intersected product regions and maximum channel delta. There is no 'harmless' exclusion.

| Cohort | Paired states | Final screenshots | Decoded comparisons | Byte/pixel equal |
|---|---:|---:|---:|---:|
| Initial corrected setup, before raster stabilization | 74 | 444 | 666 | 662 |
| Three-frame stabilized complete matrix and actions | 74 | 444 | 666 | 660 |
| Fresh navigation recheck 1 | 2 | 12 | 18 | 18 |
| Fresh navigation recheck 2 | 2 | 12 | 18 | 18 |
| Fresh navigation recheck 3 | 2 | 12 | 18 | 18 |

The initial corrected setup had one mobile Light home transient: **18,623 pixels, 5.6577348401992955%, bbox [72,479,320,560]**, touching the product card. Base repeats 1 and 2 differed from repeat 3 by exactly the same pixels, while repeat 3 matched all HEAD frames. This difference is reproduced on the same unchanged baseline build.

The stabilized full cohort had two desktop System/OS-Dark cross-build outliers, each present in all three final pairs:

| Scene | Changed pixels | Percent | Bbox | Product UI |
|---|---:|---:|---|---|
| announcement | 105,695 | 8.155478395061728% | [0,0,1440,900] | Header, sidebar, messages, composer and main |
| private | 124,159 | 9.58016975308642% | [0,0,1440,900] | Header, sidebar, messages, composer and main |

All 444 stabilized warm-up comparisons and all 444 within-navigation same-build final comparisons are exact. However, stable consecutive images alone do not guarantee stable rasterization across navigation: unchanged-build cross-navigation analysis reproduces the announcement's **105,695-pixel difference exactly** between stabilized baseline and every fresh baseline recheck. Private's **124,159-pixel difference exactly** occurs between the original corrected baseline and stabilized baseline. All comparisons have identical viewport/DPR; the fresh and stabilized structural states are exactly equal. Additional same-build cross-navigation variants (103,097 / 120,493 / 123,102 / 126,853 pixels, with percentages and regions) are retained in the complete report, rather than discarded.

All three fresh rechecks match base/HEAD bytes exactly for both outlier scenes: 36 final screenshots, 54 decoded comparisons and 36 warm-up comparisons, no differences. The last rechecks establish pixel equality for these scenes in the corrected setup, while the prior cohort remains a failed raster comparison. We do not present a stitched 64/64 pixel-perfect full cohort or claim the screenshot backend is universally deterministic. Theme initialization is deterministic; residual cross-navigation raster variability remains evidenced. No production regression was identified by deterministic structural verification.

## Artifact preservation and reproduction

`component-phase-04-evidence/visual-correction/` contains readable cohort summaries, compressed complete comparison reports, build hashes, four representative unedited image pairs, and all raw snapshots/frames indexed by stage/path/hash. `artifact-manifest.json.gz` indexes **2,056 files**. `rasters.ndjson.gz` stores **70 unique byte-identical hashes** with base64 bytes; deduplication removes only duplicate storage. `snapshots.ndjson.gz` retains exact original JSON text, including every warm-up manifest and the abandoned isolated-observation-world attempt. That attempt failed because CUA evaluates in an isolated world; the final verifier reads actual page-world media probes persisted before initialization. One late capture call timed out after writing all files; completeness was checked and its final scene repeated. No failed evidence is replaced.

Build with `node tests/helpers/spaces-visual-build.mjs`, serve with `node tests/helpers/spaces-visual-server.mjs`, then invoke exported `capture`/`captureActions` through CUA using the documented browser capability. Analyze directories with `spaces-visual-pixels.py`; run `spaces-visual-repeat-analysis.py` for all cross-navigation pairs. Python needs Pillow and NumPy (available in the bundled runtime); no dependency installation or package change was made. The packaging helper retains raw artifacts and final gate logs.

## Final gates and production diff

All six unmodified standard commands passed on the final verification implementation and unchanged production candidate:

- `npm run typecheck`: exit 0, client and server.
- `npm test`: exit 0, **215/215**, zero failures/skips, 52,397.7493 ms.
- `npm run check:architecture`: exit 0, **270 edges, 21 informational findings, zero violations**.
- `npm run build`: exit 0, existing large-chunk and ineffective dynamic-import warnings.
- `npm run test:media-v2`: exit 0, **11/11**, zero failures/skips, 286.1074 ms.
- `npm run test:integration`: exit 0, **1/1**, zero failures/skips, 45,086.4164 ms; real HTTP/storage/call-token integration.

No runtime/configuration/heap/test flags changed. Gate logs are archived; the test integration's normal resources were used without database or service configuration changes. Correction files are only verification fixtures/helpers, the existing test worker import, this report, a link from the original report and evidence archives. The production patch is unchanged: SpacesPage, SpaceChannelHeader, relocated SpaceLegacyHistoryView and relocated SpaceVoiceChannelView only. Baseline/CSS/tokens/permissions/realtime/polling/files/voice/objects/encrypted-history/server/database/packages/configuration remain unchanged.

Remaining scope limitation: fixtures use seeded home/sidebar representations and real changed header/moved presentation views. This correction does not claim authenticated browser end-to-end flows, live voice, multi-user realtime or real browser encryption/upload paths. Residual capture-backend variability touches UI and is explicitly retained; it is not silently classified harmless. PR #29 remains open and unmerged. No next architecture phase begins.

## Correction commit file inventory

- `docs/architecture/component-architecture-phase-04-spaces.md`
- `docs/architecture/component-architecture-phase-04-visual-correction.md`
- `docs/architecture/component-phase-04-evidence/visual-correction/artifact-manifest.json.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/base-desktop-dark-light-text-1.jpg`
- `docs/architecture/component-phase-04-evidence/visual-correction/base-mobile-dark-light-text-1.jpg`
- `docs/architecture/component-phase-04-evidence/visual-correction/build-manifest.json`
- `docs/architecture/component-phase-04-evidence/visual-correction/final-gate-logs.ndjson.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/final-gates.json`
- `docs/architecture/component-phase-04-evidence/visual-correction/first-pass-pixel-comparisons.json.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/first-pass-summary.json`
- `docs/architecture/component-phase-04-evidence/visual-correction/head-desktop-dark-light-text-1.jpg`
- `docs/architecture/component-phase-04-evidence/visual-correction/head-mobile-dark-light-text-1.jpg`
- `docs/architecture/component-phase-04-evidence/visual-correction/navigation-repeat-comparisons.json.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/pixel-comparisons.json.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/rasters.ndjson.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/recheck-1-pixel-comparisons.json.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/recheck-1-summary.json`
- `docs/architecture/component-phase-04-evidence/visual-correction/recheck-1-warmup-comparisons.json.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/recheck-2-pixel-comparisons.json.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/recheck-2-summary.json`
- `docs/architecture/component-phase-04-evidence/visual-correction/recheck-2-warmup-comparisons.json.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/recheck-3-pixel-comparisons.json.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/recheck-3-summary.json`
- `docs/architecture/component-phase-04-evidence/visual-correction/recheck-3-warmup-comparisons.json.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/snapshots.ndjson.gz`
- `docs/architecture/component-phase-04-evidence/visual-correction/summary.json`
- `docs/architecture/component-phase-04-evidence/visual-correction/warmup-comparisons.json.gz`
- `tests/fixtures/spaces-presentation-base.tsx`
- `tests/fixtures/spaces-visual-bootstrap.js`
- `tests/helpers/spaces-visual-build.mjs`
- `tests/helpers/spaces-visual-capture.mjs`
- `tests/helpers/spaces-visual-package.py`
- `tests/helpers/spaces-visual-pixels.py`
- `tests/helpers/spaces-visual-repeat-analysis.py`
- `tests/helpers/spaces-visual-server.mjs`
- `tests/helpers/spaces-visual-verification.mjs`
- `tests/spaces-ui-characterization.test.mjs`
