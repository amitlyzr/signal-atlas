# Styleguide

## Current UI direction

Last updated: 2026-09-22

### Summary

“Field Notes” is an editorial investigative workspace: warm paper surfaces, precise black typography, restrained ember signals, and dossier-like composition. It should feel authored and analytical, never like a generic SaaS dashboard.

### Palette

- Preset: Paper & Ink, tuned warmer with an ember signal
- Colors: `#f7f4ed`, `#e5e0d5`, `#282724`, `#11110f`, `#d84f2f`
- Usage:
  - Background: warm paper
  - Foreground: softened charcoal
  - Primary: near-black ink
  - Accent: ember only for active, live, or YouTube states

### Typography

- Preset: space-grotesk-dm-sans
- Display: Space Grotesk 560–650 with tight tracking
- Body: DM Sans 400/500 with 1.55 line height
- Rules: tabular numerals for counts; uppercase micro-labels; no decorative serif

### Layout

- Archetype: asymmetric
- Structure: 60/40 evidence canvas and video rail on desktop, stacked on mobile
- Grid: 12 columns, 20–28px gutters, 1240px maximum width
- Density: compact metadata with generous section separation
- Responsive behavior: rail moves below evidence at 900px; micro-stats become a horizontal row

### Components

- Radius: 6–10px
- Borders: 1px ink at low opacity
- Shadows: none except a shallow lifted search panel
- Buttons: near-black primary, outlined secondary, ember active state
- Cards / panels: paper-on-paper with rules rather than floating shadows
- Navigation: wordmark plus status beacon and plain-text actions

### Motion

- Intensity: restrained
- Preferred patterns: one scan-line pass, short staggered evidence reveal, 160ms hover shifts
- Avoid: bouncing, parallax, ambient floating blobs

### Implementation notes

- Use CSS variables for every color and shadow.
- Preserve the asymmetric hierarchy and source-first reading order.
- Avoid raw one-off color utilities and generic gradient decoration.
