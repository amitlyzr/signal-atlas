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

## Page-specific direction: YouTube

Last updated: 2026-09-22

### Summary

“Signal Room” is a cinematic music-discovery space: warm graphite, soft ivory, vivid signal red, and editorial recording-room composition. It should feel tactile, curated, and immediate rather than like a neon software dashboard.

### Palette and typography

- Colors: warm near-black graphite, elevated charcoal panels, signal red-orange controls, muted bronze rules, soft ivory text
- Display and data: Space Grotesk with tight tracking and tabular counters
- Body: DM Sans with compact metadata and uppercase technical labels

### Layout and components

- Oversized two-line statement hero followed by a 2/3 cinematic player and 1/3 selected-track dossier
- Search is a single full-width signal bar; supporting results live in a three-column editorial library
- Radius: 0–9px, with square player and library surfaces
- Borders: muted bronze hairlines; shadows are nearly absent except beneath the featured player
- Motion: one short result reveal and restrained image hover; respect reduced-motion preferences

## Page-specific direction: Gmail

Last updated: 2026-09-22

### Summary

“Correspondence Desk” is a calm editorial mail workspace: warm paper, charcoal ink, muted sage organization, and a single vermilion action color. Message content dominates while mailbox controls remain compact and quiet.

### Layout and components

- Three-part desktop desk: 205px mailbox rail, dense 430px message list, and flexible reading pane
- Reader becomes an off-canvas sheet below 1080px; mailbox controls become horizontally scrollable on phones
- Space Grotesk carries subjects and counts; DM Sans handles bodies and metadata
- Radius: 5–10px controls, circular sender marks, square desk panels
- Motion: short message-list reveal and sheet transition only

## Page-specific direction: Google Sheets

Last updated: 2026-09-23

“Ledger Field” is a precise spreadsheet workspace built from warm paper, charcoal, spreadsheet green, and pale mint. A full-width editable grid dominates the surface, with compact connection, range, save, append, and creation controls.

- Layout: connection bar, then a sticky-header grid with horizontal and vertical scrolling
- Radius: 4–8px controls; square grid and workspace panels
- Motion: reserved for loading and modal transitions

## Page-specific direction: arXiv

Last updated: 2026-09-23

“Paper Index” is an academic research desk using bone, oxblood, ink, and muted blue-gray. Results read like a considered bibliographic index rather than generic search cards.

- Layout: compact desk-mode rail, abstract index, and generous paper-detail pane
- Typography: Space Grotesk for paper hierarchy, DM Sans for abstracts and metadata
- Detail pane becomes an off-canvas reading sheet on smaller screens
