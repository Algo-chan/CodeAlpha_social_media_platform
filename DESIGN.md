# Design System & Token Vocabulary: Mini Social Media Platform

## 1. Aesthetic Direction: Adaptive Modern Slate
A high-contrast, editorial-grade interface that eschews generic AI templates (no warm cream Anthropic clones, no generic purple gradients, no cluttered micro-cards). Built for high-legibility social browsing in both light and dark environments.

## 2. Color Palette & Semantic Tokens

### Light Theme
- `--bg-canvas`: `#f8fafc` (Slate 50 — clean, distraction-free backdrop)
- `--bg-surface`: `#ffffff` (Pure white card containers)
- `--text-primary`: `#0f172a` (Slate 900 — high contrast header/body text)
- `--text-secondary`: `#475569` (Slate 600 — timestamps, handles, meta labels)
- `--border-subtle`: `#e2e8f0` (Slate 200 — crisp hairline borders)
- `--accent-primary`: `#2563eb` (Blue 600 — interactive buttons, active tab indicators)
- `--accent-heart`: `#e11d48` (Rose 600 — like button active state)

### Dark Theme
- `--bg-canvas`: `#090d16` (Deep slate midnight)
- `--bg-surface`: `#111827` (Rich slate card surface)
- `--text-primary`: `#f8fafc` (Slate 50 — bright legible text)
- `--text-secondary`: `#94a3b8` (Slate 400 — muted details)
- `--border-subtle`: `#1f2937` (Slate 800)
- `--accent-primary`: `#38bdf8` (Sky 400 — vibrant accent against dark backdrop)
- `--accent-heart`: `#fb7185` (Rose 400)

## 3. Typography & Hierarchy
- **Typeface:** System UI font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`) — zero CDN latency, rock-solid font rendering across OS.
- **Scale:**
  - Page/Section Title: `1.5rem` (24px), font-weight `700`, line-height `1.25`
  - Post Body: `1rem` (16px), font-weight `400`, line-height `1.5`
  - Metadata / Handles: `0.875rem` (14px), font-weight `500`
  - Badges / Timestamps: `0.75rem` (12px), font-weight `500`

## 4. Layout & Spacing
- **Max Feed Width:** `640px` centered column for optimal reading line length (<75 characters).
- **Navbar:** Sticky top bar `56px` height with backdrop blur (`backdrop-filter: blur(12px)`).
- **Post Card:** Clean unified border, 12px border radius, subtle hover feedback without excessive drop shadows.
- **Media Previews:** Aspect-ratio locked, rounded corners (`8px`), responsive image fitting (`object-fit: cover`).

## 5. Micro-interactions & States
- **Heart Toggle:** Instant optimistic color fill with subtle scale spring (`transform: scale(1.15)` on click).
- **Tabs:** Clear active underline bar with smooth transition.
- **Empty & Error States:** Clear human instructions with immediate call-to-action (e.g., "No posts in your following feed yet — explore creators on the Explore tab").
