# Frontend re-engineering report

Scope: the `public/` client of CodeAlpha Social (vanilla-JS SPA served by Express).
Backend, API contracts, and auth boundaries were left untouched.

## 1. What was wrong before

The old frontend worked but read as a first draft:

- **One accent for everything.** Blue primary, rose hearts, and a cold slate palette
  gave the page no point of view. Light and dark themes shared almost no token names.
- **Emoji as icons.** Hearts, comment bubbles, and the banner sparkle were emoji, so
  they rendered differently on every platform and ignored the theme's text color.
- **No loading state.** Every fetch showed a bare "Loading..." string, so the feed
  flashed empty on each tab switch.
- **Silent failures.** Feed and profile errors surfaced as a raw message in the same
  spot the content should be, with no retry.
- **Dead-end empty states.** "Nothing here" with no next step.
- **Views toggled with inline `display`.** This fought the stylesheet, broke
  `hidden`, and meant screen readers could reach controls in inactive views.
- **Small touch targets.** Nav icons and buttons were 24 to 36px, below the 44px
  minimum, and inputs were under 16px so iOS zoomed the page.
- **Motion by default, everywhere.** Transitions ran on layout properties, ran
  identically for everyone, and ignored `prefers-reduced-motion`.
- **Copystyle drift.** Messages mixed "Error!", "Loading...", and "Oops", with vague
  wording like "Something went wrong" and no hint of what to do next.

## 2. Design direction

**Circulation**, an editorial feed. One 640px reading column, cards that read like
printed items, a single warm vermilion accent (`#cf3f31` light, `#ff6a58` dark) used
only where an action is available, and restrained 6 to 12px radii. No gradients, no
glassmorphism, no resting shadows, no font CDN. Both themes share the same token
names so nothing branches on theme in component code. Full token reference is in
`DESIGN.md`.

## 3. Pages and components re-engineered

| File | What changed |
| --- | --- |
| `public/index.html` | Semantic landmarks, skip link, inline SVG icons, `hidden`-based drawers, correct heading order, 16px inputs, meta description and theme-color |
| `public/css/variables.css` | Rewritten token system: surfaces, text, borders, accents with hover/active/subtle variants, focus ring, shadows, skeletons, motion durations and easings, both themes plus a no-JS media query |
| `public/css/style.css` | Rewritten stylesheet in 15 sections; composite-only transitions, skeleton shimmer, empty/error states, toasts, reduced-motion block, and a touch-target pass under 720px |
| `public/js/icons.js` (new) | Inline SVG icon set with an `svg(name, opts)` helper. Zero CDN dependency |
| `public/js/api.js` | Toast with enter/leave transitions, pause-on-hover, and a close button; normalized error messages; `clearAuth` dispatches `auth:expired` |
| `public/js/router.js` | `hidden`-based view switching, active nav and tab state, route-driven document title, profile route parsing |
| `public/js/theme.js` | Toggle swaps sun/moon icons and updates `theme-color`; respects stored then OS preference |
| `public/js/app.js` | Wires the router to views, keeps the navbar in sync, auto-grows the composer, handles logout and `auth:expired` |
| `public/js/components/feed.js` | Skeleton loading, four distinct empty states with real actions, feed error state with working retry, composer with counter and image preview |
| `public/js/components/postCard.js` | Accessible like toggle (`aria-pressed`, optimistic with rollback), comment drawer (`aria-expanded`), relative timestamps with an absolute `title`, delete with a fade-out |
| `public/js/components/authView.js` | Field-level validation instead of one toast, loading labels, redirect back to the gated action, inline SVG banner icon |
| `public/js/components/profileView.js` | Profile header with stats, optimistic follow, inline editor with a live bio counter, skeleton while loading, unknown-user state |

## 4. Interactions and animation

- View entrances: 160ms fade with a short rise, staggered for the first four cards.
- Like: optimistic flip with a spring pop on the heart, rolled back on failure.
- Comments: drawer opens with a 220ms slide-and-fade; new comments fade in.
- Toasts: slide in, pause their dismiss timer on hover, slide out.
- Skeletons: `shimmer` background sweep while loading.
- Buttons: `scale(0.97)` on press, transform only.
- Reduced motion drops movement and keeps a 160ms fade, verified in a real browser.

## 5. Verify-it-yourself evidence

Three scripts drive headless Chrome over the DevTools Protocol and print raw numbers.
They are not part of the test suite and make no assertions; they exist so the claims
below can be reproduced.

```
node src/server.js            # in one shell
node scripts/verify-ui.js     # layout, interactions, contrast, a11y
node scripts/verify-edge.js   # error states, touch targets, stress input
node scripts/capture-shots.js # PNG screenshots into your temp dir
```

Measured results:

| Check | Result |
| --- | --- |
| Jest | 131 passed / 131, 13 suites |
| Feed render, all viewports | 9 to 11 posts, skeletons replaced |
| Horizontal overflow at 1440 / 768 / 390 / 320px | none |
| Contrast: body, secondary, link, primary button | 17.57, 4.75, 6.80, 6.81 |
| Mobile controls under 44px tall | none, except the 40px remove-media icon |
| Gated Following as guest | empty state with a sign-up CTA |
| Auth banner on gated redirect | shown, exact copy, register form visible |
| Register to post to like to comment to delete | all round-trip |
| Feed error state | renders with copy and a retry that recovers to 10 posts |
| Unbroken 400-char word at 320px | no overflow |
| Composer over limit | counter negative, over class, submit disabled |
| Rapid triple like | reconciles to a single net change |
| Console errors during the run | none |

## 6. Files changed

Modified: `public/index.html`, `public/css/variables.css`, `public/css/style.css`,
`public/js/api.js`, `public/js/app.js`, `public/js/router.js`, `public/js/theme.js`,
`public/js/components/{feed,postCard,authView,profileView}.js`,
`tests/frontend-core.test.js`, `DESIGN.md`.

Added: `public/js/icons.js`, `scripts/verify-ui.js`, `scripts/verify-edge.js`,
`scripts/probe-touch.js`, `scripts/capture-shots.js`.

One test file changed. `tests/frontend-core.test.js` pinned the old palette hex
values, which the redesign intentionally replaces, so those assertions now pin the
new tokens. No behavioural assertion was weakened.

## 7. Limitations

- I could not view the screenshots with this model. Review
  `ui-*.png` in your temp directory before merging; the layout numbers are verified,
  the taste is not.
- Three test-pinned strings forced compromises: the heart stays an emoji
  (`heart-icon` content), the comment placeholder keeps its `...`, and like buttons
  carry `data-action-btn` instead of an `action-btn` class. The first two are worth
  unpinning; the third is invisible.
- The design-system name "Circulation" is internal only. The product stays CodeAlpha.
- No bundling or minification was added. The client is still plain scripts, which is
  what the static server and CSP expect.
- `scripts/probe-touch.js` was a throwaway diagnostic and can be deleted.

## 8. Suggested next steps

1. Look at the screenshots and adjust the accent or spacing to taste.
2. Relax the three pinned assertions above so the icons can become SVG throughout.
3. Add a focus-management pass: move focus to the view heading after navigation.
4. Convert the comment drawer to a `<dialog>`-free but `inert`-backed panel to trap
   focus while open on mobile.
5. Add a visual regression job that runs `capture-shots.js` and compares hashes.
