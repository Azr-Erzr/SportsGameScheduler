# Master Plan 3: Identity, Sport Expansion, Data Sources, And Export Craft

Last updated: June 12, 2026

This document captures the next phase after Master Plans 1 and 2: making the product feel
less generic, expanding sport coverage intelligently, improving exports, and designing the
data/provider system so the app can scale without wasting API calls.

## What Shipped From This Prompt

- Match cards now expand on click/tap and expose a natural future slot for "Where to watch",
  local broadcasters, streaming links, radio, watch parties, and sponsored provider boxes.
- Popular Picks now works like a toggle: click once to add the featured teams, click again to
  remove that featured bundle.
- The sport switcher now treats the menu as sport families, not individual leagues:
  Soccer, Basketball, American Football, Hockey, Tennis, Golf, Motorsport, Combat Sports,
  Track & Field, Olympic Sports, and Community.
- League examples now live in the small text under each sport family, e.g. NBA/WNBA/FIBA/NCAA
  under Basketball and NFL/CFL/NCAA under American Football.
- Schedule image exports now render at higher resolution with larger type and cleaner geometry
  so saved PNGs have more zoom headroom inside a phone photo library.

## Brand Direction: Silbo vs MatchPulse

The Silbo docs introduce a strong naming system:

- Umbrella brand: **Silbo Sports**
- Primary slogan: **Every game, match, and race in your calendar.**
- Product modules:
  - **Silbo Sync**: calendar exports and live syncing.
  - **Silbo Picks**: saved teams, leagues, players, drivers, fighters, tournaments, venues.
  - **Silbo Alerts**: reminders, schedule changes, fight-card live alerts, push/email.
  - **Silbo Packs**: prebuilt downloadable bundles for SEO and instant use.
  - **Silbo Travel**: later city/date sports-trip planning.

Recommendation: keep MatchPulse as the working app name until we finish the MVP flow, but
move the product language toward the Silbo architecture now. "Picks", "Sync", "Alerts", and
"Packs" are clearer than generic labels and can be used even if the final name stays
MatchPulse.

## Design Soul Pass

The current layout is functional but too clean in a way that can read as generic. The next
visual pass should add sport-specific personality without sacrificing scanability.

### Direction

- Use bright, confident accent colors, stronger selected states, visible outlines, and sharper
  active/click colors.
- Add subtle tactile textures: pitch grain, court paint, ice etching, track lane lines, fight
  poster paper, Olympic ring overlays.
- Add generated bitmap backgrounds or small editorial spot images in homepage/empty-state
  surfaces, not under dense schedule text.
- Add motion where it helps comprehension: card expansion, sport-switch transitions,
  carousel movement, "next event" countdown pulse, live fight-card progression.
- Use sport-specific motifs in exports: pitch ticket, race weekend board, fight-card poster,
  tennis draw strip, golf tee sheet, Olympic session board.

Research cues:

- Figma's 2026 trend list emphasizes immersive/3D elements, vibrant color, bold typography,
  motion, gamification, maximalism, collage, and neo-brutal accents:
  https://www.figma.com/resource-library/web-design-trends/
- Framer's design writing emphasizes interactivity and human-crafted/authentic feeling:
  https://www.framer.com/blog/web-design-trends/
- 21st.dev is useful for browsing high-polish React/Tailwind component patterns:
  https://21st.dev/
- Awwwards remains useful for visual reference scanning:
  https://www.awwwards.com/

### Acceptance Criteria

- The homepage has one memorable visual moment above the fold.
- Every sport family has a distinct accent palette and one subtle motif.
- Interactive states are obvious: selected, pressed, expanded, disabled, live, TBD.
- No dense schedule text sits on decorative imagery.
- Mobile remains the source of truth for layout quality.

## Schedule Image Export Direction

Phone Photos apps save raster images, not true vector/PDF objects. A PNG cannot retain infinite
vector zoom. The practical answer is:

1. Render high-resolution PNGs for Photos.
2. Keep pagination strict so text never shrinks too far.
3. Offer SVG/PDF export later for users who want print/vector-like behavior outside Photos.
4. Keep Notes/text export for maximum compatibility.

### Template Families

- **Match list**: soccer, hockey, basketball, American football.
- **Race weekend**: F1/motorsport sessions grouped by practice, qualifying, sprint, race.
- **Fight card**: event start, prelim/main card sections, bout order, followed fighter badge,
  estimated walkout window, "alert me before this bout".
- **Tournament draw**: tennis/World Cup/Olympic bracket or session windows.
- **Tee sheet**: golf rounds, players, tee times, cut/final round status.
- **Olympic session board**: sport, discipline, heat/final, medal event, country/athlete follow.

### Future Technical Work

- Add `createScheduleSvg()` alongside PNG rendering.
- Add `createSchedulePdf()` for printable/vector exports.
- Add export previews per sport family.
- Include a small QR code back to the live schedule/feed page.
- Add `export_theme`, `export_template`, and `export_density` preferences.

## Exhaustive Schedule Export Philosophy

The product advantage is not one export format. It is letting users take their schedule into
whatever surface they actually use. Unless a mode is technically misleading, legally blocked,
or too fragile to support, Silbo should offer the export path.

### Export Modes To Support

| Mode | Product use | Auto-updates? | MVP priority | Notes |
|---|---|---:|---:|---|
| Subscribed calendar feed | Best long-term option for changing schedules | Yes, but refresh timing is controlled by Apple/Google/Outlook | P0 | Silbo Sync primary path. Stable feed URL, tokenized access, clear update caveats. |
| Downloaded `.ics` file | One-time add to calendar | No | P0 | Must be labelled snapshot. Good for single tournaments, one-off events, local leagues. |
| High-resolution PNG images | Phone Photos, group chats, social sharing | No | P0 | Prioritize legibility, pagination, sport-specific templates, and zoomable raster size. |
| Plain text / Notes export | Apple Notes, Google Keep, email, Notion, family chat | No | P0 | Highest compatibility. Should group by date and use local timezone. |
| PDF export | Print, email attachment, desktop saving, school/team handouts | No | P1 | Better for vector-like readability and print. Should use same template engine as images. |
| SVG export | Sharp vector schedule graphics | No | P2 | Useful for designers/web embeds, but less familiar to ordinary phone users. |
| Shareable web schedule | Live public/private URL | Yes, from our DB | P1 | Best for custom/community leagues and personal schedule sharing once auth/server state exists. |
| QR-linked export | Bridge from static image/PDF back to live schedule | Link updates, file does not | P1 | Add QR to PNG/PDF so stale exports can lead back to current data. |
| Google Calendar direct sync | Writes/updates events through Google API | Yes, controlled by our integration | P2 | Later OAuth feature. More complex permissions and sync-state management. |
| Outlook direct sync | Writes/updates events through Microsoft Graph | Yes, controlled by our integration | P2 | Later OAuth feature. Similar sync-state complexity. |
| Native Apple Calendar write | Direct native calendar integration | Native app only | P3 | Normal website cannot reliably write/update Apple Calendar directly; use feed/download on web. |

### UX Rules

- Never hide alternatives behind the preferred path. Present Subscribe, Download, Image, PDF,
  and Notes as siblings in Silbo Packs/Sync.
- Be honest in the button labels:
  - "Subscribe - updates over time"
  - "Download .ics snapshot"
  - "Save image pages"
  - "Download PDF"
  - "Copy for Notes"
- Warn when exports are static: `.ics`, PNG, PDF, SVG, and text do not update after download.
- Use strict pagination instead of shrinking text. Long schedules become multiple pages.
- Add QR codes to static exports once share pages are live.
- Let users choose sport-specific templates, but default to the most readable one.
- Keep all export generation from our cached DB. Do not call provider APIs during a user
  export request.

### Backend/Data Needed

- `export_jobs`: optional server table for queued PDFs/large packs.
- `export_templates`: template key, sport family, density, theme, page size, status.
- `export_artifacts`: user/team/feed/export ID, file type, storage path, expiry, created_at.
- `share_pages`: live schedule URL target for QR codes and static export recovery.
- `calendar_feeds`: tokenized subscribed-calendar state.
- `event_change_log`: used to decide when static-export users should be prompted to refresh.

### Implementation Notes

- PNG can stay client-rendered for MVP because it is immediate and share-sheet friendly.
- PDF should probably be generated server-side once templates stabilize, especially for long
  schedules and community/team handouts.
- Use one intermediate layout model for PNG/PDF/SVG so all export formats share content,
  pagination, theme tokens, and sport-specific templates.
- Large export packs can be async: user requests pack, backend generates files, email sends a
  download link.

## Email Updates And Alert Infrastructure

Email is part of Silbo Alerts and should cover both reminders and schedule-change updates.
It is also useful for "your export pack is ready" and "this TBD match now has a time" flows.

### Recommended Provider Path

Start with **Resend** for MVP because it has a simple developer API, React-friendly email
templates, and a generous low-cost starting point. Current pricing page lists a free tier with
3,000 emails/month and a Pro tier at $20/month for 50,000 emails/month, with overage pricing.
Source: https://resend.com/pricing

Keep **Postmark** as the deliverability-first fallback once alerts become critical. Current
pricing page lists a free test tier of 100 emails/month and Basic/Pro plans starting around
10,000 emails/month. Source: https://postmarkapp.com/pricing

SendGrid is viable at scale, but it is a heavier product for this MVP. Source:
https://www.twilio.com/en-us/sendgrid

### Email Types

| Email | Trigger | Priority |
|---|---|---|
| Magic link sign-in | User requests login | P0 |
| Schedule changed | Followed event time/venue/status changes with `notify` significance | P1 |
| TBD now scheduled | Followed placeholder receives confirmed date/time | P1 |
| Reminder | User-configured lead time before event | P1 |
| Calendar feed created | User creates feed; raw URL shown once in UI and optionally emailed | P1 |
| Export pack ready | PDF/image pack generated server-side | P1/P2 |
| Weekly digest | Upcoming schedule summary | P2 |
| Fight-card live update | Prior bout ended / followed fight window approaching | P2, after live combat data |
| Provider outage/data warning | We detect stale source data for followed schedule | P2 |

### User Flow

1. User follows teams/leagues/players/drivers/fighters.
2. User signs in with magic link or Google when they want cross-device sync, feeds, or alerts.
3. Alerts screen asks for:
   - Email reminders on/off.
   - Change alerts on/off.
   - Digest on/off.
   - Reminder timing: 15 min, 30 min, 1 hour, 1 day.
   - Sport-specific options, e.g. fight-card "alert when previous bout ends."
4. Backend writes `alert_preferences`.
5. Provider sync creates `event_change_log` rows.
6. Notification materializer creates `notifications` rows.
7. Email worker claims due notifications atomically.
8. Provider sends email.
9. Webhook updates delivery status.
10. User can unsubscribe from one schedule, one alert type, or all emails.

### Infrastructure Shape

- Supabase Auth handles sign-in emails initially.
- Resend/Postmark handles product emails from our Edge Function or background worker.
- Tables:
  - `alert_preferences`
  - `notification_queue`
  - `notification_deliveries`
  - `email_unsubscribes`
  - `email_templates`
- Required secrets:
  - `RESEND_API_KEY` or `POSTMARK_SERVER_TOKEN`
  - `EMAIL_FROM_DOMAIN`
  - `EMAIL_REPLY_TO`
- Required DNS:
  - SPF, DKIM, DMARC for the sending domain.
- Required worker behavior:
  - idempotency key per user/event/change/alert type.
  - atomic claim to avoid duplicate sends.
  - retry with backoff.
  - dead-letter state after repeated failure.
  - unsubscribe and suppression checks before every send.

### Email Design Direction

Emails should be useful, not newsletter fluff.

- Subject lines:
  - "Canada vs France moved to 8:00 PM"
  - "Your Saturday sports schedule"
  - "Mexico kickoff confirmed"
  - "Your Silbo PDF pack is ready"
- Header:
  - Silbo Sports wordmark.
  - Small sport/league badge.
  - Local timezone shown clearly.
- Body:
  - One sentence explaining what changed or what is upcoming.
  - Event card with teams/competitors, date, time, venue, and status.
  - Buttons: "Open schedule", "Update calendar", "Manage alerts".
  - If static exports may now be stale, show "Download refreshed image/PDF".
- Footer:
  - Why the user received this.
  - One-click unsubscribe/manage preferences.
  - Data-source disclaimer when relevant.

### Guardrails

- Do not send alert emails for every silent provider correction.
- Batch low-importance changes into digests.
- Send immediate emails only for changes that affect a user's plan: time, date, venue,
  cancellation/postponement, TBD confirmed, or followed fight nearing start.
- Respect quiet hours later; until then, let users choose reminder timing.
- Keep kids/community-league emails ad-free by default.

## Sport Taxonomy

The frontend should show sport families first, then leagues/tournaments inside each family.

| Sport family | League/tournament examples |
|---|---|
| Soccer | FIFA World Cup, UEFA, EPL, La Liga, Bundesliga, Ligue 1, MLS |
| Basketball | NBA, WNBA, FIBA, EuroLeague, NCAA men, NCAA women |
| American Football | NFL, CFL, NCAA football, UFL |
| Hockey | NHL, PWHL, IIHF, junior/world championships |
| Tennis | ATP, WTA, Grand Slams, Davis Cup, Billie Jean King Cup |
| Golf | Masters, majors, PGA, LPGA, Ryder Cup, LIV if licensed |
| Motorsport | F1, NASCAR, IndyCar, MotoGP later |
| Combat Sports | UFC, PFL, boxing, ONE, Bellator/PFL lineage if available |
| Track & Field | World Athletics, Diamond League, Olympic trials, national championships |
| Olympic Sports | Olympics, swimming, gymnastics, athletics, cycling, rowing, niche events |
| Community | User-created teams, kids sports, school leagues, rec leagues |

Backend note: Master Plan 2's taxonomy should be extended beyond `mma` to support
`combat_sports`, `athletics`, and `olympic_sports`, or the app should keep those as display
families mapped to more specific backend sports.

## Data Source Research Snapshot

This is not yet a final procurement decision. It is the current source map for integration
testing.

| Source | Useful for | Notes |
|---|---|---|
| TheSportsDB | Broad schedule/artwork testing across many leagues | Crowd-sourced/open sports DB with teams, events, players, artwork, scores, TV listings, highlights, and JSON API; premium is low-cost and worth testing first. https://www.thesportsdb.com/ |
| API-SPORTS | Soccer, F1, MMA, NBA, NFL, other sport-specific APIs | Public site advertises broad sports APIs, 2,000+ competitions, historical data, and live updates; MMA docs exist. https://api-sports.io/ and https://api-sports.io/documentation/mma/v1 |
| OpenF1 | Formula 1 sessions, drivers, timing, telemetry | Open-source API. Historical data from 2023 onward is free without auth; real-time requires paid subscription. https://openf1.org/docs/ |
| SportsDataIO | Commercial NFL/NBA/WNBA/NHL/MMA/tennis/golf-style coverage | Commercial product with deep data, widgets, betting/fantasy products, and MMA/UFC real-time coverage. https://sportsdata.io/apis and https://sportsdata.io/mma-ufc-api |
| Sportradar | Enterprise sports, tennis, NFL, WNBA, NCAA, odds | B2B source with integration guides for major sports and odds APIs; not for direct client-side calls. https://developer.sportradar.com/getting-started/docs/get-started |
| The Odds API | Odds and sportsbook-adjacent data | Useful for odds context or affiliate/betting features, not as the primary schedule source. https://the-odds-api.com/sports-odds-data/sports-apis.html |
| World Athletics / athletics vendors | Track & Field | Official public API is not obvious. World Athletics has stats/schedule data, and third-party/vendor paths exist; scraping requires legal/terms review. https://worldathletics.org/stats-zone |
| Data Sports Group | Athletics, Olympic sports, and niche-sport vendor candidate | Strong fit for Track & Field/Olympic expansion if pricing works. Athletics page lists 25 competitions, 9.2K players, pre-session schedules, venue data, athlete profiles, start lists, post-session results, medal tables, historical archives, odds add-ons, Olympics, World Athletics Championships, Commonwealth Games, Paralympics, Diamond League, and many Olympic/niche sport APIs. Sales-led. https://datasportsgroup.com/coverage/athletics/ |
| Roster Athletics | Meet-level start lists/results for athletics organizers | Useful if a meet organizer, school, club, or federation uses Roster and gives us access. Supports manual/automated CSV export of start lists and results before/during/after competitions via authenticated cookies. Not a broad global public schedule provider by itself. https://support.rosterathletics.com/en/support/solutions/articles/44001899612-api-for-start-lists-and-results-scoreboards-tv-production-etc- |
| Sportradar Probabilities/Odds Schedule | Betting/odds schedule infrastructure | Returns scheduled sport events by sport ID and date from Sportradar's probabilities API. Useful for sportsbook/odds products and possibly schedule cross-checking if licensed, but this is an odds/probabilities surface, not our cheapest general schedule source. https://developer.sportradar.com/odds/reference/probabilities-sport-schedule |

### SportsJobs API List Review

SportsJobs' "12 Best Free Sports API Options for Developers in 2025" is useful as a scouting
list, but several entries are better for prototypes or analytics notebooks than for a
commercial schedule-sync product. Source:
https://www.sportsjobs.online/blogposts/43

| Provider/tool | Decision | Why |
|---|---|---|
| TheSportsDB | Test first | Best cheap broad-coverage candidate. Multi-sport, low-cost premium, artwork, teams, events, TV/highlight metadata. Good for initial catalog breadth, but validate data freshness and redistribution terms. |
| API-SPORTS | Test first | Best broad live-data candidate. Strong for soccer and has sport-specific APIs including F1/MMA/NBA/NFL-style coverage. Free tier is too small for production, but paid tiers may be efficient once cached. |
| MySportsFeeds | Test for North America | Good candidate for NFL/NBA/NHL/MLB-style North American depth. Official site positions it as affordable and flexible with free limited personal/private access. Need pricing/licensing review for public app use. |
| Sportmonks | Test for soccer/cricket/F1 | Strong developer experience. Free football plan is real but limited to Danish Superliga and Scottish Premiership; paid plan likely needed for major soccer. Also has cricket and F1 product lines. |
| SportsAPI360 | Evaluate carefully | Very cheap visible pricing for football/cricket, including $5-$10 tiers, but coverage appears narrower and brand/provider maturity needs validation before relying on it. Good low-cost benchmark. |
| football-data.org | Soccer fallback | Clean REST API and top competitions are positioned as free forever. Useful for European soccer fixtures/tables, but it is soccer-only and not enough for the full product. |
| OpenLigaDB | Soccer/World Cup fallback | Open football-oriented data with current World Cup surface. Useful as a fallback/test source, but community/open data quality and localization need validation. |
| Entity Sports | Sandbox only for now | Free development API is mainly for historical/completed data. Useful to test schemas and adapters, not enough for live MVP unless paid live access is attractive. |
| Sports Open Data | Avoid for core | Open/community model is interesting, but site quality, dated content, and casino-link noise make it risky for production trust. Use only if a specific endpoint proves valuable. |
| Sportsipy / Sports Python library | Analytics only | These scrape Sports-Reference-style data. Good for internal analytics experiments, not production feeds because scraping can break and may create terms/commercial-use issues. |
| Floodlight | Analytics only | Open-source analysis toolkit for tracking/event data, not a schedule provider. Potential future research tool, not an MVP data source. |

### Current Provider Shortlist

For the fastest, cheapest useful coverage:

1. **TheSportsDB premium** for broad multi-sport catalog, artwork, and low-cost schedule testing.
2. **API-SPORTS** for live/deeper feeds where TheSportsDB is weak, especially soccer, MMA,
   F1, NBA/NFL-style APIs, and World Cup data.
3. **OpenF1** for Formula 1, because historical data is free and real-time can be paid later.
4. **football-data.org** or **OpenLigaDB** as soccer fallbacks/check sources.
5. **SportsAPI360** only if its football/cricket endpoints validate well in test scripts.
6. **MySportsFeeds** for North American leagues if its licensing/pricing beats SportsDataIO or
   Sportradar for our early needs.
7. **Data Sports Group** for Track & Field/Olympic sports if the sales quote is realistic;
   it looks far more relevant for athletics than the cheap broad APIs.
8. **Roster Athletics** for user/organizer-provided meet schedules and results, especially
   school, club, community, and local athletics events.
9. **SportsDataIO/Sportradar** as higher-quality commercial paths when the product needs SLA,
   betting/fantasy-grade data, or league depth that cheap providers cannot supply.

The decision should not be "one provider forever." The right architecture is provider-agnostic:
normalize every feed into our DB, store provider IDs, diff changes, and keep per-sport adapters
replaceable.

### Scraping Position

Scraping should be a last resort, not the default. It may be acceptable for low-demand niche
coverage only if:

- Terms permit it or written permission exists.
- We cache aggressively and do not hammer official sites.
- We store source URLs and timestamps.
- We do not redistribute restricted data in exports/feeds without rights.
- We can turn the adapter off quickly if asked.

## Combat Sports Product Shape

Combat sports need their own event model:

- `event`: UFC 323, PFL World Tournament, boxing card.
- `card_sections`: early prelims, prelims, main card.
- `bouts`: ordered fights with fighter A/B, weight class, round count, status.
- `follow_target`: fighter, card, promotion, weight class.
- `estimated_start_at`: derived, uncertain, and updated live.
- `live_position`: current fight index / result state.
- `alert_rule`: notify when prior fight ends, when main card starts, or X minutes before followed bout.

Estimated fight time is possible, but it must be presented as a window, not a promise. The
system can estimate from card start time + bout order + average fight duration + broadcast
padding, then tighten the window as live results arrive.

This may become one of the most distinctive features of the product: "tell me when the fighter
I care about is about to walk."

## Gambling Ads And Betting Partnerships

Gambling ads can be lucrative and contextually aligned with sports, but they are legally and
platform sensitive.

Google paths:

- Google Ad Manager has a restricted **Gambling & betting (18+)** category. It can be allowed
  only where legal and is not recommended for audiences under 18:
  https://support.google.com/admanager/answer/3376862
- Google AdSense/AdMob sensitive-category controls treat gambling/betting as restricted and
  blocked by default in many surfaces:
  https://support.google.com/admob/answer/3150953
- Google advertiser policies require jurisdictional compliance and restrictions around age,
  location, licensing, and responsible-gambling warnings:
  https://support.google.com/adspolicy/answer/15132179

Recommendation:

- Do not put gambling ads on custom/kids/community league pages.
- Add an `ad_safety_profile` per surface: general, family, betting-eligible.
- Require region detection and age/responsible-gambling gates before direct sportsbook
  partnerships.
- Start with ordinary sports ads/sponsors first, then consider betting partnerships only on
  pro/college adult sports pages where legally allowed.
- Keep "odds" as an optional module, not part of the core schedule promise.

## API Caching And Query Efficiency

Yes, caching is exactly how this should work. We should not pull entire datasets repeatedly.
The backend should separate stable reference data from volatile schedule/live data.

### Cache Categories

| Data type | Examples | Update strategy |
|---|---|---|
| Stable reference | sports, leagues, venues, race circuits, event names | Seed once, diff weekly/monthly, manual review for changes |
| Seasonal reference | teams, drivers, fighters, rosters, players, tournament fields | Diff daily/weekly, more often near season/event start |
| Schedule | fixtures, races, fight cards, tee times, draw times | Diff daily; tighter cadence in active windows |
| Live state | scores, fight results, current bout, delays, postponements | Poll every 15-120 seconds only for live/followed events |
| User-specific views | selected picks, feeds, exports | Generate from local DB cache, not direct provider calls |

### Backend Pattern

- Store provider IDs for every entity.
- Store `source`, `source_url`, `last_checked_at`, `last_changed_at`, `payload_hash`.
- Keep raw payload snapshots in object storage when licensing allows.
- Use provider `updated_since`, ETag, cursor, or date-window endpoints when available.
- Run scheduled sync jobs by sport/league/active season.
- Increase polling only for events that are live, near start, or followed by users.
- Materialize schedule changes from DB diffs, then notify users from the change log.

This reduces cost because the public app reads our database/cache. Provider APIs are called by
scheduled backend jobs, not by every visitor.

## New Database/API Work Needed

- Add `sport_families` or expand canonical sports for `combat_sports`, `athletics`, and
  `olympic_sports`.
- Add `provider_entities` for cross-provider identity mapping.
- Add `provider_sync_state` with cursors, ETags, last-success, last-failure, and cadence.
- Add `event_bouts` details beyond the initial migration fields.
- Add `broadcasts` / `watch_links` region matching and rights metadata.
- Add `ad_slots` with safety profiles and surface restrictions.
- Add `export_templates` if we want user-selectable designs stored server-side.

## Next Implementation Order

1. Browser-test the new expanded cards, Popular Picks toggle, sport switcher, and high-res PNG
   export.
2. Add visual identity polish: stronger outlines, sport-specific texture layers, better active
   states, and one homepage hero/image treatment.
3. Add a committed Playwright mobile smoke test for homepage, sport page, expanded match card,
   export studio, and custom leagues.
4. Update backend taxonomy migration to match sport families or document the display/backend
   mapping explicitly.
5. Build provider-adapter test scripts for TheSportsDB, API-SPORTS, OpenF1, and one combat
   source.
6. Build the server cache/diff tables before plugging more UI into live APIs.
7. Prototype fight-card page and fight-card export template.
8. Decide whether Silbo replaces MatchPulse before final public branding and logo work.
