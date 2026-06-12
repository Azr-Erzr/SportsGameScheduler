# Silbo Design Entry — "Channel S" (Mockup Set A)

Last updated: June 13, 2026
Live mockups (open in a browser, no build needed):

- `public/design/home.html` — homepage
- `public/design/schedule.html` — My Schedule
- `public/design/sport-soccer.html` — soccer channel / World Cup capsule
- Shared stylesheet: `public/design/silbo.css`

Territory blend (from the agreed shortlist): **Broadcast Sports 1984 + Ticket Stub /
Program Book + Modern Sport Badges**, keyed to the reference pack's stated bridge: *black
field, glowing broadcast color, city/tournament capsules, big readable type, CRT softness.*

## The Core Idea: the whistle is the soul

**Silbo = whistle.** It is the one object every sport on earth shares, and it's already the
name. The identity system:

1. **The mark is a pea whistle.** Constant silhouette, instantly drawable, ownable.
2. **The "pea" inside the whistle chamber is each sport's object.** Soccer ball for CH 01,
   basketball for CH 02, puck for hockey, tennis ball, race wheel, star for community
   leagues. This satisfies the brief directly: the logo's character lives *inside* every
   sport icon, instead of sitting next to it.
3. **The signal arcs off the mouthpiece are the broadcast motif.** Whistle blast = ON AIR.
   They animate (staggered pulse) as the loading/live indicator, and they're the natural
   notification glyph ("we'll whistle when it's set").

Tagline language that falls out of it for free: *"Whistle to whistle, in your time."*
*"We'll whistle when it's set."* The brand voice is a broadcast booth, not a database.

## System Vocabulary

| Element | Treatment |
|---|---|
| Sports | **Channels** (CH 01 SOCCER … CH 99 YOUR LEAGUE) — selector reads as a channel dial, ON AIR / SOON flags |
| Events | **Tickets** — cream paper stubs on the black field, perforated edge, colored time stub, barcode, ADMIT: WATCHING / GOING |
| Schedule list | **Program guide** — day rail with event pips, departure-board rows with split-flap status (CONFIRMED / TIME TBD / MOVED +1H) |
| Tournaments | **Capsules** — Mexico-86-inspired concentric ring geometry (original), flag blocks, host-city skyline chips |
| Uncertainty | Native, not an error: TBD tickets get a diagonal "standby" wash; tentative board rows get amber flaps; conflicts get a magenta outline + tag |
| Exports | The ticket/poster IS the export — share cards, PNG posters, and the ICS pipeline all reuse the same ticket layout |

## Type & Color

- Display: **Bungee** (wordmark) + **Archivo Black** (headlines, chrome-gradient fill —
  the 80s broadcast title card, kept legible).
- Boards/labels: **IBM Plex Mono**, wide letterspacing — departure board / dot-matrix voice.
- Body: **Space Grotesk** for modern readability.
- Palette: broadcast void `#07070E`, warm cream `#F4EAD8` (paper + title type), and four
  glow signals — cyan `#46E8FF`, magenta `#FF4FD8`, gold `#FFC24B`, signal green `#54FF9F`,
  alert `#FF6A55`. CRT scanline + corner-glow atmosphere at ~2% opacity, never under body copy.

## Why this serves the product (not just the vibe)

- The **departure board** makes our hardest UX problem — TBD/postponed/changed — feel like
  the *point* of the product rather than a failure state.
- **Tickets** make every schedule row inherently exportable/shareable; the poster export
  and the on-screen card are the same object.
- **Channels** give every future sport a slot without redesign (CH 06… just appears).
- **Capsules** are the tournament-pack system the regionalization plan wants (host-city
  chips, era/country accents) without touching anyone's IP.

## Known refinements before productionizing

- The whistle SVG reads slightly ambiguous below 24px — needs a thicker chamber outline and
  larger pea ratio at small sizes (separate small-size variant of the mark).
- Light-mode "daytime program" variant required for accessibility/long reading sessions:
  cream paper background, ink type, same stubs (paper inverts, glow becomes ink stamps).
- Contrast pass: cream-dim on void is borderline for small mono labels (bump ~15%).
- Reduced-motion media query for signal arcs and blink.
- These are static mockups; framer-motion equivalents are straightforward (flap flips,
  ticket tear-off on follow, channel-dial snap).

## If this entry wins (or merges)

Port order: tokens → ticket card component → departure-board rows → channel dial →
capsule hero. The current app's structure (routes, data, exports) is untouched; this is a
skin + component-language swap, deliberately built so MP3 can adopt it incrementally.
