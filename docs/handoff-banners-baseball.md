# Handoff — Sport banners, light/dark watercolour, baseball, Other Sports

Paste this into a fresh chat to continue. Written 2026-06-20. Branch: **`main`** (everything below is pushed).

## What this covers
The `SportChannelBanner` art system (broadcast + program modes), the new **Baseball** sport, and the **Other Sports** page. All of it lives in:
- `src/styles/tailwind.css` — the `.sport-channel-*` rules (broadcast) and `[data-paper] .sport-channel-*` rules (program/light).
- `src/components/SportChannelBanner.tsx` — `assetKeyBySport` + `artFocusByAsset` maps.
- `src/theme/themes.ts` — per-sport palettes + `programPrimary`.
- `src/domain/sports.ts` + `src/domain/types.ts` — sport list + `SportKey`/`CanonicalSportKey` unions.
- `public/assets/sport-banners/{broadcast,ink}/{asset}-{icon,action}.{webp,png}` and `public/assets/sport-icons/{neon-3d,brushed-mask,brushed-plates}/{key}.webp`.

## The banner compositing model (current, working)
**Broadcast (dark):** WebP art over a warm-pale field. Each art panel has its OWN feathered backing so nothing reads as a pasted rectangle:
- Icon (neon-on-black art) → local dark backing + `mix-blend-mode: screen`, bleeds off the **left** edge, fills full banner height.
- Action (cream-backed scene) → normal blend on the matching pale field, bleeds off the **right** edge, fills full height.
- Field/backing/glow are tinted with the sport **PRIMARY** (NOT accent — accent is gold for several sports and muddied the art). Soccer-dark is the reference "this looks right" banner.

**Program (light, `[data-paper]`):** the ink PNG/webp is used as a CSS **mask** (alpha = the brush shape); the fill is a **duotone watercolour wash** (primary + offset accent pools) + a **colour bloom** (primary/accent `drop-shadow` under `multiply`, the light-mode mirror of dark's glow). Key rules:
- `mask-size: contain` — show the WHOLE figure at natural size, fit to height. **Do NOT use `cover`** (it zooms/crops — the user rejected that repeatedly).
- The art **bleeds to the banner edges**: icon panel `margin-left: -pad`; action panel `margin-right: -pad` **and** action `::before` inset extends right. Both the art AND its colour/halftone layers must reach the edge (a recent bug left a pale "white bar" when only the art reached it — fixed by bleeding the whole action panel).
- The "spill past the banner edge" idea was **abandoned** (`overflow: visible` removed). Edges clip flush.

**Responsive:** 4-col >1320px (the mockup layout); compact horizontal 3-col 701–1320px (NO tall stacking); icon-only ≤700px. Art fills full height in 4-col/medium; mobile is icon-only.

## Baseball (added this session) — ⚠️ ONE TODO
Theme: red/gold (`#ff5630` primary, `#ffd34d` accent, `#9a3a1a` program ink). Wired in themes.ts, sports.ts (key `baseball`, `mlb` alias), types.ts, and the banner maps. Route: `/sports/baseball`.
- **Dark icon** = red neon bat+ball (good). **Light icon** = brush bat+ball mask (good).
- **TODO: the ACTION (right-side) art is a PLACEHOLDER that reuses the icon.** Replace these four files with proper scene art:
  - `public/assets/sport-banners/broadcast/baseball-action.webp` (dark = the neon **diamond/scoreboard** scene).
  - `public/assets/sport-banners/ink/baseball-action.{webp,png}` (light = the **batter/catcher** brush scene).
  - The light batter art exists in `Desktop/light mode banner mockup.png` (the right ~30% of that 1672×941 image). The user offered to export the left/right pieces individually if cropping the composite is unreliable — ask for clean transparent layers.
- Asset gen recipe (sharp is a dependency): neon PNG → `.webp` keeping alpha; brush "white-on-black" PNG → alpha = luminance (`greyscale().extractChannel(0)` joined onto a dark RGB), then export BOTH `.png` AND `.webp` (the ink masks are referenced as `.webp` now — generating only `.png` shows an unmasked blob).

## Other Sports page
`/other-sports`, community/`custom` (purple) theme, reached by the repurposed selector tile. The other session has since expanded it (`secondarySports`, provider/community/import lanes, search/filter). Minor cleanup: "Baseball" may still show as a long-tail tile though it's now a full channel.

## Gotchas (read before editing)
- **Two chats share this checkout.** Another Claude session edits the same files (esp. `tailwind.css`, `SportChannelBanner.tsx`, `AppShell.tsx`) and moves git HEAD. ALWAYS `git add` only your own files (never `-A`), commit + push promptly, and re-check `git branch`/`git status` before each commit. See memory `two-chat-shared-checkout`.
- **Verify in preview:** `preview_start` name `dev`; toggle broadcast/program with the header theme button; the in-memory theme pref resets to broadcast on reload. Screenshots are intermittently flaky — fall back to `preview_eval` geometry checks.
- Always finish with `npm run lint && npm run build` (build also regenerates SEO HTML/sitemap).

## Recent commits (newest first)
`3ac8f1b` action colour layer to right edge · `7a92104` right art to edge · `f130251` Baseball sport · `4262a79` watercolour bloom+duotone · `8a17166` un-zoom + dark-left cream · `d3d820f` Other Sports page.
