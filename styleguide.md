# Styleguide

## Current UI direction

Last updated: 2026-09-23

### Summary

“Signal Noir” is the shared visual system across every workspace: warm graphite, elevated charcoal, soft ivory typography, vivid signal red, bronze hairlines, and a fine analog grain. It should feel like a cinematic operating room for research and work—tactile, focused, and authored rather than like a generic productivity dashboard.

### Palette

- Source: custom palette derived from Charcoal & Ember and the Signal Room reference
- Colors: graphite `hsl(40 4% 8%)`, panel `hsl(40 4% 11%)`, ivory `hsl(44 28% 94%)`, signal red `hsl(7 100% 60%)`, bronze `hsl(34 11% 38%)`
- Usage:
  - Background: warm near-black graphite with very restrained radial light
  - Foreground: soft ivory, never pure white
  - Panels: shallow charcoal steps separated by bronze-gray rules
  - Accent: signal red only for active navigation, primary actions, live states, and focal words

### Typography

- Preset: space-grotesk-dm-sans
- Display: Space Grotesk 560–650 with tight tracking
- Body: DM Sans 400/500 with 1.55 line height
- Rules: tabular numerals for counts; uppercase micro-labels; no decorative serif

### Layout

- Archetype: cinematic editorial shell containing each page’s established dashboard, magazine, or asymmetric workspace
- Structure: shared 1440px command-room chrome; page-specific information architecture remains intact
- Grid: existing page grids with 20–44px gutters and consistent edge alignment
- Density: compact metadata, large declarative headings, generous section separation
- Responsive behavior: navigation becomes horizontally scrollable; page rails stack or become sheets at existing breakpoints

### Components

- Radius: 4–8px controls; large content surfaces remain square
- Borders: 1px bronze-gray hairlines
- Shadows: absent except search panels, media stages, and off-canvas sheets
- Buttons: signal-red primary, transparent outlined secondary
- Cards / panels: charcoal-on-graphite with rules rather than floating cards
- Navigation: uppercase wordmark, red instrument mark, plain-text tabs, red active underline, live beacon

### Motion

- Intensity: restrained
- Preferred patterns: short staggered evidence reveal, 160ms hover shifts, one restrained loading spin
- Avoid: bouncing, parallax, ambient floating blobs

### Implementation notes

- Use CSS variables for every color and shadow.
- The global Signal Noir palette supersedes older page-specific light palettes; page-specific layouts and interaction patterns remain authoritative.
- Preserve each workspace’s hierarchy and reading order.
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

## Page-specific direction: Hacker News

Last updated: 2026-09-23

“Founder Wire” is an editorial startup-intelligence desk: warm newsprint, near-black ink, Hacker News orange, and a restrained market-green watchlist signal. It should read like an operator’s morning paper rather than a generic analytics dashboard.

- Layout: magazine lead story, dense chronological feed, and a narrow most-discussed/watchlist rail
- Typography: Space Grotesk for headlines and momentum numbers, DM Sans for metadata and controls
- Components: sharp hairlines, 0–3px radii, no decorative shadows, compact uppercase labels
- Motion: short feed reveals and one restrained refresh spin; no ambient effects
