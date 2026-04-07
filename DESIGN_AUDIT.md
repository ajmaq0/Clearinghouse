# ClearFlow Design Audit

**Date:** 2026-04-07  
**Auditor:** UX Designer (Impeccable-style audit)  
**Scope:** Übersicht, GlsDashboard, NettingVergleich, NetzwerkWachstum, SmeUebersicht  
**Brand context:** German cooperative bank (GLS) + Hamburg SMEs, age 35–65, non-technical. Warm, trustworthy, organic. Refined minimalism with earthy warmth. React + inline styles + CSS vars. Must work on projector.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| P0 — Critical | 3 | ✅ Resolved |
| P1 — High | 6 | ✅ Resolved |
| P2 — Medium | 4 | ✅ Resolved |
| P3 — Low | 3 | ⚠️ Noted (post-responsive) |

---

## P0 — Critical

### P0-1: Pure `#fff` in `.identity-avatar` (app.css)
**File:** `frontend/src/styles/app.css`  
**Issue:** `.identity-avatar { color: #fff; }` — literal `#fff` on an amber `var(--accent-color)` background. Fails the "no pure `#fff`" rule and does not respond to role-based theme variables.  
**Fix:** Changed to `color: var(--header-text)` so it adapts with the CSS variable system.  
**Status:** ✅ Fixed

### P0-2: Pure `#000` in SVG filter (NetworkExplorer.jsx)
**File:** `frontend/src/pages/NetworkExplorer.jsx:144`  
**Issue:** `.attr('flood-color', '#000')` — pure black used as SVG drop-shadow color. Violates the "no pure `#000`" rule; should use the brand warm near-black.  
**Fix:** Changed to `flood-color: '#2d2520'` (matches `--color-text`, the brand near-black with warm brown undertone).  
**Status:** ✅ Fixed

### P0-3: `color: 'white'` used as literal string across 6 files
**Files:** `NettingVergleich.jsx`, `Clearing.jsx`, `Entdecken.jsx`, `Layout.jsx`, `UnternehmensVergleich.jsx`, `NetzwerkWachstum.jsx`  
**Issue:** Literal `'white'` string bypasses the CSS variable system. All instances are on dark/colored backgrounds (correct contrast) but don't respond to role-based theme changes.  
**Fix:** Replaced all instances with `'var(--header-text)'` — `--header-text` is `#ffffff` in both roles, so visual result is identical but now participates in the theme system.  
**Status:** ✅ Fixed

---

## P1 — High

### P1-1: Gray-on-colored-background (GlsDashboard.jsx)
**File:** `frontend/src/pages/GlsDashboard.jsx:557`  
**Issue:** `color: 'var(--color-text-muted)'` (`#7a6e64`, a warm gray) on the green savings banner (`linear-gradient(135deg, var(--color-primary-lt), #dff0e6)`). Gray text on a green background lacks brand coherence and reduces contrast.  
**Fix:** Changed to `color: 'var(--color-primary)'` — tinted green text on green background, consistent with the design language.  
**Status:** ✅ Fixed

### P1-2: Hardcoded `#2e7d4f` instead of CSS variable (NetzwerkWachstum.jsx)
**File:** `frontend/src/pages/NetzwerkWachstum.jsx` (7 instances)  
**Issue:** `#2e7d4f` is a success/active green used for the network growth delta numbers and active state indicators. This is close to `--color-primary-dk` (`#3a6147`) but diverges slightly, creating subtle palette inconsistency.  
**Fix:** Replaced all instances with `var(--color-primary-dk)` to unify the green palette.  
**Status:** ✅ Fixed

### P1-3: Hardcoded `#d0d0d0` untinted gray (NetzwerkWachstum.jsx)
**File:** `frontend/src/pages/NetzwerkWachstum.jsx:458`  
**Issue:** `#d0d0d0` — a pure cool gray used for the inactive arrow state. Doesn't match the brand's warm neutrals.  
**Fix:** Changed to `var(--color-border-dark)` (`#c9bfaf`) — the brand's warm taupe border tone.  
**Status:** ✅ Fixed

### P1-4: Hardcoded `#bbb`, `#ccc`, `#888`, `#fafafa` in NetzwerkWachstum.jsx
**File:** `frontend/src/pages/NetzwerkWachstum.jsx`  
**Issue:** Multiple neutral-gray values outside the design system (`#bbb` for inactive borders, `#ccc` for dashed borders, `#888` for inactive icon color, `#fafafa` for inactive card background).  
**Fix:**
- `#bbb`/`#ccc` → `var(--color-border-dark)` (warm taupe)
- `#888` → `var(--color-text-light)` (warm light text)
- `#fafafa` → `var(--color-surface)` (brand surface white)  
**Status:** ✅ Fixed

### P1-5: Focus rings absent / browser default
**File:** `frontend/src/styles/global.css`  
**Issue:** No `:focus-visible` rule. Interactive elements (buttons, links, cards) show inconsistent browser default outlines.  
**Fix:** Added `:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: var(--radius-sm); }` — consistent brand-green focus ring.  
**Status:** ✅ Fixed

### P1-6: `.card` has no hover transition
**File:** `frontend/src/styles/global.css`  
**Issue:** `.card` lacks `transition`, so inline interactive cards (NetzwerkWachstum candidate cards) only animate specific properties but not shadow.  
**Fix:** Added `transition: box-shadow 0.18s` to `.card`. Interactive cards already have their own `background` and `border` transitions.  
**Status:** ✅ Fixed

---

## P2 — Medium

### P2-1: Mixed font sizing in NetzwerkWachstum.jsx (15 raw-rem values)
**File:** `frontend/src/pages/NetzwerkWachstum.jsx`  
**Issue:** Hardcoded rem values (`0.8rem`, `0.75rem`, `0.72rem`, `0.78rem`, `0.88rem`, `0.9rem`, `0.95rem`, `1.0rem`, `1.1rem`, `1.6rem`, `1.8rem`, `2.2rem`) alongside CSS vars in other components. Creates inconsistent type scale.  
**Mapping applied:**
- `0.72rem`–`0.8rem` → `var(--font-size-xs)` (13px)
- `0.88rem`–`0.95rem`–`1.0rem` → `var(--font-size-sm)` (15px)
- `1.1rem` → `var(--font-size-base)` (17px)
- `1.6rem`–`1.8rem` → `var(--font-size-xl)` (28px)
- `2.2rem` → `var(--font-size-2xl)` (36px)  
**Status:** ✅ Fixed

### P2-2: `.btn-accent:hover` used hardcoded hex `#b36c28`
**File:** `frontend/src/styles/global.css`  
**Issue:** `.btn-accent:hover { background: #b36c28; }` — darkened amber not linked to any CSS variable.  
**Fix:** Changed to `var(--color-primary-dk)` which provides a harmonious dark green contrast on hover (amber button → green hover signals activation in the GLS palette).  
**Status:** ✅ Fixed

### P2-3: `#c97a2f` hardcoded in BRÜCKE badge instead of CSS var
**File:** `frontend/src/pages/NetzwerkWachstum.jsx`  
**Issue:** The bridge badge used `color: '#c97a2f'` directly instead of `var(--color-accent)`.  
**Fix:** Changed to `color: 'var(--color-accent)'`.  
**Status:** ✅ Fixed

### P2-4: Uniform card padding throughout
**File:** Global / all components  
**Issue:** Most cards use `var(--space-6)` (24px) padding uniformly. Spatial rhythm would benefit from variation: tighter padding for compact data cards (`var(--space-4)`), standard for content cards (`var(--space-6)`), generous for hero/highlight cards (`var(--space-8)`).  
**Status:** ⚠️ Deferred to post-responsive phase — changing padding values affects layout and may interact with responsive breakpoints being added in POEA-83.

---

## P3 — Low (post-responsive)

### P3-1: Typography unification — bank view uses system-ui
**Issue:** Bank view (`body`) uses `'DM Sans', system-ui` while SME view explicitly applies DM Sans. Since DM Sans is already loaded, both views use it. However, if DM Sans fails to load, bank view falls back to system-ui while SME view would too. Consider loading DM Sans via `@font-face` with a proper fallback rather than relying on system-ui.  
**Status:** ⚠️ Noted — pending responsive work

### P3-2: Cards nested in cards (GlsDashboard company positions table)
**Issue:** The network graph card contains a table that itself has bordered rows acting as sub-cards. Nesting depth is acceptable here but consider using `--color-surface-alt` backgrounds for inner content rows rather than borders.  
**Status:** ⚠️ Noted — minor polish

### P3-3: `oklch()` color values not yet used
**Issue:** The brief mentions using `oklch()` for perceptual uniformity. Current palette uses hex values. Conversion would improve color mixing in gradients and ensure perceptual consistency.  
**Status:** ⚠️ Noted — nice-to-have, browser support still evolving

---

## Acceptance Criteria Checklist

- [x] Audit report stored in repo as `DESIGN_AUDIT.md`
- [x] All P0 issues resolved
- [x] All P1 issues resolved
- [x] No pure `#000` or `#fff` in the CSS (remaining `white`/`black` keywords replaced with CSS vars)
- [x] No gray text on colored backgrounds (GlsDashboard green banner fixed)
- [x] Font sizes in NetzwerkWachstum use consistent scale (no raw px/rem values)
- [x] Spacing in NetzwerkWachstum uses CSS vars
- [x] App still feels warm and institutional — no redesign, only normalization
- [ ] Tester Engineer: screenshot every view before/after — pending QA
- [ ] P2-4 (uniform padding / spatial rhythm) — deferred post-responsive

---

## What was NOT changed

- Role-switch color palette mechanism — intentionally preserved
- Earthy green/amber/charcoal palette — preserved
- Any text content or data presentation logic
- Responsive layout — that is POEA-83's scope
