# Relationship label visibility — design

## Problem

On the canvas, every relationship edge renders a label built from its join keys
(`field = field`, or `? = ?` when a key has no fields yet) plus an optional
cardinality badge (e.g. `N:1`). When a user knows a relationship *exists* but
hasn't decided which keys join the two objects yet, the canvas fills up with
`? = ?` placeholders that add noise without adding information.

Users need a way to control which relationship labels are shown — including
hiding them entirely — so the diagram stays readable while keys are still being
worked out.

## Goal

Add a **Relationship labels** view setting with four modes that control what each
edge label displays. The setting is browser-level (persisted in `localStorage`),
applies in both compact and ERD views, and is discoverable + always-visible from
the dock.

## Definitions

- **Set / defined key** — a join key with at least one real field on either side
  (`k.left || k.right`). This matches the existing `usable` filter in
  `components/canvas/edges.ts`.
- **Unset / undefined key** — a key with neither side filled, which renders as
  `? = ?`.
- **Cardinality badge** — the per-edge `N:1`-style badge. It is meta-information
  that rides along with the keys: it shows only when at least one key passes the
  active filter, and hides when no keys are shown.

## Modes

The setting has four mutually exclusive modes. Default is **Show everything**.

| Mode key   | Label (UI)          | Helper text (UI)                                                              |
|------------|---------------------|------------------------------------------------------------------------------|
| `all`      | Show everything     | All join keys and cardinality on every relationship                          |
| `defined`  | Defined keys only   | Show keys and cardinality only where the join is filled in; hide labels that are still blank |
| `undefined`| Undefined keys only | Show only relationships whose keys aren't set yet — spot what's left to define |
| `hidden`   | Hide all labels     | Just the connector lines — no keys, no cardinality                           |

Behaviour per mode, for a single edge:

- `all` — show every key; show cardinality (current behaviour).
- `defined` — show only set keys; if the edge has at least one set key, also show
  cardinality; if it has zero set keys, show nothing (bare line).
- `undefined` — show only unset (`? = ?`) keys; show cardinality only if at least
  one unset key is shown; an edge whose keys are all defined shows nothing.
- `hidden` — never show a label or cardinality; bare connector line only.

**Rule of thumb:** the cardinality badge is visible iff at least one key passes
the active filter.

## Symbols (corner badge)

Each mode has a single-glyph indicator shown always-visible at the top-right of
the Connect dock button, so the active mode is clear without hovering. Glyphs
mirror what appears on the label itself:

| Mode        | Glyph |
|-------------|-------|
| `all`       | `≡`   |
| `defined`   | `=`   |
| `undefined` | `?`   |
| `hidden`    | `⊘`   |

## Interaction

- Hovering the **Connect** dock button for **0.5 s** reveals a flyout menu to the
  right of the dock with the four modes as radio options (label + helper text).
- A hover bridge keeps the flyout open while the cursor travels from the button
  into the menu.
- Clicking the Connect button still activates the Connect tool (unchanged).
  Clicking a menu item selects that mode and persists it; the flyout closes.
- The corner badge updates immediately to the selected mode's glyph.
- The existing Connect tooltip ("Connect (C) — or drag from a node's port")
  continues to work; the flyout supersedes/coexists with it on prolonged hover.

> Placement note: this is conceptually a "view" setting. It lives on the Connect
> button per the product owner's explicit request, not on the ERD-view toggle.

## Persistence

New module `state/relLabels.ts`, mirroring `state/viewMode.ts`:

- `export type RelLabelMode = "all" | "defined" | "undefined" | "hidden";`
- `loadRelLabelMode(): RelLabelMode` — reads `localStorage["mc.relLabels.v1"]`,
  falls back to `"all"` on unknown/missing/error.
- `persistRelLabelMode(mode: RelLabelMode): void` — best-effort write, ignores
  quota/private-mode failures (same try/catch shape as `viewMode`).

## Components & data flow

- **`state/relLabels.ts`** (new) — load/persist + type, as above.
- **`components/canvas/Canvas.tsx`** — hold `relLabelMode` in state initialised
  from `loadRelLabelMode()`; a setter that persists. Pass `relLabelMode` down to
  `Dock` (for the flyout + badge) and into the edge data path so `RelEdge` can
  read it. Mirror the `viewMode` wiring already present.
- **`components/canvas/RelEdge.tsx`** — given the active mode, filter `keys`
  before building the label string, and gate the cardinality badge on whether any
  key remains. The mode reaches the edge via edge `data` (added in `buildRfEdges`)
  so React Flow re-renders edges when it changes.
- **`components/canvas/edges.ts`** — thread `relLabelMode` into edge `data` in
  `buildRfEdges` (both compact and ERD branches) so `RelEdge` receives it.
- **`components/canvas/Dock.tsx`** — add the hover-delay flyout menu and the
  corner badge to the Connect `ToolButton`. New props: `relLabelMode` and
  `onRelLabelModeChange`.

### How the mode reaches RelEdge

`RelEdge` reads its props from edge `data`. Add `relLabelMode` to the `data`
object produced in `buildRfEdges` (both branches), and extend `RelEdgeData` to
include it. This keeps `RelEdge` a pure function of its props and makes React
Flow re-render edges when the mode changes (the edges array is rebuilt on
`relLabelMode` change via the existing effect that depends on view inputs).

### ERD-view interaction

In ERD view, `buildRfEdges` already splits an edge into one RF edge per *set*
key, and falls back to a single edge when there are no set keys. The label
filter in `RelEdge` still applies per rendered edge:

- `defined` — per-key ERD edges (which are by construction set) keep their label;
  the all-unset fallback edge shows nothing.
- `undefined` — per-key ERD edges show nothing; the all-unset fallback edge shows
  its `? = ?` label.
- `hidden` — nothing shows on any ERD edge.

This needs no change to ERD edge *routing* — only label rendering is affected.

## Edge cases

- Edge with zero keys at all: there is nothing for the filter to remove, so the
  cardinality badge shows in every non-hidden mode (`all`/`defined`/`undefined`)
  and is hidden only in `hidden` mode — see the "no keys" branch of
  `showCardinality`. This case is unreachable for canvas-created edges (a new edge
  is seeded with one unset key); it is only reachable via imported OKF data, where
  treating a key-less relationship the same across non-hidden modes is the least
  surprising behavior.
- Unknown/stale `localStorage` value → falls back to `all`.
- Setting changes must re-render existing edges immediately (no reload).

## Testing

- Unit-test `state/relLabels.ts`: load returns `all` for missing/garbage values;
  round-trips each valid mode; persist tolerates a throwing `localStorage`.
- Unit-test the key/cardinality filtering logic (extract a small pure helper,
  e.g. `visibleKeys(keys, mode)` + `showCardinality(keys, mode, cardinality)`, so
  it can be tested without rendering): verify each mode against edges that are
  all-set, all-unset, and mixed.
- Existing edge/render behaviour under default `all` is unchanged.

## Out of scope

- Persisting the setting in the model/OKF bundle or sharing it via link — it is a
  per-browser view preference, not model data.
- Per-edge overrides — the setting is global to the canvas.
- Changing ERD edge routing or how keys anchor to field rows.
