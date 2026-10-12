---
name: variant
description: Builds multiple purposeful variants of a UI component and embeds a live switcher to compare and pick one.
---

# Variants

This skill takes one described piece of UI and builds three versions that differ on purpose. They go behind a picker in the real page, so you can flip between them and choose.

It produces candidates and never ranks them.

## Different answers, not different tints

Each variant is a different answer to the same brief, on an axis this collection owns:

| Axis | Owner | What varies |
| --- | --- | --- |
| Structure | `layout` | Grouping, order, column count, what collapses, modal vs sheet vs inline |
| Density | `density` | Spacing scale, compact grid vs spacious flow, how much fits |
| Emphasis | `colors` | Where filled color goes, what recedes, subtle vs bold accents |
| Type | `typography` | Scale steps, weight contrast, measure |
| Voice | `copy` | Labels, tone, concise technical vs descriptive |

Pick **one primary axis** and give each variant a different position on it. The axis names the picker's group heading. Secondary choices follow from it rather than varying on their own. (e.g. A dense variant may need a smaller type step, and that is coherence, not a second axis).

## The floor every variant clears

Every variant must:
- Clear basic accessibility (visible focus, semantic markup, keyboard operable).
- Clear the design system's baseline rules and tokens.
- Maintain full functionality with live Supabase data, mutations, and reactive state.

## Integration & Live Picker

1. Host the variants on the page that will actually contain the piece, with real chrome and realistic data.
2. Select with a URL search param such as `?__variant=compact`, so every variant is a bookmarkable link.
3. Render one variant at a time, full size.
4. Provide a floating or docked switch control on the page to toggle between the variants seamlessly.

## Clean Up

Once a variant is selected:
- Promote the winner into the primary component code.
- Remove the temporary variant harness, floating switcher, and URL search param routing.
