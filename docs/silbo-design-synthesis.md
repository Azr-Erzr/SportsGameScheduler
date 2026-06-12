# Silbo Design Synthesis — Entry A ("Channel S") × Entry B (Poster Team)

Last updated: June 13, 2026
Status: for team markup. Approved items graduate into MP3 as
"Adventure Design Territories → Selected Direction".

Both entries converged independently on: whistle-based identity, cream tickets on a dark
broadcast field, dot-matrix time blocks, split-flap status language, city capsules, and
uncertainty as a first-class visual state. Treat that convergence as the locked core.

## Locked Core (both teams already agree)

- Whistle identity with signal arcs; arcs double as live/notification motif.
- Schedule events rendered as **tickets** (cream paper, perforation, colored time stub,
  barcode) — the on-screen card, the PNG poster, and the share card are the same object.
- Departure-board/program-guide framing for lists; split-flap status chips.
- Uncertainty is native: TBD/standby washes, tentative flaps, "we'll whistle when it's set."
- City/tournament capsules from the moodboard (skyline chips, capsule heroes).
- Big readable display type + mono board type + modern grotesque body.

## Adopted from Entry B (poster team)

| # | Element | Disposition |
|---|---|---|
| B1 | **Clock face inside the whistle chamber** on the brand mark | Adopt. Brand mark = clock-pea; sport channels keep Entry A's ball-pea integration. One whistle, two meanings. |
| B2 | **World clock strip** (4 cities, colored local times) | Adopt on home hero and export poster footers. |
| B3 | **YOUR WORLD rail** — followed entities with per-follow event counts, cross-sport | Adopt as the My Schedule left rail (replaces Entry A's chip filters as primary control; chips remain as quick toggles). |
| B4 | **TONIGHT spotlight + WHERE TO WATCH + per-event export rail** | Adopt; it is the `broadcasts` table + export pipeline as UI. Keep the "more options may be available in your region" honesty line. |
| B5 | **QR "scan to return" stub** on exports/share pages (`silbo.sports/s/…`) | Adopt everywhere an export exists. Closes the poster→live-schedule loop; ships regardless of skin. |
| B6 | **"PACKS"** as the consumer name for calendar bundles; Picks / Sync / Packs / Community IA | Adopt naming + IA. "Subscribe to this Pack" replaces "create feed" language. |
| B7 | **Light "print program" mode** for tournament capsules (Italia-90 print hero, halftone art, stat chips: 32 teams · 64 matches · 16 days · 1 trophy) | Adopt with the mode rule below. |
| B8 | Status vocabulary **LIVE SOON / MOVED** + broadcaster line on every ticket | Adopt; union with Entry A's TENTATIVE/standby wash. |
| B9 | **"Tracking N events without confirmed dates"** strip | Adopt; it surfaces `schedule_watch_requests` as a feature. |
| B10 | Neon **color-bar** vertical accent (broadcast test bars) | Adopt as a small recurring accent (page corners, export footers). |

## Kept from Entry A ("Channel S")

| # | Element | Why |
|---|---|---|
| A1 | **Ball-pea integration** — the sport object lives *inside* the whistle chamber | The original brief: the character is inside every sport icon. Entry B's side-by-side composite doesn't integrate. |
| A2 | **Channel dial** sport selector (CH 01… CH 99, ON AIR/SOON flags) | Gives every future sport a slot without redesign; pairs with the staged-sport states already in the app. |
| A3 | **Day rail with event pips** on My Schedule | Lighter than a full calendar; keeps the program-guide metaphor. |
| A4 | **Capsule ring geometry + kit wall** on sport pages | Original geometry (no IP); kit wall is the team picker with jersey-stripe chips. |
| A5 | Conflict treatment — magenta outline + "OVERLAPS …" tag | Maps to the shipped conflict detection. |

## Rules (resolve the conflicts between entries)

1. **Mode rule:** dark *broadcast* surfaces for live/action (home, My Schedule, Tonight,
   alerts); light *program-paper* surfaces for reading/sharing (tournament capsules, public
   share pages, image/PDF exports). Never per-page vibes — per-surface purpose. Program
   mode uses inkier paper-safe sport colors and little/no glow; broadcast neon does not carry
   onto cream surfaces unless contrast has been checked.
2. **One shell:** top nav (Home · My Schedule · Picks · Sync · Packs · Community) on every
   page; sport tabs and rails are page-internal. Entry B's three pages used three navs —
   rejected as a system.
3. **IP rule:** poster *style* yes, recognizable athletes/trade dress no. Original halftone
   silhouettes, our capsule geometry, no real fighter/driver likenesses, no event logos.
   (Reference pack rights notes apply.)
4. **Script type** is export-poster decoration only, never UI chrome — it breaks under
   i18n (length, legibility, RTL later).
5. **Density rule:** one primary action per first viewport. The poster energy comes from
   type, color, and texture — not from module count. Every page must survive subtraction.
6. Mock venues ("Silbo Dome") never enter seed/provider data.

## Reference pass: motif grammar and design principles

Sources reviewed for this pass:

- Dribbble motif references: https://dribbble.com/tags/motif
- Tilda web design styles guide: https://tilda.education/en/web-design-styles
- UX Planet graphic elements guide: https://uxplanet.org/15-graphic-elements-to-improve-your-web-design-33d190d95fcf
- Toptal principles of design: https://www.toptal.com/designers/ui/principles-of-design
- 21st.dev component gallery: https://21st.dev/community/components
- Open-source icon library index: https://www.toools.design/free-open-source-icon-libraries

### What this changes for Silbo

The visual system should treat motifs as reusable grammar, not one-off decoration. A motif is
approved only if it can survive across homepage, sport page, schedule row, export poster, and
notification email without confusing the core schedule task.

Approved motif families:

| Motif | Use | Constraint |
|---|---|---|
| Whistle signal arcs | Brand mark, live states, alerts, loading, "we'll whistle" copy | Keep arcs clipped inside their tile or intentional art surface. |
| Ticket stubs and perforation | Match cards, exports, pack cards, QR return stubs | Never shrink schedule text to preserve decoration. Paginate instead. |
| Broadcast color bars | Page corners, export footers, channel cards, tiny dividers | Use as accents, not full-width clutter on dense pages. |
| Program-guide rails | My Schedule, day filters, event pips, status strips | Functional first: must communicate count, date, or status. |
| Capsule rings and orbit lines | Tournament heroes, global event board, homepage art | One hero-scale orbital surface per viewport max. |
| Interactive globe signal pips | Homepage "live sports room", today/tournament discovery, sport-card focus | Pips must be real buttons with hover/tap/keyboard states, not only decoration. |
| Kit/league stripe blocks | Team picker, sport chips, poster cards | Avoid real team trade dress unless licensed. |
| Halftone, paper grain, scanlines | Big art panels, empty states, exports | Never under small text or forms. |
| Split-flap status language | TBD, moved, confirmed, live soon, source testing | Must remain readable in light and dark modes. |
| Collectible 3D sport objects | Sport tiles, pack covers, export covers, onboarding, empty states | Use for large personality surfaces; avoid tiny nav badges until readability is proven. |

### Design rules borrowed from the references

1. **Hierarchy first.** Toptal's hierarchy/contrast/repetition rules map directly to schedule
   UX: the event name, local time, and status must always win over art.
2. **Repetition creates identity.** Repeating arcs, rails, stubs, stripes, and pips across
   pages will make Silbo feel authored without needing custom illustration for every league.
3. **Whitespace is part of the motif.** The schedule pages need quiet lanes around tickets;
   the loud art belongs in heroes, carousels, empty states, and export covers.
4. **Experimental text is decorative only.** UX Planet's rotated-text warning applies here:
   rotated, tiny mono, script, or poster typography can label an art surface, but never be the
   only way to read a control, event, time, or warning.
5. **Use style territories intentionally.** Tilda's styles give Silbo a useful blend:
   Swiss/editorial order for schedule clarity, retro/poster energy for heroes, and restrained
   neobrutal accents for buttons, tabs, and selected states.
6. **One expressive object per section.** A page can have a globe, a poster carousel, or a
   signal board in view, but not all three fighting for the same moment.
7. **Motion should explain state.** Sheen can imply selectable cards, arcs can imply live
   signal, flap movement can imply status change, and carousel motion can imply discovery.
   Motion should not be required to understand the page.
8. **Functional icons and personality icons are separate systems.** The small UI shell needs
   simple vector marks. Larger editorial surfaces can use 3D/illustrated sport objects,
   souvenir badges, sticker textures, and richer retro treatment.
9. **The globe is navigation, not wallpaper.** If the homepage globe contains orbiting dots,
   sport symbols, or signal lines, they should reveal today's sports, focus related cards,
   or move the user into a schedule/sport page.
10. **Small-size logo wins first.** The whistle mark must work in the nav, channel grid,
   favicon/social avatar, and export footer before extra loops, chrome, shadows, or sport
   detail are added back.

### Component/tooling guidance

- Keep Lucide for ordinary UI actions where the symbol is standard and readable.
- Trial Phosphor, Tabler, Remix Icon, Iconoir, and Pixelarticons for sport-adjacent chrome,
  but record icon source and license before shipping.
- Use 21st.dev as pattern inspiration for backgrounds, borders, scroll areas, shaders, cards,
  tabs, tooltips, docks, and carousels; copy no code blindly until it is checked against our
  theme, accessibility, and mobile rules.
- Use Figma/Figma Make/image generation for concept exploration, then redraw final motifs as
  code-native SVG, licensed SVG assets, or Figma-authored vector exports.
- Maintain a future `asset_registry` or documentation table with: asset name, source,
  license, modified_by, route/component usage, and replacement plan.
- Treat Dribbble and similar galleries as inspiration only unless an asset is explicitly
  licensed or commissioned.
- Candidate 3D workflow: start from open/vector sport symbols, redraw or model in
  Figma/Blender/Spline, export transparent PNG/WebP for large UI art and SVG/vector fallbacks
  where possible.
- Candidate 3D asset sources to evaluate: IconScout sports 3D packs, licensed marketplace
  packs, commissioned custom pack, or internally generated Blender/Spline objects. Do not mix
  unrelated packs unless lighting, camera angle, material, and color are unified.

## Production sequencing — status (June 13, 2026)

User decisions locked: **neon for UI / chrome for export posters**; poster-wall home only
with real (non-AI) imagery, board-first hero until then; "Packs" confirmed (matches the
Silbo module naming in master-plan-3); warm the void a hair (now `#0B0A08`).

1. ✅ Tokens: broadcast-dark + program-paper palettes, type trio (Bungee wordmark /
   Archivo Black display / Space Grotesk body / IBM Plex Mono boards), flap colors,
   per-sport neon themes in `src/theme/themes.ts`.
2. ✅ Ticket card shipped (`MatchCard` = cream `ticket-paper` on the void, neon time stub,
   perforation, magenta conflict overlap tag). QR stub: follow-up (needs a QR dependency).
3. ✅ Status flaps + board-label vocabulary in `tailwind.css` (`.flap-ok/tbd/chg`).
4. ✅ Channel dial (CH numbers, ON AIR/SOON) + redrawn whistle (`SilboMark.tsx`):
   clock-pea brand mark, sport icon inside the barrel for channels, signal arcs animated
   and reduced-motion-safe. June 13 tune-up simplified the small badge silhouette: one main
   whistle contour, no extra loop/top dot/thick chamber ring, thinner glyph strokes, and
   more breathing room for sport symbols. Mark direction remains open for a later A/B test.
5. ✅ Memorabilia layer on the soccer page: tournament capsule hero (ring geometry, flag
   blocks, mono stat strip from real data), host-city skyline capsules with real venue
   counts, kit-stripe team wall ("The kit wall").
6. ✅ World clock strip on Home; ✅ interactive globe signal board v1 (hover/focus/tap
   sport pips, active preview, connected poster-card highlight); ✅ YOUR WORLD rail with
   per-pick counts + unfollow on My Schedule; ✅ "Tracking N knockout slots" TBD strip.
   ⏳ TONIGHT/where-to-watch rail waits on broadcast data (the `broadcasts` table is live
   but unpopulated).
7. ✅ Reduced-motion for arcs; chrome poster export (`posterChromeTheme`, both call sites);
   paper share page. ⏳ Full contrast audit + user-facing light-mode toggle (surface rule
   shipped instead: broadcast for live surfaces, paper for share/exports). ⏳ QR stub
   (needs a QR dependency). ⏳ Whistle mark shape workshop (user feedback: clearer drawing).
8. ✅ Collectible sport-object art v1: code-native retro-3D-inspired objects are now used on
   large poster cards and globe pips. Final licensed/generated 3D pack remains a future asset
   pipeline decision.

## Open questions for the user to call

- Logo finish: flat broadcast-neon (Entry B home) vs chrome-and-cream (Entry A title cards)
  — or neon for UI, chrome for export posters?
- How loud is the home page by default: Entry B's full poster wall, or Entry A's quieter
  board-first hero with poster accents?
- Do "Picks" (follows) and "Packs" (bundles) read clearly enough side-by-side, or does one
  need a rename before copy hardens into i18n keys?
