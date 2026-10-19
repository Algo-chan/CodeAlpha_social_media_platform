# Design system: CodeAlpha Social

This documents the frontend design system as implemented in `public/css/variables.css`
and `public/css/style.css`. Update this file when the tokens change.

## 1. Aesthetic direction

An editorial feed. One narrow reading column, generous whitespace, cards that read
like printed items on a page, and a single warm accent used only where an action is
available. No gradients, no glassmorphism, no drop shadows on resting cards, no
icon CDN — every icon is inline SVG in `public/js/icons.js`.

The internal name for this direction is **Circulation**. It is a design-system label,
not the product name; the product is CodeAlpha.

## 2. Color palette and semantic tokens

Both themes define the same token names, so components never branch on theme.

### Light theme (paper)

| Token | Value | Use |
| --- | --- | --- |
| `--bg-canvas` | `#f6f7f9` | Page background |
| `--bg-surface` | `#ffffff` | Cards, navbar, inputs |
| `--text-primary` | `#12161f` | Body and headings |
| `--text-secondary` | `#4d5566` | Timestamps, handles, meta |
| `--border-subtle` | `#e4e7ec` | Hairline separators |
| `--accent-primary` | `#cf3f31` | Primary buttons, active tab, focus |
| `--accent-heart` | `#cf3f31` | Active like |

### Dark theme (warm near-black)

| Token | Value | Use |
| --- | --- | --- |
| `--bg-canvas` | `#0d0f14` | Page background |
| `--bg-surface` | `#14171e` | Cards, navbar, inputs |
| `--text-primary` | `#f4f5f7` | Body and headings |
| `--text-secondary` | `#a3abbb` | Timestamps, handles, meta |
| `--border-subtle` | `#232833` | Hairline separators |
| `--accent-primary` | `#ff6a58` | Primary buttons, active tab, focus |
| `--accent-heart` | `#ff6a58` | Active like |

Dark is the default when the operating system prefers dark and no theme has been
chosen. A `prefers-color-scheme: dark` block mirrors the dark tokens so the page
renders correctly before JavaScript runs.

Status colors (`--accent-danger`, `--accent-success`, `--accent-info`) each ship with
a `-bg` companion for tinted surfaces. Contrast was measured in a real browser and is
recorded in section 7.

## 3. Typography

System font stack only: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
Helvetica, Arial, sans-serif`. No web font, so there is no render-blocking request.

| Role | Size | Weight |
| --- | --- | --- |
| Page title | `1.5rem` / 24px | 700 |
| Section title | `1.125rem` / 18px | 600 |
| Post body | `1rem` / 16px | 400 |
| Meta, handles | `0.875rem` / 14px | 500 |
| Timestamps, labels | `0.75rem` / 12px | 500 |

Body text is never smaller than 16px. Inputs are also 16px so mobile Safari does not
zoom the page on focus.

## 4. Layout

- Main column: `640px` maximum, centered. Measured rendered width is 640px desktop
  and full-bleed minus gutters on mobile.
- Navbar: sticky, 56px tall, `z-index: 100`, translucent surface with a blur.
- Post card: 1px border, `--radius-lg`, 12px padding, no resting shadow.
- Radius scale is deliberately small (`--radius-sm` 6px, `--radius-md` 8px,
  `--radius-lg` 12px). Fully round is reserved for avatars and icon buttons.
- Spacing is a 4px-based scale (`--space-1` through `--space-12`).

## 5. Motion

Motion is defined by tokens, not per component:

- Durations: `--duration-instant` 90ms, `--duration-fast` 150ms,
  `--duration-normal` 220ms, `--duration-slow` 320ms.
- Easing: `--ease-out` for entrances, `--ease-in-out` for state changes,
  `--ease-spring` for the like pop.
- What animates: view entrances (160ms fade + short rise), post and comment card
  entrances, the like pop, toasts, drawers, skeletons (shimmer), and button press
  feedback (`scale(0.97)` on active).
- What does not animate: layout properties. Only `opacity`, `transform`, and
  `background-color` are transitioned, so animation stays off the layout path.
- Reduced motion: `prefers-reduced-motion: reduce` collapses transitions and
  iterations and replaces movement with a 160ms fade. This is verified in the
  browser, not assumed.

## 6. Interaction states

Every interactive element defines hover, active, focus-visible, and disabled. Focus
uses a two-ring outline (`--focus-ring`) that stays visible on both themes. The like
button carries `aria-pressed`; the comments button carries `aria-expanded`; tabs carry
`aria-selected`. Touch controls get a 44px minimum target under 720px.

## 7. Measured results

Recorded in headless Chrome against a running server (`scripts/verify-ui.js`,
`scripts/verify-edge.js`):

| Check | Result |
| --- | --- |
| Contrast, body text on canvas (both themes) | 17.57:1 |
| Contrast, secondary meta text | 4.75:1 |
| Contrast, link text | 6.80:1 |
| Contrast, primary button label | 6.81:1 |
| Horizontal overflow, 1440 / 768 / 390 / 320px | none (0 or negative) |
| Mobile controls under 44px tall | none, except the 40px remove-media icon button |

## 8. Accessibility floor

- Semantic landmarks: `header`, `nav`, `main`, and labelled `section`s.
- A skip link to `#main-content` is the first focusable element.
- One `h1` per view; headings descend without skipping levels.
- The document `lang` is set and the title reflects the current route.
- Comment drawers are toggled with `hidden` and expose state through `aria-expanded`.
- All attached images carry `alt` text; decorative SVGs are `aria-hidden`.
