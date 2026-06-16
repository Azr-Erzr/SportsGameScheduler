# Silbo Design Context — The Single Brief for Design Work

Last updated: June 15, 2026
Purpose: **the one document to paste into a fresh, design-focused chat.** It synthesizes the two
external visual-system briefs, the repo's prior design decisions, and the *actual code* as it
stands today, then resolves the open conflicts and gives a concrete refinement worklist. If this
doc and a screenshot disagree with an older doc, this doc wins.

Source documents folded in here:
- `silbo_sports_visual_design_system.md` (external brief: the **B&W ink** + **colour** systems).
- `docs/silbo-design-synthesis.md` (repo: Channel S × Poster-team convergence, motif grammar).
- `docs/silbo-design-entry-channel-s.md`, `docs/master-plan-3.md` (design backlog).
- The shipped code: `src/theme/themes.ts`, `src/theme/SportThemeProvider.tsx`,
  `src/components/SportChannelBanner.tsx`, `src/styles/tailwind.css`.

---

## 1. Brand concept (locked)

**Silbo is not a sports-news site. It is a sports signal, schedule, and data network** — a
broadcast channel for *your* games. Every visual decision should read as: schedule, signal,
telemetry, broadcast, ticket — never team fandom, never athlete worship, never league trade dress.

Identity anchors that are already shipped and should not be relitigated:
- **Whistle mark** with signal arcs (arcs double as the live/notification motif). `SilboMark.tsx`.
- **Channel framing**: sports are "channels" (CH 01…CH 99, ON AIR/SOON). The header shows the
  current channel number.
- **Tickets**: schedule events render as cream perforated tickets with a coloured time stub — the
  on-screen card, the PNG poster, and the share card are the same object.
- **Split-flap status** language (LIVE SOON / MOVED / TENTATIVE / TBD).
- **Uncertainty is a first-class state**, not a gap ("we'll whistle when it's set").

---

## 2. The cohesive core: two art systems → two app modes

The external brief describes two visual systems. The product already maps them cleanly onto its
two surface modes. **This mapping is the spine of the whole design language — make everything
else serve it.**

| | **Broadcast / Dark** (`mode: broadcast`) | **Program / Light** (`mode: paper`, `[data-paper]`) |
|---|---|---|
| External system | **Colour system** — retro-futuristic 3D broadcast & data-viz | **B&W ink system** — manga/brush-ink editorial |
| Feel | Premium, technical, neon, live | Handmade, editorial, riso-print, calm |
| Surface | Warm void `#0b0a08`, warm panels, cream type | Cream paper `#f4ead8`, dark ink type |
| Sport art | Full-colour 3D **WebP** scenes (neon equipment icon + telemetry action panel) | **Ink PNG** silhouettes, *masked and tinted* to the sport's program colour + halftone |
| Used for | Home, My Schedule, sport pages, alerts — anything live/action | Share pages, exports, tournament capsules, reading/print |
| Glow | Neon edge-glow allowed | Little/no glow; colour comes from ink wash, not bloom |

**Surface rule (locked):** mode follows *purpose, not page*. Live/action surfaces are broadcast;
reading/sharing/export surfaces are program. Neon never lands on cream unless the specific
foreground/background pair passes a contrast check. Components reading theme colours inline must
call `withSurfaceMode(theme, prefs.themeMode)` first.

> Today there is also a **user toggle** in the header ("Switch to Program Light/Broadcast") that
> flips `prefs.themeMode` globally. That's fine as a preference, but the per-surface rule above is
> still the design intent for surfaces the user *doesn't* explicitly theme (exports, share pages).

---

## 3. Canonical per-sport palette (single source of truth)

These are the **shipped** values from `src/theme/themes.ts`. Where the external brief's colour
table disagrees, the shipped value wins (it's implemented and brand-coherent) — divergences are
flagged so the design chat can decide deliberately, not by accident.

| Sport | Broadcast primary (neon) | Broadcast accent | Program primary (ink) | External brief says | Verdict |
|---|---|---|---|---|---|
| **Brand / neutral** | `#4dff8a` green | `#46e8ff` cyan | `#155e38` | — | Green is the Silbo signature. |
| Soccer | `#54ff9f` green | `#46e8ff` cyan | `#155e38` | cyan/turquoise | **Keep green.** Soccer = the brand's home sport; cyan is its *accent*. Do not make soccer cyan. |
| Basketball | `#ffa94d` orange | `#ff4fd8` | `#9a4f12` | orange/ember | ✓ aligned |
| American football | `#ff8a5b` coral | `#ffd34d` | `#8f3a21` | hot pink/coral | App leans coral-orange. **Open:** shift toward pink for more separation from basketball? |
| Hockey | `#46e8ff` electric blue | `#9fd8ff` | `#1f5f78` | electric blue | ✓ aligned |
| Tennis | `#d8ff49` acid lime | `#54ff9f` | `#566815` | acid lime | ✓ aligned |
| Golf | `#8affc1` mint | `#ffd34d` | `#275c38` | teal/emerald | ✓ aligned (mint→emerald ink) |
| Motorsport | `#ff5247` red | `#ffd34d` | `#99251f` | racing red | ✓ aligned (F1 ordered first) |
| Combat | `#ff4fd8` magenta | `#ff6a55` | `#7d1737` | purple/magenta | App leans magenta. **Open:** nudge toward purple to avoid clashing with football coral? |
| Track & field | `#ffc24b` amber | `#ff5247` | `#8a5a12` | amber/yellow | ✓ aligned |
| Olympic | `#7aa2ff` royal blue | `#ffd34d` gold | `#284f8f` | royal blue + gold | ✓ aligned |
| Community/custom | `#b18aff` purple | `#54ff9f` | `#5b3b8c` | purple + cyan | App pairs purple+green. Minor; fine. |
| WNBA (alias) | `#ff7ab8` pink | `#ffa94d` | `#8a315d` | — | distinct from NBA orange ✓ |

Shared broadcast base: bg `#0b0a08`, surface `#16130f`, text `#f4ead8`, export-gold `#ffc24b`.
Shared program base: bg `#f4ead8`, surface `#fbf5e9`, ink `#1d1812`, export `#b3541e`.

**Rule:** colour is *category navigation*, not decoration. One sport = one accent identity across
icon, ticket stub, banner wash, and chart. Never apply a generic orange to every sport (a specific
artifact the brief warns about).

---

## 4. How colour reaches the screen (the token contract)

Know this before touching any colour, or changes will silently no-op:

- `src/theme/themes.ts` — the palette. `broadcast()` builds each sport theme;
  `withSurfaceMode(theme, 'program')` derives the paper variant and swaps `primary` to the inkier
  `programPrimary[sport]`.
- `src/theme/SportThemeProvider.tsx` — projects a theme onto **both** `--mp-*` (our stable token
  contract) **and** `--color-*` (Tailwind's `@theme` names). Both are required: Tailwind resolves
  `var(--mp-*)` at `:root` where it's unset, so `--color-*` must be re-set on the subtree or
  utilities keep the fallback palette.
- `src/styles/tailwind.css` — `@theme` maps `--color-page/surface/ink/primary/accent/export` to
  `--mp-*` with fallbacks (lines ~21–32). Everything visual keys off these.
- `AppShell.tsx` picks the base theme from the route; `data-paper` is set when `mode === 'paper'`.

So: **edit palette → `themes.ts`. Edit how a token renders → `tailwind.css`. Never hardcode a
hex in a component.**

---

## 5. The banner art technique (this is the "blending and masking" the team just built)

`SportChannelBanner` renders two art panels — `.sport-channel-icon-panel` (left, the category
stamp) and `.sport-channel-action-panel` (right, the narrative scene) — plus title/copy in the
middle. The two modes render those panels completely differently:

**Broadcast/dark:** panels use the full-colour **WebP** scenes directly
(`/assets/sport-banners/broadcast/{asset}-icon.webp` and `-action.webp`) as background images.
The art carries its own neon colour.

**Program/light** (`[data-paper]`, the team's new work in `tailwind.css` ~2171–2300): the ink
**PNG** is used as a CSS **`mask-image`**, and the fill behind the mask is a *gradient*, not the
image — so the silhouette is tinted by the theme, not by the PNG:
- `::before` = the inked silhouette: a `linear-gradient` of near-black ink (`#1d1812` ↔
  `--mp-ticket-stub`) **plus a radial "wash"** of `--mp-primary` placed at the sport's focal
  point, masked by the PNG, `mix-blend-mode: multiply` on cream.
- `::after` = **halftone + paper texture**: small repeating radial dots, a `--mp-primary` wash, a
  diagonal `repeating-linear-gradient` ink hatch, and a cream vignette — the riso/screen-print
  feel.
- The panel itself gets a soft radial `--mp-primary`/`--mp-accent` glow and a `mask-image` vignette
  so the art fades into the paper instead of sitting in a hard box.
- **`artFocusByAsset`** in `SportChannelBanner.tsx` sets `--sport-channel-{icon,action}-wash-{x,y}`
  per sport so the coloured wash lands where the action is (e.g. soccer action wash at 82%/28%).

Net effect (verified June 15): basketball dark = neon hoop + 3D court/shot-clock/FG% telemetry;
basketball light = brush hoop + an ink-circle layup silhouette, both washed in basketball's burnt
amber on cream. **This is the cohesive realization of both brief systems — keep it; refine it.**

---

## 6. Cohesion rules to refine (light vs dark, colour, blending, masking)

The systems are aligned in spirit; these are the knobs that still feel slightly off and should be
tuned *with the live preview open* (sport page → header theme toggle):

1. **Wash intensity parity.** Light-mode washes were just bumped up (primary 28–60% at the focal
   point). Audit each sport so the tint reads as "that sport's colour" without muddying the ink —
   especially the inkier programs (motorsport red, combat `#7d1737`, olympic blue) where wash can
   disappear into the dark ink. Target: tint legible at a glance, silhouette still clearly black.
2. **Halftone density consistency.** The `::after` dot sizes/opacities differ between icon and
   action panels. Pick one halftone scale and reuse it so every sport's paper texture matches.
3. **Glow discipline (dark).** The brief warns against full-image bloom. Keep neon glow on
   contours/contact points only; don't let the WebP action panels fog. Audit hockey/olympic
   (blue glows spread fastest).
4. **Action-panel personality match.** Dark action panels are literal 3D telemetry; light action
   panels are abstract brush. That's an acceptable two-mode split, but make sure the *subject*
   matches across modes per sport (same "one clear idea": soccer = shot-to-goal, basketball =
   layup/shot arc, motorsport = corner). Don't let one mode tell a different story than the other.
5. **Mask edges.** Ensure `mask-size: contain` + the panel vignette never clip equipment at small
   widths (mobile collapses to the icon panel only — check the crop).
6. **Contrast pass.** Run the program palette against cream for body text, stat labels, and CTA
   borders (WCAG AA). The inkier programs are fine; watch amber/lime on cream.
7. **One source of truth for the wash map.** `artFocusByAsset` (component) and the per-sport CSS
   should not drift — consider moving focal points next to the palette so colour + focus live
   together.

---

## 7. Motif grammar (approved, deduped from both briefs)

Reusable grammar — a motif ships only if it survives homepage, sport page, schedule row, export,
and email without fighting the schedule task.

| Motif | Use | Constraint |
|---|---|---|
| Whistle signal arcs | brand mark, live states, alerts, loading | clipped inside their tile |
| Ticket stubs + perforation | match cards, exports, packs, QR return stub | never shrink schedule text — paginate |
| Broadcast colour bars | page corners, export footers, dividers | accents, not full-width clutter |
| Program-guide rails + event pips | My Schedule, day filters, status strips | must communicate count/date/status |
| Capsule rings / orbit lines | tournament heroes, globe board | one hero-scale orbital per viewport |
| Telemetry modules (clocks, sector times, shot/lap data) | dark action panels, dashboards | numbers must be **real and legible** (`24`, `1:18.732`, `186 KM/H`) — no garbled digits |
| Trajectory arrows | shot/kick/serve/putt paths | **one** path, **one** arrowhead at the destination only; omit for motorsport/combat/track |
| Halftone, paper grain, ink hatch | big art panels, empty states, exports | never under small text/forms |
| Brush silhouettes (anonymous figures) | light action panels, posters | no faces, numbers, real likenesses, or fake kanji |
| Split-flap status | TBD/moved/confirmed/live soon | readable in both modes |

**Hard "do not" (both briefs agree):** recognizable athletes/faces, team trade dress, league
logos, fake Japanese/Chinese lettering, double wings on cars, malformed gloves, multiple
contradictory balls, random target spirals, garbled numbers, foggy full-image glow, generic
orange on every sport.

---

## 8. Assets & pipeline

- Banner art lives at `public/assets/sport-banners/{broadcast,ink}/{asset}-{icon,action}.{webp,png}`.
  `assetKeyBySport` maps sport keys → asset filenames.
- **52 MB of reference mockups** sit untracked under `docs/Mockups/`, `docs/New Project/`,
  `docs/ChatGPT Image …/` (66 files). They are *reference only* — the app does not import them.
  **Decision needed:** keep them out of git (recommended — move to shared drive / Figma), or track
  via **git-LFS** if they must be versioned. Do not commit 52 MB of PNGs to normal history.
- Stand up an `asset_registry` (doc table or DB): asset name, source, license, modified_by,
  route/component usage, replacement plan. Required before any generated/licensed art ships.
- Final art path: concept in Figma/Make/generation → redraw as code-native SVG or licensed/
  commissioned packs → keep lighting/camera/material unified across a pack (never mix packs).

---

## 9. Refinement worklist for the design chat (prioritized)

1. **Light-mode wash audit** across all 11 sports + WNBA (§6.1) — `tailwind.css` `[data-paper]
   .sport-channel-{icon,action}-panel` + `artFocusByAsset`.
2. **Halftone unification** (§6.2).
3. **Dark glow discipline** pass on WebP panels (§6.3).
4. **Contrast pass** on the program palette (§6.6); fix any failing label/CTA.
5. **Resolve the two palette opens** (football coral→pink? combat magenta→purple?) in `themes.ts`.
6. **Mobile banner crop** check (§6.5).
7. **Move `artFocusByAsset` next to the palette** so colour + focal point co-locate (§6.7).
8. Then continue the MP3 design backlog: standardized poster-card templates per event type
   (match / race / fight card / tee sheet / session / community), QR return stub on exports,
   whistle-mark A/B, spotlight art from DB.

## 10. Open questions for the user
- Soccer stays green (brand) — confirmed direction, but worth an explicit yes.
- Football coral vs pink, and combat magenta vs purple — align tighter to the external brief, or
  keep the shipped values?
- The 52 MB mockups: out-of-repo or git-LFS?
- Default home loudness: full poster wall (needs real non-AI imagery) vs board-first hero.

---

## 11. Broadcast banner v2 — "one continuous field" (priority refinement)

This is the top design task. The broadcast (dark) `SportChannelBanner` currently looks "pasted
in": the WebP art reads as dark rectangles seamed onto a cream spread. The fix is a compositing
change, **no new art required**. Reference: the user's WORLD CUP '26 mockup (dark-teal art zones
left & right, pale center for the title, equipment bleeding out of the dark edges, shot arc +
`xG 0.28` telemetry on the right, continuous grid across the whole banner).

### Why it looks pasted-in (root cause)
The broadcast banner is built as a **cream editorial spread** — `.sport-channel-panel` bases use
`#fbf5e9`, edges feather toward `#fff8ea`, and art layers use `mix-blend-mode: multiply`
(`src/styles/tailwind.css` ~1953–2039). Multiply needs a light backing; the broadcast WebP art has
its own near-black background, so a dark image on cream + cream feathering = a visible dark
rectangle with seams.

### Target
One continuous broadcast capsule with a **horizontal gradient field: dark-teal (left art) → pale
center (title/copy) → dark-teal (right art)**. Equipment emerges out of the dark edges and bleeds
off-canvas; the right zone carries the live telemetry; one grid + plus-marks + faint scanline span
the entire banner. No boxed panels, no parchment rectangles.

### The technique (no new art)
1. **Re-ground the field.** `.sport-channel-banner` (broadcast, not `[data-paper]`) becomes a
   full-bleed horizontal gradient over `--mp-bg`, tinted with `--mp-accent`, darkest at ~0–22% and
   ~78–100%, lightest in the center third. Move grid/plus-marks/scanline to span the whole banner.
2. **Screen-blend the art.** Switch `.sport-channel-icon-panel::before` /
   `.sport-channel-action-panel::before` from `mix-blend-mode: multiply` to **`screen`/`lighten`**
   so the WebP's black background drops out on the dark field and only neon linework glows. This is
   the dark-mode mirror of the light-mode masking.
3. **Feather toward the field, not cream.** Replace cream edge-feathers with transparent-alpha
   `mask-image` gradients so art dissolves into the dark field at its outer + inner edges; let the
   left icon bleed off the left edge.
4. **Title legibility band.** A soft, low-opacity light wash behind the center title only, blended
   into the gradient (not a bordered panel), sized so green title + body pass WCAG AA.
5. **Telemetry floats on the field.** `xG`/clock chip + stat row sit on the dark field with a thin
   `--mp-accent` border, no parchment card. Keep the bottom colour-bar accent.

Identity unchanged: title/wordmark = sport **primary** (soccer green), art/field/shot-arc = sport
**accent** (soccer cyan). Glow on contours/contact only. One shot arc, one arrowhead at the
destination. Real, legible numbers only. Leave `[data-paper]` (light) rules untouched — they are
the reference for masking discipline.

### Acceptance criteria
- No rectangular seam between any art zone and the field at any width.
- WebP black background imperceptible — only neon linework reads.
- Left equipment bleeds off the left edge; right zone shows art + one clean shot arc + telemetry.
- Grid/plus-marks/scanline continuous across all three zones.
- Title/body legible on the center band; stat row legible on the field.
- Mobile collapse (icon panel only) feathers cleanly — no rectangle.
- Reuses existing `/assets/sport-banners/broadcast/{asset}-{icon,action}.webp`.

### Shipped (June 16, 2026) — and where the plan met the assets
Implemented in `SportChannelBanner.tsx` + the broadcast `.sport-channel-*` rules. The banner now
reads as one continuous field. Two realities of the *actual art* forced a smarter composite than
the original "switch both panels to `screen`" plan — keep these in mind before touching it:

- **The two WebPs per sport have opposite backgrounds.** The `-icon` art is neon-on-**black**
  (or an ambient-lit scene); the `-action` art is a full telemetry scene on a **cream/parchment**
  background (it was authored for the light banner). So a single blend mode can't serve both:
  `screen` drops black but blows cream to white; `multiply` kills the neon glow.
- **The banner is responsive** (4-col > 1320px → 2-col stacked with a full-width action strip →
  icon-only < 700px). A global horizontal `dark→pale→dark` gradient only lines up in the 4-col
  case, so it would break legibility/seams when stacked.

What shipped instead (the layout-robust, asset-honest version of the §11 intent):
- **Shared warm-pale field** (`--scf-field`, a hair of `--mp-accent`) carries the title/copy and
  the cream-backed action art; **grid + plus-marks + faint scanline** run continuously on
  `.sport-channel-banner::before` (below the panels). Title stays sport-`ticketStub` (dark) on the
  pale field — already AA, no separate legibility band needed.
- **Icon zone:** a *local, feathered* dark-teal backing (`--scf-void`/`--scf-deep`) that dissolves
  into the field; art `mix-blend-mode: screen` + a **radial** feather mask (kills the WebP's
  rectangular edge, corner haze, and any cream border) so even ambient-lit icons (motorsport) read
  as a neon subject emerging from the dark, bleeding off the left edge.
- **Action zone:** cream-backed scene on the matching pale field at **normal** blend (no rectangle,
  neon arc keeps glowing), framed by a dark-teal outer-corner vignette, bleeding off the right.
  As the stacked bottom strip it's centred with the field as an invisible letterbox.
- The dark "broadcast" weight lands on the **icon stamp + framed corners**, not a uniformly dark
  right zone (impossible without destroying the cream action art) — which matches the real mockup.
- `[data-paper]` (light) rules untouched; verified soccer/basketball/motorsport/hockey/tennis in
  4-col, stacked, and mobile, both modes, clean `lint` + `build`.

### Ready-to-paste prompt for the design chat
> **Context:** You're refining `SportChannelBanner` in the Silbo Sports app (React + Tailwind v4).
> Read `docs/silbo-design-context.md` first — especially §2 (two-system→two-mode), §3 (palette),
> §4 (token contract), §5 (the light-mode mask/wash technique), and §11 (this section). Work only
> in `src/components/SportChannelBanner.tsx` and the `.sport-channel-*` rules in
> `src/styles/tailwind.css`. Verify every change in the live preview (sport page → header theme
> toggle) across soccer, basketball, motorsport, hockey, and one individual sport, desktop + mobile.
>
> **Goal:** Make the broadcast (dark) banner read as one continuous broadcast field instead of
> three art panels pasted on cream — matching the WORLD CUP '26 reference: dark-teal art zones left
> and right, a lighter center band for the title/copy, equipment bleeding out of the dark edges, a
> shot arc + telemetry chip on the right, and a continuous grid/plus-mark/scanline overlay. **Use
> the existing broadcast WebP assets — do not request or generate new art.**
>
> **Constraints & technique:**
> - Re-ground `.sport-channel-banner` (broadcast state) as a full-bleed horizontal gradient over
>   `--mp-bg`, tinted with `--mp-accent`, darkest at ~0–22% and ~78–100%, lightest in the center
>   third. Move grid/plus-marks/scanline to span the whole banner.
> - Switch broadcast art layers (`.sport-channel-icon-panel::before`,
>   `.sport-channel-action-panel::before`) from `mix-blend-mode: multiply` to `screen`/`lighten` so
>   the WebP black background drops out. Remove the cream (`#fff8ea`/`#fbf5e9`) parchment fills.
> - Replace cream edge-feathers with transparent-alpha `mask-image` gradients; let the left icon
>   bleed off the left edge.
> - Add a soft low-opacity light wash behind the center title only, blended into the gradient (not
>   a bordered panel), sized so green title + body copy pass WCAG AA.
> - Keep the telemetry chip + stat row on the field with a thin `--mp-accent` border, no parchment
>   card. Keep the bottom colour-bar accent.
> - Preserve identity: title/wordmark = sport primary (soccer green); art/field/shot-arc = sport
>   accent (soccer cyan). Glow on contours/contact only. One shot arc, one arrowhead at the
>   destination. Real, legible numbers only.
> - Do not touch `[data-paper]` (light) rules — use them as the masking reference.
>
> **Done when:** no rectangular seams at any width; the WebP black field is imperceptible (only
> neon reads); left art bleeds off-edge; grid/scanline continuous across all zones;
> title/copy/stats legible; mobile (icon-only) collapse feathers cleanly; verified in preview for
> ≥5 sports in both modes with no console errors and a clean `npm run lint && npm run build`.
