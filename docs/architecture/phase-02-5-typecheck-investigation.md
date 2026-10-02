# Phase 2.5: typecheck allocation failure investigation

Investigation date: 2026-10-02. Clean main base: `edab352301c52f62e8df558c20845ce2acaaf575`.
Phase 3 remains paused. This correction records verified baseline evidence and the approved contrast constraint; it changes no verification command or compiler configuration.

## Original failure and reproduction

The Phase 3 baseline command `npm run typecheck` failed in the client workspace's first command:

```text
tsc -p tsconfig.app.json --noEmit --incremental false
FATAL ERROR: Committing semi space failed. Allocation failed - JavaScript heap out of memory
npm error code 134
```

The last original GC lines showed roughly 37.4 MiB live heap / 67.9 MiB heap capacity. The process failed to commit a young-generation allocation; the output does not demonstrate exhaustion of its maximum old-space budget. Extended diagnostics were not enabled on that failed run, so file/type metrics from the crash are unavailable.

Investigation environment: Windows 11 Pro 10.0.26200, x64; Node v24.18.0; npm 11.19.1; installed TypeScript 6.0.3. `NODE_OPTIONS` was unset and Node reported a default V8 heap limit of 2,240 MiB. Physical memory was approximately 5,965 MiB, with about 514 MiB free at the first investigation snapshot. A later snapshot showed approximately 16.53 GB committed against a 25.46 GB commit limit (64%) and 773 MiB available. The pagefile was allocated 18,318 MiB. These are investigation-time samples, not measurements at the original crash.

On unchanged clean main, `npm run typecheck:client`, `npm run typecheck:server`, and then `npm run typecheck` each passed with default environment options. The original failure did not reproduce. Neither isolated checker nor the sequential root command currently fails.

## Scope audit

Root typecheck invokes client then server sequentially. Client checks app and Vite config separately using non-emitting checks with incremental mode disabled. Client build uses `tsc -b` with app/node project references; typecheck does not run the build or duplicate those references.

TypeScript's config parser found:

| Config | Root source files | Scope |
| --- | ---: | --- |
| `client/tsconfig.app.json` | 57 | `src` |
| `client/tsconfig.node.json` | 1 | `vite.config.ts` |
| `tsconfig.server.json` | 26 | `server/**/*.ts` |

No config parse errors or generated/build/dist/coverage/cache/test-fixture/node_modules root sources were found. The server output is `dist/server`, outside its include. Client outputs and tsbuildinfo caches are outside the root-source includes. Dependency declarations count toward compiler program metrics through legitimate imports; they are not accidentally included application roots. No legitimate source was excluded, and no duplicate source tree was found in the configured roots.

## Compiler diagnostics

Direct non-emitting checks used `node node_modules/typescript/bin/tsc -p <config> --noEmit --incremental false --extendedDiagnostics`, sequentially, without environment heap overrides.

| Metric | Client app | Vite config | Server |
| --- | ---: | ---: | ---: |
| Files (including libraries/declarations) | 360 | 227 | 575 |
| Library lines | 72,361 | 12,264 | 57,794 |
| Declaration lines | 107,476 | 89,403 | 142,556 |
| TypeScript lines | 8,532 | 12 | 6,741 |
| Identifiers | 203,452 | 76,777 | 184,514 |
| Symbols | 167,830 | 57,013 | 158,426 |
| Types | 26,956 | 395 | 15,939 |
| Instantiations | 50,397 | 347 | 53,214 |
| Memory used (compiler-reported K) | 285,266 | 103,105 | 242,668 |
| Check time | 4.81 s | 0.07 s | 2.11 s |
| Total time | 7.02 s | 1.14 s | 4.40 s |

Compiler-reported memory is not peak process RSS, Windows commit, or a minimum heap requirement. These successful results show bounded compiler use well below the default heap limit and no observed pathological type expansion.

## Controlled heap probes

Only the formerly failing client app check was probed, with `--extendedDiagnostics`. Temporary `NODE_OPTIONS` values were restored in a PowerShell `finally` block. No setting persisted in the repository or subsequent checks.

| Node old-space setting | Exit | Compiler memory | Check / total |
| --- | ---: | ---: | --- |
| Default (2,240 MiB total V8 heap limit) | 0 | 285,266 K | 4.81 / 7.02 s |
| `--max-old-space-size=512` | 0 | 264,140 K | 4.47 / 6.51 s |
| `--max-old-space-size=3072` | 0 | 284,527 K | 4.02 / 5.99 s |

The client can complete using a 512 MiB old-space budget, with about 258–279 MiB reported compiler memory across these runs. This is not an exhaustive search for the smallest heap or a portable machine-capacity guarantee. Additional heap was unnecessary and did not establish a fix for the original allocation failure.

## Diagnosis and smallest correction

Observed failure class: V8 could not commit a semi-space allocation at a small live heap. Likely explanation: transient host memory/resource pressure. That explanation remains an inference because no host commit/pressure telemetry was captured at the original crash; low free physical memory alone does not prove Windows commit exhaustion. We cannot honestly identify the exact OS allocation cause from the retained log.

Evidence rules out a reproducible compiler heap-capacity problem in the measured runs: unchanged isolated and root checks pass, scope is bounded, and even a reduced heap completes. No specific legitimate type construct was identified as pathological. Do not increase the repository heap budget, narrow source coverage, change sequencing, or refactor production code on this evidence.

The smallest justified correction is documentation of the investigation and correction of the earlier implication that the repository requires extra Node heap. The repository's ordinary `npm run typecheck` already works without private manual options. This PR does not claim a code fix for an unreproduced environmental failure or guarantee it cannot recur.

If it recurs, preserve the full error, Node options, heap/GC figures, and simultaneous Windows commit/available-memory measurements before choosing a tooling change. Run the client/server checks sequentially to isolate it. A larger heap is a diagnostic experiment only; a demonstrated scope or command problem should be corrected first. No automated retry is introduced to hide a failure.

## Phase 3 approved usage constraint

Keep the approved palette unchanged. Light muted `#8C8389` on main surface `#FAF8F5` measures 3.46:1 and must not serve normal small body/label text requiring 4.5:1. Use approved secondary `#6F676D` on that surface for those roles (5.16:1). Muted remains available only where actual size, role, and background meet the applicable contrast requirement. No theme implementation occurred in this phase.

## Verification and scope

Final verification passed using the ordinary repository commands with `NODE_OPTIONS` unset: `npm run typecheck`, `npm test` (36 passed, including all 19 Phase 2 tests; zero failed/skipped), `npm run check:architecture` (242 edges; no shared-to-feature violations), and `npm run build`, plus `git diff --check`. The existing large LiveKit chunk and ineffective jobStore dynamic-import warnings remain. Phase 2 characterization files and expectations are unchanged. Database integration and visual/theme verification were not executed; no arbitrary local/shared infrastructure was used.

No production runtime source, API, database, migration, auth, crypto, messaging, calls, media, Spaces, realtime, polling, CSS, or theme behavior changed. Phase 3 must not resume under this PR. Stop for review after opening it.
