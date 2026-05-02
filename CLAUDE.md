# CLAUDE.md

Behavioral guidelines first, then project-specific context.

**Tradeoff:** these guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Project: svg-to-msdf

A Bun + TypeScript monorepo. Bakes SVGs into Multi-channel Signed Distance Field textures in the browser and renders them through a family of three.js TSL `NodeMaterial` subclasses.

The README is the authoritative description of the public API and SVG support — read it before changing baker semantics or material props.

### Layout

- `library/` — the published package (`svg-to-msdf`). Public entry: `library/src/index.ts`.
  - `bake.ts` — CPU rasterizer + Three-aware bake wrappers. Two output modes:
    - `fill`: signed distance, per-channel via `colorEdges` for sharp corners (median-of-3 in shader).
    - `line`: unsigned distance, alpha-mask style. Same shader path, different threshold.
  - `parseSvg.ts` — SVG → contours (with optional fill/stroke layering). Curves flattened via `flatten.ts`.
  - `pathParser.ts` — `d`-attribute → command list (M/L/H/V/C/S/Q/T/A/Z, absolute and relative).
  - `edgeColoring.ts` — assigns R/G/B channel groups to edges so adjacent runs share at most one channel.
  - `msdfNodes.ts` — shared TSL graph (median-of-3 + AA coverage) and the prop-accessor wiring.
  - `MsdfNodeMaterials.ts` — eight thin subclasses around a `withMsdfNodes` mixin.
  - `SvgMsdfLoader.ts` — three.js `Loader<Texture>` wrapper.
- `example/` — Next.js demo using `@react-three/fiber` (WebGPU) + `@react-three/drei`. Used for visual verification only; no automated tests.

### Commands

- `bun i` — install workspace deps.
- `bun run --filter 'svg-to-msdf' build` — required before example typecheck/dev (example imports the built `dist/`).
- `bun test` — runs `bun:test` against `library/src/__tests__/`. Only `pathParser`, `flatten`, `edgeColoring` are covered.
- `bun run all` — lint (`oxlint`) + format check (`oxfmt`) + tests + typecheck across both packages.
- `bun run dev` — runs both packages in parallel (`tsup --watch` + `next dev`).

### Conventions

- Formatter is `oxfmt`; linter is `oxlint`. Both must pass with no warnings introduced. Don't reformat untouched files.
- Style: ESM, no semicolons, single quotes, 2-space indent, named-export-only at module boundaries.
- TypeScript: strict mode, `verbatimModuleSyntax`. Type-only imports use `import type`. Library has `noUncheckedIndexedAccess: false`; example has it `true` — don't rely on it being on while editing the library.
- Comments: explain _why_ something is non-obvious (an SVG-spec edge case, a perf reason, a cross-module invariant). Don't restate what the code does.
- Tests: `bun:test` (`describe`/`test`/`expect`), import source via `.ts` extension (`from '../foo.ts'`).

### Invariants and gotchas

These came out of an audit. They aren't enforced by the type system — break them and things fail silently.

- **Edge mutation.** `colorEdges` writes to `edge.color` in place. Any contour added to both a fill layer and a stroke layer must be cloned (`cloneContour`); both layered code paths in `parseSvg.ts` already do this.
- **Fill contours must be closed.** The baker uses an even-odd point-in-polygon test to sign the SDF. Open contours (raw `<polyline>`, paths without `Z`) produce garbage fills. `cloneContourClosed` in `parseSvg.ts` is the closing point — keep fill copies routed through it; stroke copies stay open.
- **`bakeSvgToMsdf*` is `async` in name only.** It runs the full per-pixel sweep on the call stack and resolves a promise. Calling it during render blocks paint. Treat it as synchronous when reasoning about UI freezes, and don't add `await` thinking it yields.
- **Building before typechecking the example.** `example/` imports `svg-to-msdf` from `library/dist/`. A clean checkout fails example typecheck until `bun run --filter 'svg-to-msdf' build` runs once.
- **Two API surfaces.** `rasterizeMsdf` is the engine-agnostic path (returns raw RGBA8 + dimensions). `bakeSvgToMsdf` / `bakeSvgToMsdfLayered` add Three.js `Texture` construction on top. Don't import Three from anywhere on the rasterize path.
- **`async`/promise discipline in materials.** `applyMsdfNodes` installs `Object.defineProperty` accessors for `color`, `map`, `opacity`, `threshold`, `lineHalfWidth`, `tiling`, `uvOffset`. R3F treats prop names as direct setters, so renaming any of these is a breaking change for users.
- **SVG support is intentionally partial.** Transforms, gradients, patterns, masks, CSS, and `<text>` are not handled. New element support means new code in both `parseSvg.ts` (geometry emission) and the README's support table.

### Publishing

`bun run pub` builds the library and runs `npm publish --workspace library`. Don't run it without explicit instruction.
