# MatchPulse

A small World Cup 2026 watch scheduler. Pick the teams you care about, choose a city/timezone, and get a local-time fixture list with `.ics` calendar export.

## What it does

- Filters confirmed group-stage fixtures by selected teams.
- Converts kickoff times into the selected IANA timezone.
- Includes city presets and browser timezone detection.
- Exports the filtered schedule as a calendar file.
- Exports a high-resolution readable PNG schedule for saving to a phone Photos app.
- Shows a polished email/text alert signup flow ready for a backend integration.

## Data

Fixture data is bundled from the public-domain `openfootball/worldcup.json` 2026 dataset. FIFA's official fixture page should remain the source of truth before launch, especially if match times change.

## Run it

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
