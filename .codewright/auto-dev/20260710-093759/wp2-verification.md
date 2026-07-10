# WP-2 Verification — De-minify Bundle → `assets/app.js`

**Result: PASS (adoption gate cleared).** `assets/app.js` renders byte-behaviorally
identical to the original minified bundle across the full state matrix, so
`assets/index-B_LsmJIL.js` was deleted.

## What was transformed
`assets/index-B_LsmJIL.js` (224 645 B, 40 lines) →
`assets/app.js` (359 149 B, 10 473 lines) via a deterministic script:

1. Inlined the two `build.mjs` `patch()` edits directly into source (exact-string,
   assert-exactly-one-hit each):
   - `var f=oc()` → `var f=window.__i18n.wrapJsx(oc())`
   - the `dc.createRoot(...).render(...)` root render → the `window.__i18n.mount(...)`
     form with `__lang` passthrough.
2. Word-boundary identifier renames (all verified to occur **only** in the app region
   and to have zero collisions with existing names):

   | old | new | occurrences | role |
   |-----|-----|-------------|------|
   | `Wc` | `App` | 2 | root component (spoiler-cap state `V`, timeline index `x`) |
   | `Ac` | `SpoilerGate` | 2 | gate overlay (`{books, onPick}`, renders `.gate`) |
   | `Ie` | `Icon` | 17 | inline-SVG icon (`{name, size, className, style}`) |
   | `Dc` | `toastIconMap` | 2 | toast kind → icon-name map |
   | `Fc` | `ToastStack` | 2 | toast-list renderer (`{queue}`, renders `.toasts`) |

3. Prettier (babel parser, printWidth 100) for deterministic formatting.
4. React vendor region marked with boundary comments: line 1
   `// ─ React vendor region — do not edit ─` … line 8555
   `// ─ end React vendor region ─`. The app/vendor seam is `var dc=fc();`
   (end of react-dom client) → `function pc(` (first app helper).

Post-transform asserts (all hold): exactly one `window.__i18n.wrapJsx(` and one
`window.__i18n.mount(`; every `innerHTML`/`dangerouslySetInnerHTML` occurrence
(lines 834–3285) lies inside the vendor region (< 8555) — no new sink in app code;
`node --check assets/app.js` passes; old names `Wc/Ac/Ie/Dc/Fc` no longer occur.

## Verification method
Two self-contained pages were built with an identical head/fetch-shim/i18n-runtime;
only the bundle differed: **baseline** = original bundle + the two live `build.mjs`
`patch()` calls; **candidate** = `assets/app.js` with the patches removed (already
inlined). Both were driven in headless Chrome (chrome-devtools MCP, `file://`).

Two confounds were found and eliminated:
- **Language persistence** (`localStorage["dcc_lang"]`) leaked across reloads and
  swapped the en/de labels → normalized by forcing `__i18n.setLang("en"|"de")`.
- **Capture race**: after a slider change the `range` value clamps to the book cap on a
  *second* React commit; a fixed settle sometimes caught the pre-clamp DOM (same length,
  different content) → replaced with **stable-polling** (read the normalized snapshot
  until two consecutive reads are identical). The transient `.toasts` subtree (timing-
  dependent auto-dismiss) is stripped from the structural snapshot and verified
  separately.

### State list (finite)
- `00-gate` — initial load, spoiler gate overlay (EN).
- `{en,de} × book{1..8} × pos{0,123,247,371,495}` — every book cap (via `.cap-select`)
  at 0/25/50/75/100 % of the 495-step timeline, in both languages → **81 states total**.
- Toasts (per-event surface): a deterministic single-jump capture from a cleared state
  at positions 1–8 (`.toasts` innerHTML), plus an exhaustive per-position toast walk
  (0→495, auto-dismiss neutralized) to exercise every toast kind.

### Results
- **Structural diff: 0 differences across all 81 states** (normalized `#root.innerHTML`
  with `.toasts` children stripped), baseline vs candidate — clean.
- **Deterministic toast card:** identical — `p1 = 564204db:10921` on both builds
  (a `floor_change` card incl. `toastIconMap`→`Icon`→SVG path); `p2..p8` empty on both.
- **Toast walk:** both builds render all six kinds
  (`floor_change, achievement, spell_gained, item_gained, title_gained, level_up`) with
  `toast-icon`/`toast-head`/`toast-body` in every card. (The accumulated rolling-hash
  differs run-to-run because toast state accumulates with time-based dismissal — a
  measurement artifact, not a rendering difference; the deterministic single-jump card
  above is byte-identical.)
- **Language toggle:** re-renders the same tree translated (DE hashes differ from EN
  consistently and match across builds); React state preserved (no remount).

### `__i18n.misses()` baseline (fixed)
- **Count: 1. Keys: `["game-icons.net"]`.** Identical on baseline and candidate, in both
  EN and DE. (This single "miss" is the attribution string in the footer, expected.)

## Conclusion
Diff clean + misses baseline reproduced exactly → `assets/app.js` adopted as source of
truth; `assets/index-B_LsmJIL.js` deleted (recoverable from git history).

> NOTE: after this commit, `node build.mjs` fails until WP-5 renames the bundle input to
> `assets/app.js` and drops the `patch()` calls — expected, WP-2 and WP-5 are coupled on
> this branch (see plan Rollback Plan).
