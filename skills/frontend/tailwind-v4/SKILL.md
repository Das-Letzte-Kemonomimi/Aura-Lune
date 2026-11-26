---
name: tailwind-v4
description: 'Styling Aura-Lune React components with Tailwind CSS v4: theme tokens, the rem/em type and spacing scales, cn(), the ui/ primitives, and when an inline style is still right. Use when writing or migrating any className/style in src/.'
metadata:
  namespace: frontend
---
# Tailwind v4 in Aura-Lune

Distilled from wshobson `tailwind-design-system`, the ofershap/asyrafhussin `tailwind-best-practices` skills and the official v4 docs, adapted to this app's runtime theme engine.

## Where things live

| File | Holds |
|---|---|
| `src/index.css` | Entry: imports Tailwind and the partials below. No rules of its own. |
| `src/styles/theme.css` | `:root` runtime theme defaults, `@theme inline` colour/shadow bridge, `@theme` scales, keyframes |
| `src/styles/base.css` | `@layer base`: element defaults (body, range, select, buttons, scrollbars) |
| `src/styles/utilities.css` | `@utility` patterns: `glass-panel`, `glass-card`, `label-caps`, `bg-accent-gradient`, `range-fill`, `bg-modal`, … |
| `src/styles/legacy.css` | Transitional rules for not-yet-migrated components. Never add to it. |
| `src/utils/cn.ts` | `cn()` = `clsx` + project-aware `tailwind-merge` |
| `src/components/ui/` | `Button`, `ModalShell`/`ModalHeader`, `Callout`, `Badge`, `SettingRow`, `Input`/`FieldLabel` |

There is no `tailwind.config.*`, and never `@tailwind` directives: v4 is configured in CSS.

## Tokens (use these, not hex)

The theme engine (`useThemeManager`) rewrites `--bg-*`, `--accent-*`, `--text-*` on `<html>` at runtime. Utilities read them live through `@theme inline`:

- Surfaces: `bg-deep` `bg-surface` `bg-surface-hover` `bg-card`
- Borders: `border-line` (subtle) `border-line-accent`
- Text: `text-fg` `text-fg-secondary` `text-fg-muted`
- Accents: `{bg,text,border,…}-accent-{pink,purple,cyan,green,amber}`; fixed `accent-red`, `on-accent` (white on fills)
- Shadows: `shadow-panel` `shadow-accent-glow` `shadow-brand` `shadow-brand-glow` `shadow-modal`
- Fonts: `font-sans` (Outfit, the default) `font-mono` (JetBrains Mono)

Tints use slash opacity: `bg-accent-pink/15`, `border-accent-cyan/35`. This compiles to `color-mix()` on the live theme colour, so **never** write `rgba(244,63,94,0.15)`: that freezes the default theme. Opacity steps are multiples of 5.

Colours outside the theme come from Tailwind's default palette (`text-slate-300`, `text-sky-400`), never hex. A recurring new colour role becomes a token in `theme.css`.

## Scales: rem/em only

- **Spacing/sizing** (`p- m- gap- inset- w- h- size- max-w-`): Tailwind's `--spacing: 0.25rem` scale in 0.5 steps (`p-1.5` = 0.375rem). Odd pixel values from old code snap to the even step their siblings use. Large fixed widths use the same scale (`w-70` = 17.5rem) or container tokens (`max-w-md`).
- **Font size** (the `--text-*` namespace is replaced; no step carries a line-height):

  | `text-2xs` | `text-xxs` | `text-xs` | `text-ui` | `text-sm` | `text-md` | `text-base` | `text-lg` | `text-xl` | `text-2xl` | `text-3xl` | `text-4xl` | `text-5xl` |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | 0.625 | 0.6875 | 0.75 | 0.8125 | 0.875 | 0.9375 | 1 | 1.125 | 1.25 | 1.5 | 1.875 | 2.25 | 3 rem |

  `text-ui` (0.8125rem) is the default control/body size.
- **Line height**: inherited `normal` unless set; use `leading-tight|snug|normal|relaxed` (unitless).
- **Letter spacing**: `tracking-wide` (0.025em), `tracking-wider` (0.05em), `tracking-label` (0.08em), `tracking-widest` (0.1em).
- **Radius**: Tailwind defaults: `rounded-sm` 4px, `md` 6px, `lg` 8px, `xl` 12px, `2xl` 16px, `3xl` 24px, `full`. 10px → `xl`; 14px → `2xl`.
- **z-index** (bare numbers): `z-30` dock, `z-40` drawer, `z-50` overlay, `z-60` modal, `z-70` nested modal, `z-80` command palette, `z-90` toast, `z-100` fatal.
- **Breakpoints**: header collapse points `max-nav:` (84.375rem), `max-brand:` (105rem), `max-actions:` (113.75rem).
- `px` only where nothing else makes sense: 1–2px borders/hairlines, shadow and blur offsets inside tokens, canvas maths in TS.

## Class composition

- Merge with `cn(...)` whenever classes are conditional or a component accepts `className` (the caller's classes go last and win).
- **Never build class names from strings** (`` `bg-accent-${tone}` ``): Tailwind only generates classes it finds as complete literals. Use a lookup map of full class strings (see `components/ui/tones.ts`).
- Order inside a class string: layout/position → display/flex/grid → box/size/spacing → typography → visuals (bg/border/shadow) → effects/transitions → state variants → responsive variants.
- v4 syntax: `bg-linear-to-r` (not `bg-gradient-to-r`), `bg-black/50` (not `bg-opacity-*`), `flex!` (suffix important), `w-(--fill)` for a CSS variable, underscores for spaces in arbitrary values.
- No arbitrary values (`w-[280px]`, `text-[13px]`) when a scale step exists. The few legitimate ones (e.g. `max-h-[90vh]`) stay viewport-based, never pixel-based.

## Static classes, dynamic inline style

- Anything known at build time is a class.
- Values computed at runtime stay in `style`, one property each: live progress `%`, transforms driven by playback, canvas sizes, drag positions, a colour that belongs to a data item (stem, EQ band, chord, theme swatch).
- When a runtime value feeds several rules or a pseudo-state, pass it as a CSS variable and read it in classes: `style={{ '--fill': `${pct}%` }}` + `range-fill`, or `style={{ '--badge': color }}` + `hover:border-(--badge)`.

## States are variants, not JavaScript

- Hover/focus/press: `hover:` `focus-visible:` `active:`. Never mutate `e.currentTarget.style` in mouse handlers.
- Selected/toggled: put the state in an attribute and style it: `aria-pressed:` `aria-selected:` `aria-expanded:` `data-[active=true]:`. One source of truth for screen readers and visuals.
- Parent-driven: `group` + `group-hover:`.
- Disabled: `disabled:`; the base layer already dims disabled buttons.
- Entrance animations: `motion-safe:animate-fade-in|fade-in-scale|modal-in|osd-pop`.

## Primitives

- `Button` (`variant`: primary | secondary | ghost | danger | chip; `size`: sm | md | icon). Defaults to `type="button"`: pass `type="submit"` for a form's submit button. `chip` reads `aria-pressed`.
- `ModalShell` (backdrop, dialog semantics, Escape and backdrop close, `size` sm…2xl, `layer` modal | nested | palette) + `ModalHeader` (icon tile with `tone`, title, subtitle, actions, close; `bar` for the divider-bar layout). Pass the same id to `ModalHeader titleId` and `ModalShell labelledBy`.
- `Callout tone`, `Badge tone`, `SettingRow title description`, `Input` / `inputClass` / `FieldLabel`, and the existing `common/ToggleSwitch`.
- Extract a new primitive only for a pattern repeated at least five times; otherwise use plain classes, or an `@utility` when it is used at least three times.

## Preflight notes

Tailwind's preflight is active. `base.css` restores UA heading sizes, list markers and inline media so unmigrated markup keeps its look; give migrated headings, lists and images explicit classes anyway. Default border colour is `currentColor`, so always pair `border` with `border-line*` or another colour.

## Checklist for a migrated file

1. No `style={{…}}` holding only static values; no `currentTarget.style`.
2. No hex/rgba that duplicates a token; no `var(--…)` in TSX except a runtime variable passed in.
3. Font sizes, spacing and radii on the scales above; no px arbitrary values.
4. DOM structure, roles, aria attributes and test ids unchanged (or improved).
5. `npm run lint && npm run typecheck && npm test`, and compare the screen visually.
