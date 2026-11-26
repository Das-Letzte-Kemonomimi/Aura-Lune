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
| `src/styles/utilities.css` | `@layer components` (`glass-panel`, `glass-card`, `label-caps`, `anime-*`: any utility overrides them) and `@utility` helpers (`bg-accent-gradient`, `range-fill`, `bg-modal`, `scrollbar-none`) |
| `src/utils/cn.ts` | `cn()` = `clsx` + project-aware `tailwind-merge` |
| `src/components/ui/` | `ModalShell` (every dialog), `Callout` (tinted info box), `tones.ts` |
| `src/utils/cssVars.ts` | `cssVars()` types runtime `--*` values for `style` |

There is no `tailwind.config.*`, and never `@tailwind` directives: v4 is configured in CSS.

## Tokens (use these, not hex)

The theme engine (`useThemeManager`) rewrites `--bg-*`, `--accent-*`, `--text-*` on `<html>` at runtime. Utilities read them live through `@theme inline`:

- Surfaces: `bg-deep` `bg-surface` `bg-surface-hover` `bg-card`
- Borders: `border-line` (subtle) `border-line-accent`
- Text: `text-fg` `text-fg-secondary` `text-fg-muted`
- Accents: `{bg,text,border,fill,…}-accent-{pink,purple,cyan,green,amber}`; fixed `accent-red`, `on-accent` (white on fills)
- Fixed surfaces/brands: `field` (form controls), `ink`, `discord`, `lastfm`, `listenbrainz`
- Surfaces (fixed): `bg-ink` (deep violet behind dock, drawers, menus), `bg-modal` (dialog gradient), `bg-accent-gradient`
- Shadows: `shadow-panel` `shadow-accent-glow` `shadow-modal` `shadow-drawer` `shadow-dock`, plus a tintable glow scale `shadow-halo-sm|halo|halo-md|halo-lg|halo-xl|halo-2xl` (0.625–2.25rem blur) and `shadow-lift`. Tint by pairing with a shadow colour: `shadow-halo shadow-accent-cyan/40`. Never write `0 0 12px rgba(…)`.
- Text shadow: `text-shadow-soft`, `text-shadow-deep`, `text-shadow-glow` (active lyric)
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
- **z-index** (bare numbers). Inside one component use `z-1`…`z-20`. App layers:

  | z | layer | `ModalShell layer` |
  |---|---|---|
  | 30 | header and its dropdowns | |
  | 40 | bottom dock | |
  | 50 | queue drawer, dock popovers | |
  | 60 | modal | `modal` |
  | 70 | modal over a modal, export badge | `nested` |
  | 80 | onboarding, health check | `system` |
  | 90 | studio workspaces, big screen | `studio` |
  | 100 | tools over a studio | `tool` |
  | 110 | dialog from a tool | `toolDialog` |
  | 120 | command palette, recap, key/BPM, drag-drop, desktop lyrics | `top` |
  | 130 | volume OSD | |
  | 140 | fatal error screen | |

- **Breakpoints**: header collapse points `max-nav:` (84.375rem) and `max-actions:` (113.75rem).
- **Grid tracks** in arbitrary templates use `--spacing(n)`, never px: `grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))]`.
- `px` only where nothing else makes sense: 1–2px borders/hairlines, shadow and blur offsets inside tokens, canvas maths in TS.

## Class composition

- Runtime values that classes read go through `cssVars()` (`utils/cssVars.ts`), which types `--*` names for `style`.
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
- Entrance animations: `motion-safe:animate-fade-in|fade-in-scale|modal-in|osd-pop`; loops: `animate-spin`, `motion-safe:animate-spin-slow|pulse|pulse-drop|bounce-drop|update-dot`.

## Primitives

All primitives live in `components/ui/` (import from `components/ui`). Each takes a `className` that is merged last, so a caller can adjust layout, but never re-style a variant at the call site: if a look is missing, add a variant. **Never hand-write a button, chip, tab bar, field, badge or card class string.**

| Need | Primitive | Variants |
|---|---|---|
| Dialog | `ModalShell` + `ModalHeader` / `ModalBody` / `ModalFooter` | `size` sm·md·lg·xl·2xl·full, `layer`; header `icon`, `tone`, `title`, `subtitle`, `onClose` + `closeLabel` |
| Action | `Button` | `variant` primary·secondary·tinted·danger·ghost, `tone` (tinted), `size` sm·md·lg; `type="button"` by default |
| Icon-only action | `IconButton` | `variant` ghost·secondary, `size` sm·md; **required** `label` (aria-label + tooltip) |
| On/off option | `Chip` | `pressed` (→ `aria-pressed`), `tone`, `size` xs·sm |
| One of many / tab bar | `SegmentedControl` | `items`, `value`, `onChange`, `label`, `tone`, `size`, `fullWidth`; arrow keys, Home, End |
| Surface | `Card` | `variant` panel·card·inset, `padding` none·sm·md·lg, `interactive` |
| Section / setting | `SectionHeader`, `SettingRow` | `icon`, `title`, `description`, `actions` / `control` |
| Field | `TextField`, `TextArea`, `Select`, `FieldLabel` | `size` sm·md, `mono`, `icon` |
| Readout / status | `Badge`, `StatusDot` | `tone` (+ neutral), `size` xs·sm, `mono`; dot `pulse` |
| Slider | `SliderRow`, `NudgeButtons` | `label`, `value`, `min`/`max`/`step`, `format`, `tone`, `nudges` |
| Menu | `Popover` + `MenuItem` | `align` start·end, `side` bottom·top; item `selected` (→ `menuitemradio`) |
| Loading / empty | `Spinner`, `ProgressBar`, `EmptyState` | `size`, `tone`, `label` |
| Info box | `Callout` | `tone` (+ `danger`), `icon` |
| Switch | `common/ToggleSwitch` | the only switch; style comes from the checkbox (`peer-checked:`) |

**States belong to the base layer.** `styles/base.css` gives every button its hover lift, focus outline, press scale, transition and disabled look (opacity .45, no pointer events), and every text field and select its pink focus ring. Never add `transition-*`, `cursor-*`, a disabled opacity, `outline-none`, or `border-0` / `m-0` resets to a button or field.

**Scales of the primitives:**

| Element | Allowed values |
|---|---|
| Radius | `rounded-md` small controls, badges · `rounded-lg` buttons, fields, chips · `rounded-xl` cards, popovers · `rounded-2xl` modals, panels · `rounded-full` round icons, dots |
| Control size | `sm` `px-2.5 py-1 text-xs` · `md` `px-3.5 py-2 text-ui` · `lg` `px-5 py-2.5 text-sm`; weight `font-semibold` |
| Surface alpha | resting `bg-white/5` · hover `bg-white/8` · inset `bg-black/30`; borders `border-line`, emphasis `border-line-accent` |
| Spacing | modal sections `px-6 py-4` · cards `p-4` / `p-5` · section gaps `gap-4` / `gap-6` |

**Tints come only from `ui/tones.ts`**: info box and tinted button `bg-X/15 border-X/35 text-accent-X`; pressed chip `bg-X/20 border-X text-accent-X`; badge `bg-X/20 text-accent-X`. Use the `accent-*` tokens, not raw `pink-500` / `sky-400`. A colour outside the palette that carries meaning gets a named tone in `tones.ts`.

Extract a new primitive only once a pattern repeats at least five times *with the same look*; otherwise use plain classes, or an `@layer components` class when it is used at least three times.

## Preflight notes

Tailwind's preflight is active. `base.css` keeps the app's original defaults on top of it: `line-height: normal`, browser heading sizes/weights, list markers and inline (not block) media. Give new headings, lists and images explicit classes anyway.

## Exceptions that stay inline

- Hand-drawn artwork: the turntable, tape deck and big-screen radial/conic gradients and their inset shadows.
- Values computed at runtime (see above). Default border colour is `currentColor`, so always pair `border` with `border-line*` or another colour.

## Checklist for a migrated file

1. No `style={{…}}` holding only static values; no `currentTarget.style`.
2. No hex/rgba that duplicates a token; no `var(--…)` in TSX except a runtime variable passed in.
3. Font sizes, spacing and radii on the scales above; no px arbitrary values.
4. DOM structure, roles, aria attributes and test ids unchanged (or improved).
5. `npm run lint && npm run typecheck && npm test`, and compare the screen visually.
