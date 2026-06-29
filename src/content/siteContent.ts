// Original long-form copy for the standalone editorial pages (/about, /how-it-works, /faq) and the
// homepage explainer. This is the substantive, unique content an AdSense reviewer reads to judge the
// site, so it is written to describe what Silbo Sports genuinely does. English-only by design.

export type Faq = { q: string; a: string }

export const aboutContent = {
  title: 'About Silbo Sports',
  intro:
    'Silbo Sports is a personal, multi-sport schedule. It takes the fixtures scattered across dozens of leagues and tournaments and brings the ones you care about into a single view, in your local time, that you can sync, export and share.',
  sections: [
    {
      heading: 'Why we built it',
      paragraphs: [
        'Following sport across more than one league quickly becomes a chore of open tabs and mental arithmetic. A Premier League kickoff, an NBA tip-off, a Formula 1 qualifying session and a UFC main card are each published on a different site, in a different time zone, in a different format. Working out when any of them actually starts where you live — and remembering to be there — is the part nobody enjoys.',
        'Silbo Sports exists to remove that friction. Choose the teams, leagues, players, drivers and fighters you follow, and we assemble their upcoming events into one schedule with every start time already converted to the time zone on your device. No spreadsheets, no offset math, no missed kickoffs.',
      ],
    },
    {
      heading: 'What it covers',
      paragraphs: [
        'Silbo spans soccer, basketball, American football, hockey, tennis, golf, motorsport, combat sports, baseball, track and field, and the Olympic and federation sports, alongside a growing set of expansion sports like cricket, rugby and esports. You can also build and share your own custom league schedules for local clubs, teams and community sport that no mainstream provider covers.',
        'Schedules are aggregated from publicly available sources and are best-effort: times, venues and broadcast details come from third parties and can change. We work to keep them accurate, and a subscribed calendar feed updates in place when they move — but for travel or money decisions you should always confirm against the official source.',
      ],
    },
    {
      heading: 'How we make money',
      paragraphs: [
        'Silbo Sports is free to use. We support the service with advertising, which only loads after you accept advertising cookies, and with affiliate "where to watch" links, which are labelled and may earn us a commission at no extra cost to you. We keep paid ads off community and custom-league surfaces, and we never let advertising compromise the accuracy of the schedule.',
      ],
    },
  ],
}

export const howItWorksContent = {
  title: 'How Silbo Sports works',
  intro:
    'Three steps: follow what you care about, see every start time in your local zone, then sync, export or get reminded. Here is what each one does.',
  steps: [
    {
      heading: '1. Follow what you care about',
      paragraphs: [
        'Search for a team, country, league, player, driver, fighter or tournament and follow it. You can follow across sports and competitions at once — a national team for the World Cup, a club for a league season, a Formula 1 team for the year, and a fighter for their next bout can all sit in the same schedule. You do not need an account to start; your picks are saved in your browser, and signing in syncs them across your devices.',
      ],
    },
    {
      heading: '2. See every start time in your local zone',
      paragraphs: [
        'Silbo converts each event from its venue time to the time zone on your device, so a kickoff, tip-off, lights-out or first pitch is shown when it actually happens where you are. Multi-session events like a Formula 1 weekend or a fight card are broken out so you can see practice, qualifying and the race — or the prelims and the main event — as separate entries.',
      ],
    },
    {
      heading: '3. Sync, export or get reminded',
      paragraphs: [
        'Add any event to your phone or desktop calendar, or subscribe once to a live calendar feed that updates in place when times change. Export your schedule as a calendar file, a shareable image or plain text, and turn on email or push reminders so you get a nudge before an event starts. Each event page also lists where to watch in your region.',
      ],
    },
  ],
}

export const faqContent = {
  title: 'Frequently asked questions',
  intro: 'Common questions about how Silbo Sports works, what it covers, and how your data is handled.',
  faqs: [
    {
      q: 'Is Silbo Sports free?',
      a: 'Yes. Silbo Sports is free to use. It is supported by advertising, which only loads after you accept advertising cookies, and by labelled affiliate "where to watch" links.',
    },
    {
      q: 'Do I need an account?',
      a: 'No. You can follow teams and build a schedule without signing in — your picks are stored in your browser. Signing in with a magic link or Google syncs your schedule and preferences across your devices and lets you turn on email or push reminders.',
    },
    {
      q: 'Which sports and leagues are covered?',
      a: 'Soccer, basketball, American football, hockey, tennis, golf, motorsport, combat sports, baseball, track and field, and the Olympic sports, plus expansion sports such as cricket, rugby, volleyball, handball, cycling, snooker, darts and esports. You can also create custom league schedules for sport that no mainstream provider tracks.',
    },
    {
      q: 'How are start times converted?',
      a: 'Every event is converted from its venue time to the time zone on your device, so you see when it starts where you are. You can also pick a different city or time zone if you are planning around another location.',
    },
    {
      q: 'How accurate are the schedules?',
      a: 'Schedules are aggregated from publicly available sources and are best-effort. Times, venues and broadcast details come from third parties and can change without notice. A subscribed calendar feed updates in place when they move, but you should confirm against official sources before travelling or making plans.',
    },
    {
      q: 'How does calendar sync work?',
      a: 'You can add a single event to your calendar as a one-off, or subscribe once to a live feed (an .ics URL) that your calendar app refreshes on its own. When a time in your feed changes, the entry updates in place — you do not have to re-add anything.',
    },
    {
      q: 'Can I share a schedule with friends?',
      a: 'Yes. You can export your schedule as a calendar file, an image or plain text to share, and custom league schedules can be published with a public share link for families, teams and clubs.',
    },
    {
      q: 'How do reminders work?',
      a: 'Once you sign in you can enable email or push reminders and choose how far ahead of an event you want to be notified. You can change or turn them off at any time from Alert settings.',
    },
    {
      q: 'What data do you collect?',
      a: 'If you use Silbo without an account, your picks stay in your browser. If you sign in, we store your email, your follows and your display preferences so your schedule follows you across devices. We do not sell your data, and ad-tracking cookies do not load until you accept them. See the Privacy Policy for the full detail.',
    },
    {
      q: 'Where do the "where to watch" links go?',
      a: 'They point to broadcasters and streaming services that carry an event in your region. Some are affiliate links, which are labelled; tapping one may earn us a commission at no extra cost to you. We never share your identity with the destination.',
    },
  ] as Faq[],
}
