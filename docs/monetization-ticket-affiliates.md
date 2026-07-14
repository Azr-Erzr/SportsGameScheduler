# Ticket affiliate routing

Silbo treats affiliate URLs as regional program configuration, not event content. Events keep their
normal title, league, venue, and optional official ticket URL. At render time the ticket resolver:

1. Chooses the Ticketmaster domain for the visitor's region.
2. Uses an official Ticketmaster event URL from event metadata when one exists and matches that region.
3. Otherwise builds a regional Ticketmaster search from the event title, league, and venue.
4. Looks up the approved Impact tracking URL for that territory.
5. Adds the destination as Impact's percent-encoded `u` parameter.
6. Adds non-personal `subId1` (placement) and `subId2` (event id) values for reporting.
7. Falls back to the ordinary regional search when no approved contract is configured.

This makes newly synced events eligible automatically. No one should paste generated affiliate URLs into
individual event records.

## Click flow

```text
Silbo event/email
  -> Impact tracking URL (/c/{partner}/{ad}/{campaign})
  -> regional Ticketmaster event page or search results (`u=`)
  -> purchase attributed to the applicable Ticketmaster program
```

Impact documents `u` as its deep-link parameter. The destination must be an allowed brand domain/path.
Do not remove metadata already present on an Impact tracking URL. Do not reuse one territory's campaign
for another territory.

## Program inventory

The Impact account currently exposes these Ticketmaster programs:

- Ticketmaster (unqualified account program)
- Australia, Austria, Belgium, Brazil, Chile, Czech Republic, Denmark, Finland, France, Germany, Greece
- Ireland, Italia, Mexico, Nederland, New Zealand, Norway, Peru, Poland, Schweiz, South Africa, Spain
- Sweden, Turkiye, UAE, and UK

Canada currently uses the unqualified Ticketmaster contract only if that contract permits the
`ticketmaster.ca` destination. Keep the explicit Canada variable available so it can replace the fallback
without a code change.

## Website configuration

Set the full Impact tracking URL as a build-time variable. Examples:

```dotenv
VITE_TICKET_AFFILIATE_TICKETMASTER_US=https://ticketmaster.example/c/PARTNER/AD/CAMPAIGN
VITE_TICKET_AFFILIATE_TICKETMASTER_CA=https://ticketmaster.example/c/PARTNER/AD/CAMPAIGN
VITE_TICKET_AFFILIATE_TICKETMASTER_UK=https://ticketmaster.example/c/PARTNER/AD/CAMPAIGN
```

`VITE_TICKET_AFFILIATE_TICKETMASTER` remains the North American fallback while the regional values are
being populated. Other territories require their explicit variable.

## Email configuration

The Supabase notification function uses the corresponding function secrets without the `VITE_` prefix:

```powershell
supabase secrets set `
  TICKETMASTER_AFFILIATE_US="https://ticketmaster.example/c/PARTNER/AD/CAMPAIGN" `
  TICKETMASTER_AFFILIATE_CA="https://ticketmaster.example/c/PARTNER/AD/CAMPAIGN" `
  TICKETMASTER_AFFILIATE_UK="https://ticketmaster.example/c/PARTNER/AD/CAMPAIGN"
```

`TICKETMASTER_AFFILIATE_DEFAULT` is the North American fallback. Email ticket buttons are omitted when
no valid approved contract exists, and are omitted for cancelled or postponed events.

## Optional exact event destinations

If an upstream source provides a verified Ticketmaster event URL, store it in event metadata as one of:

- `ticketmaster_url` (preferred)
- `ticket_url`
- `tickets_url`

The resolver accepts it only when it is HTTPS and its hostname matches the recipient's regional
Ticketmaster domain. Other URLs fall back to regional search.

## Disclosure standard

Every paid ticket surface places this copy immediately beside or above the paid link:

> Paid link: Silbo Sports may earn a commission if you buy through this link, at no extra cost to you.

Each paid provider button is also visibly marked `Paid link` and uses `rel="sponsored noopener noreferrer"`
on the website. The same disclosure appears immediately below the ticket button in email and in the
plain-text email fallback. The Legal page remains supporting context, not a substitute for the nearby
disclosure.

## Reporting

- `subId1`: placement, such as `web-event-detail`, `web-home-season-tickets`, or `email-reminder`.
- `subId2`: Silbo event UUID. This is operational content data, not user data.
- Never put names, email addresses, account ids, or other personal information in Sub IDs.

Review Impact's Performance by Sub ID report after launch. A healthy report should show clicks split by
placement and event, with no cross-territory landing-page errors.

## Release checklist

1. Generate each full tracking URL from Impact's Create a link widget.
2. Test its default redirect before adding it to configuration.
3. Test one event deep link on the exact regional Ticketmaster domain.
4. Populate the website build variable and matching Supabase secret.
5. Build and deploy the site, then deploy the `notifications` function.
6. Click one website link and one email link in a non-production test message.
7. Confirm the final landing page, `subId1`, and `subId2` in Impact reporting.
