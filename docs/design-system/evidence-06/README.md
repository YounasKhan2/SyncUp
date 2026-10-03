# Phase 06 evidence

Required base: `bf407baf96aa0e9329f143e1ffa01280d664172a`.

The summary covers 74 cases, 444 screenshots and 48 exact native keyboard step pairs. `captures.ndjson.gz` retains raw full screenshots and snapshots, with SHA-256 references for duplicate payloads. `comparisons.json.gz` retains zero-tolerance decoded RGB diagnostics and every intentional owned computed-style/bounds change. The ten JPEGs alongside this file are representative full before/after views.

Manifest hashes use LF-normalized UTF-8 text and unchanged binary bytes, so Windows checkout line endings do not change verification. Build metadata retains raw capture-source hashes and adds canonical LF source hashes matching Git.

Verify the manifest and archive without extracting:

```powershell
node tests/helpers/shell-navigation-manifest.mjs
node tests/helpers/shell-navigation-archive.mjs
```

To rerun pixel/structural and actual contrast analysis, extract to the original analysis directory:

```powershell
node tests/helpers/shell-navigation-archive.mjs docs/design-system/evidence-06/captures.ndjson.gz docs/design-system/evidence-06/captures
python tests/helpers/shell-navigation-evidence.py
python tests/helpers/shell-navigation-contrast.py
```

Pixel analysis needs Pillow and NumPy. This task used the existing bundled runtime; no repository package changes were made. `preimplementation.ndjson.gz` uses the same archive format and contains the initial observations before styling.

To rebuild the isolated fixtures from the required immutable base and current candidate:

```powershell
node tests/helpers/shell-navigation-build.mjs
node tests/helpers/shell-navigation-server.mjs
```

Serve at `http://127.0.0.1:5182/base/` and `/head/`. Query parameters are `scene=inbox|calls`, `theme=light|dark|system`, `os=light|dark`, and `badge=0|1|140`. Test controls are hidden identically. System preference is stabilized before page/theme initialization by the unchanged verification bootstrap.

Browser capture is performed through Codex's documented browser controls, using `shell-navigation-final-capture.mjs` and `shell-navigation-interactions.mjs`. The capture helper checks actual viewport/DPR/effective theme, preflights the unchanged base after a resize, records native hover/focus and preserves three repeat rasters. It accepts an optional `['head']` side list to refresh candidate captures without replacing accepted baseline records. Restore temporary browser viewport overrides afterwards.

`shell-navigation-audit.mjs` inventories base ownership without replacing an existing exact before/after fixture. `shell-navigation-css-report.mjs` generates precise source ownership counts. `shell-navigation-archive.mjs` checks every archive record hash and validates extraction paths. Gate log copies are whitespace-normalized for review; raw command output remains in `.git/visual06`. These are the clean baseline and final precommit checks; the committed-HEAD gate results and exact SHA are reported in the PR and completion response.
