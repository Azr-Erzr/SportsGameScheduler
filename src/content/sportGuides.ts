import type { CanonicalSportKey } from '../domain/types'

// Original, evergreen editorial copy rendered VISIBLY on each /sports/:key hub (see SportPage).
// This is the substance an AdSense reviewer and a JS-rendering crawler actually read — distinct,
// sport-specific prose, not the templated fixture boilerplate. English-only by design; if a guide
// later earns localization it can move into the i18n table.
//
// Keep each guide genuinely useful and specific to the sport (formats, sessions, how scheduling
// actually works) rather than interchangeable marketing. Keyed by CANONICAL sport key.

export type SportFaq = { q: string; a: string }

export type SportGuide = {
  /** Plain-language H2 that frames the page beyond the fixture list. */
  heading: string
  /** One intriguing-but-informing sentence for the sport hub banner. No timezone — the banner
   *  appends the visitor's zone. Keep it to ~20–30 words so it reads on a single panel. */
  banner: string
  /** 2–3 original paragraphs on the sport and how Silbo tracks it. */
  intro: string[]
  /** Evergreen "how to follow the schedule in your timezone" paragraph. */
  howToWatch: string
  /** 3–5 real, answerable questions. Also emitted as FAQPage JSON-LD. */
  faqs: SportFaq[]
}

export const sportGuides: Partial<Record<CanonicalSportKey, SportGuide>> = {
  soccer: {
    heading: 'Soccer schedules in your local time',
    banner:
      'The World Cup, the Champions League and a dozen domestic leagues, all on different clocks — follow your teams and every kickoff converts to where you are.',
    intro: [
      'Soccer is the hardest sport to keep up with by hand: the World Cup, UEFA club competitions, the Premier League, La Liga, Serie A, the major continental cups and dozens of domestic leagues all run on their own calendars, in their own time zones, often overlapping across a single weekend. A kickoff listed as 3:00pm in England is 10:00am on the U.S. East Coast and the early hours of the next morning in Australia — and that math is exactly where plans fall apart.',
      'Silbo Sports pulls upcoming soccer fixtures into one place and converts every kickoff to the time zone on your device. Follow a national team for the World Cup, a club for a full league season, or an individual competition, and the matches that matter to you sit together in a single schedule you can sort, sync and share.',
    ],
    howToWatch: 'Pick the teams, leagues or tournaments you care about and Silbo lists their next fixtures with the kickoff already converted to your local time. Add any match to your phone or desktop calendar with one tap, set a reminder before kickoff, and check the "where to watch" links for the broadcasters and streams carrying it in your region.',
    faqs: [
      { q: 'How are World Cup match times shown?', a: 'Every World Cup 2026 kickoff is converted from the venue time to the local time on your device, so you never have to work out the offset between the host cities and where you are watching.' },
      { q: 'Can I follow more than one league at once?', a: 'Yes. Follow as many teams, leagues and competitions as you like — the Premier League, La Liga, Champions League and your national team can all live in the same schedule, sorted by date and time.' },
      { q: 'What happens when a kickoff time changes?', a: 'When a fixture is rescheduled or moved for broadcast, the updated time syncs through automatically, and a subscribed calendar feed updates in place without you re-adding anything.' },
    ],
  },
  basketball: {
    heading: 'Basketball schedules without the timezone math',
    banner:
      'From NBA tip-offs to FIBA windows and March brackets, the games you follow stack up in one place — no working out when a road game actually starts.',
    intro: [
      'Basketball runs almost year-round once you account for the NBA and WNBA seasons, the NCAA tournament, FIBA international windows and EuroLeague nights. Tip-off times shift constantly for national broadcasts, and international games are often scheduled in a completely different part of the day from where the audience is watching.',
      'Silbo Sports gathers upcoming basketball games into a single local-time schedule. Follow a team for a full season, track an international window, or keep an eye on the bracket during March — the games you care about are grouped together with the tip-off already in your time zone.',
    ],
    howToWatch: 'Follow your teams and leagues and Silbo lists each upcoming game with the tip-off converted to your local time. Add games to your calendar, get a reminder before tip-off, and use the where-to-watch links to find the national or regional broadcaster carrying the game.',
    faqs: [
      { q: 'Does this cover both the NBA and WNBA?', a: 'Yes — both leagues are tracked, alongside FIBA international windows and college basketball, so you can follow the teams and competitions you care about in one schedule.' },
      { q: 'Are international game times converted?', a: 'Yes. A EuroLeague or FIBA tip-off is converted from the venue time to the local time on your device, which is what makes early-morning or late-night international windows easy to plan around.' },
    ],
  },
  american_football: {
    heading: 'Football kickoffs, playoffs and bowls in your time zone',
    banner:
      'Sundays, Monday nights, rivalry weeks and bowl season — every kickoff lands in one schedule, even when the networks keep flexing the start time.',
    intro: [
      'American football packs an enormous amount into a short window: NFL Sundays, Monday and Thursday night games, the college football season with its rivalry weeks and bowl games, the CFL season and the long playoff run toward the championship. Kickoff times are spread across the day and frequently flexed for television, which makes a fixed printed schedule unreliable within days.',
      'Silbo Sports collects upcoming football games into one local-time schedule. Follow a team through the regular season and into the playoffs, and every kickoff is grouped together with the start time already converted to your device’s time zone.',
    ],
    howToWatch: 'Follow your teams and leagues and Silbo shows each upcoming game with the kickoff in your local time. Add games to your calendar, set a reminder, and check the where-to-watch links for the network or stream carrying each game in your region.',
    faqs: [
      { q: 'Does it include college football and bowls?', a: 'Yes — NCAA football and the bowl schedule are tracked alongside the NFL and CFL, so you can follow your college team and pro team together.' },
      { q: 'How are flexed or rescheduled kickoffs handled?', a: 'When a kickoff is flexed or moved, the updated time syncs through automatically and any subscribed calendar feed updates in place.' },
    ],
  },
  hockey: {
    heading: 'Every puck drop in your local time',
    banner:
      'Regular-season puck drops to playoff overtime, NHL to PWHL to IIHF — the games you care about, grouped together and counted down to the drop.',
    intro: [
      'Hockey schedules are dense. The NHL plays a long regular season into a two-month playoff run, the PWHL has its own calendar, and IIHF tournaments bring international windows that sit at unusual hours for many fans. Puck-drop times move for national broadcasts and back-to-back nights are common.',
      'Silbo Sports pulls upcoming hockey games into a single local-time schedule. Follow a team for the season, track the playoffs, or keep an eye on an international tournament — every game is grouped together with the puck drop already in your time zone.',
    ],
    howToWatch: 'Follow your teams and leagues and Silbo lists each upcoming game with the puck drop converted to your local time. Add games to your calendar, get a reminder, and use the where-to-watch links to find the broadcaster carrying the game.',
    faqs: [
      { q: 'Are playoff games included?', a: 'Yes. Once the bracket is set, playoff games appear in your schedule as they are confirmed, with start times in your local time zone.' },
      { q: 'Does it cover international hockey?', a: 'IIHF and other international windows are tracked, with start times converted from the host country to your device’s time zone.' },
    ],
  },
  tennis: {
    heading: 'Tennis draws and start-time windows, converted for you',
    banner:
      'Tours that hop continents week to week and Slams with no fixed clock — Silbo shows the session and start windows so you know roughly when to tune in.',
    intro: [
      'Tennis is uniquely hard to schedule around. The ATP and WTA tours move between continents week to week, and at the Grand Slams a match is not given a fixed clock time — it is "not before" a session start, or scheduled behind however many matches come first on the same court. For fans in another time zone, that uncertainty stacks on top of the offset.',
      'Silbo Sports brings upcoming tennis into one local-time view. Follow a player or a tournament and Silbo shows the session and start windows converted to your device’s time zone, so you know roughly when to tune in even when the order of play is still settling.',
    ],
    howToWatch: 'Follow players and tournaments and Silbo lists upcoming matches and session windows in your local time. Add a session to your calendar, set a reminder, and use the where-to-watch links to find coverage in your region.',
    faqs: [
      { q: 'How do you handle "not before" times at Grand Slams?', a: 'Where only a session or "not before" window is published, Silbo shows that window converted to your local time rather than inventing a precise clock time, so the schedule stays honest.' },
      { q: 'Can I follow a single player across tournaments?', a: 'Yes. Follow a player and their upcoming matches surface across whichever tour events they enter, all in one schedule.' },
    ],
  },
  golf: {
    heading: 'Tee times, rounds and final-day windows in your zone',
    banner:
      'Four rounds, a global tour, and a decisive Sunday window that can land at midnight — the majors and tours mapped to when they actually happen for you.',
    intro: [
      'Golf runs as a four-round tournament across a long weekend, often on a different continent from where you are watching. Tee times are early and staggered, the leaders go out last, and the decisive final-round window can land in the middle of your night depending on where the event is being played.',
      'Silbo Sports collects upcoming golf into one local-time schedule. Follow the majors, the PGA and LPGA Tours, or the Ryder Cup, and each round window is converted to your device’s time zone so you can plan around the part of the day that actually matters.',
    ],
    howToWatch: 'Follow the tours and events you care about and Silbo shows upcoming rounds with start windows in your local time. Add a round to your calendar, set a reminder for the final day, and use the where-to-watch links to find coverage in your region.',
    faqs: [
      { q: 'Does it cover the majors and the Ryder Cup?', a: 'Yes — the majors, regular PGA and LPGA Tour events, and team events like the Ryder Cup are tracked, with round windows in your local time.' },
      { q: 'Are tee times exact?', a: 'Round start windows are shown converted to your time zone; exact pairings and tee times are published close to the event and update as they are confirmed.' },
    ],
  },
  motorsport: {
    heading: 'Race weekends, sessions and lights-out in your time zone',
    banner:
      'A race weekend is a sequence — practice, qualifying, sprint, then lights-out. Silbo lays out every session so a flyaway round never slips past you.',
    intro: [
      'A motorsport weekend is not a single event — it is a sequence. A Formula 1 round alone runs practice, qualifying, sometimes a sprint, and then the race, each at its own time, often from a circuit many hours offset from home. NASCAR and IndyCar add their own calendars. Miss the offset on a flyaway round and you miss qualifying entirely.',
      'Silbo Sports lays out the whole weekend in your local time. Follow a series and every session — practice, qualifying, sprint and race — appears with its start time converted to your device’s time zone, so a lights-out at an awkward hour never sneaks past you.',
    ],
    howToWatch: 'Follow the series you watch and Silbo lists each session of the weekend in your local time. Add the race — or every session — to your calendar, set a reminder before lights-out, and use the where-to-watch links to find coverage in your region.',
    faqs: [
      { q: 'Are practice and qualifying shown, not just the race?', a: 'Yes. For series like Formula 1 the full weekend — practice, qualifying, sprint and race — is laid out as separate sessions, each in your local time.' },
      { q: 'How are flyaway races at odd hours handled?', a: 'Every session is converted from the circuit’s local time to your device’s time zone, which is exactly what makes early-morning flyaway rounds easy to plan around.' },
    ],
  },
  combat_sports: {
    heading: 'Fight cards, main events and prelims, converted for you',
    banner:
      'Prelims to the main-event walk-in, UFC to boxing to PFL — Silbo estimates when the fight you actually want starts, not just when the broadcast opens.',
    intro: [
      'Combat sports schedule in layers. A UFC or boxing card runs prelims first and the main event last, and the headline fight can start hours after the broadcast opens — often very late at night, and later still if you are in a different time zone. Cards also change: bouts fall out, the order shifts, and the main-event walk-in time slides with the night.',
      'Silbo Sports brings upcoming fight cards into one local-time view. Follow a promotion or a fighter and Silbo shows the card with estimated local windows for the prelims and the main event, so you know when to tune in for the fight you actually care about.',
    ],
    howToWatch: 'Follow promotions and fighters and Silbo lists upcoming cards with estimated start windows in your local time. Add a card to your calendar, set a reminder, and use the where-to-watch links to find the broadcaster or pay-per-view carrying it in your region.',
    faqs: [
      { q: 'Do you show when the main event actually starts?', a: 'Silbo shows an estimated local window for the main event as well as the card start, because the headline walk-in is usually hours after the broadcast opens. Live cards can slide with stoppages and decisions.' },
      { q: 'Can I follow a single fighter?', a: 'Yes. Follow a fighter and their next bout surfaces in your schedule whenever it is announced, with the card time in your local zone.' },
    ],
  },
  athletics: {
    heading: 'Track and field sessions, heats and finals in your time',
    banner:
      'Heats, qualifying and finals packed into morning and evening sessions — Silbo surfaces the moments worth catching from the wider programme.',
    intro: [
      'Track and field is a session sport. A World Athletics championship or Diamond League meeting runs morning and evening sessions packed with heats, qualifying rounds and finals, and the events you actually want — a specific final, a particular athlete’s race — sit at a precise time inside a long programme, frequently from another continent.',
      'Silbo Sports brings upcoming athletics into one local-time schedule. Follow a meeting or the championship calendar and the sessions appear with start times converted to your device’s time zone, so you can plan around the finals rather than the whole programme.',
    ],
    howToWatch: 'Follow the meetings and championships you care about and Silbo shows upcoming sessions in your local time. Add a session to your calendar, set a reminder for a final, and use the where-to-watch links to find coverage in your region.',
    faqs: [
      { q: 'Are individual finals listed?', a: 'Sessions are listed with their start times in your local zone; as start lists and timetables are confirmed, the finals and headline events are reflected in the schedule.' },
      { q: 'Does it cover the Diamond League and championships?', a: 'Yes — the Diamond League series, World Athletics championships and major trials are tracked, with session times converted to your time zone.' },
    ],
  },
  olympic_sports: {
    heading: 'Olympic and federation sports, all in one local schedule',
    banner:
      'The sports the world watches every four years, all running at once on a far-off clock — the medal sessions you want, brought into one view.',
    intro: [
      'The Olympic sports are the ones most people only follow intensely every few years — swimming, gymnastics, athletics, rowing, climbing and dozens more — and during a Games they all run at once, across many venues, on a host-city clock that can be twelve or more hours from home. Medal sessions are the moments to catch, and they are easy to miss in a crowded programme.',
      'Silbo Sports gathers these schedules into a single local-time view. Follow the sports and sessions you care about and the start times are converted to your device’s time zone, so the medal events you want to watch are easy to find and plan around.',
    ],
    howToWatch: 'Follow the sports and sessions that interest you and Silbo lists them in your local time. Add a session to your calendar, set a reminder for a final or medal event, and use the where-to-watch links to find coverage in your region.',
    faqs: [
      { q: 'Which Olympic sports are covered?', a: 'Coverage spans the major Olympic and federation sports as their schedules are published, brought together so you do not have to check each federation’s site separately.' },
      { q: 'Are medal sessions highlighted?', a: 'Sessions are shown with their local start times so you can pick out finals and medal events from the wider programme and add just those to your calendar.' },
    ],
  },
  baseball: {
    heading: 'First pitches and postseason in your local time',
    banner:
      'A daily marathon from first pitch to October — follow a team and every game lands in one schedule, doubleheaders and all, in your local time.',
    intro: [
      'Baseball is a marathon. An MLB season runs daily for months, often with doubleheaders, before a postseason that escalates into the World Series, and international leagues like NPB and KBO play on their own calendars and clocks. First-pitch times shift for national broadcasts and travel, and following a team across that grind by hand is relentless.',
      'Silbo Sports collects upcoming baseball into one local-time schedule. Follow a team and every first pitch is grouped together with the start time converted to your device’s time zone, through the regular season and into October.',
    ],
    howToWatch: 'Follow your teams and leagues and Silbo lists each game with the first pitch in your local time. Add games to your calendar, set a reminder, and use the where-to-watch links to find the broadcaster carrying each game.',
    faqs: [
      { q: 'Does it cover the postseason and World Series?', a: 'Yes. As the bracket is set, postseason games appear in your schedule with first-pitch times in your local zone.' },
      { q: 'Are international leagues included?', a: 'Leagues such as NPB and KBO are tracked alongside MLB, with first-pitch times converted from the host country to your device’s time zone.' },
    ],
  },
}

export function getSportGuide(canonicalKey: string | null | undefined): SportGuide | null {
  if (!canonicalKey) return null
  return sportGuides[canonicalKey as CanonicalSportKey] ?? null
}
