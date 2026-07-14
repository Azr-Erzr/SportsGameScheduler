import { describe, expect, it, vi } from 'vitest'

describe('ticketOptionsFor', () => {
  it('builds direct ticket search links for US events', async () => {
    const { ticketOptionsFor } = await import('../ticketLinks')
    const links = ticketOptionsFor({
      title: 'Arsenal vs Barcelona',
      leagueName: 'UEFA Champions League',
      venue: 'MetLife Stadium',
      regionCode: 'US',
    })

    expect(links.map((link) => link.name)).toEqual(expect.arrayContaining(['Ticketmaster', 'StubHub', 'SeatGeek']))
    expect(links.find((link) => link.key === 'ticketmaster')?.href).toContain('ticketmaster.com/search?q=')
    expect(links.every((link) => link.href.startsWith('https://'))).toBe(true)
    expect(links.every((link) => link.affiliate === false)).toBe(true)
  })

  it('uses regional Ticketmaster domains where useful', async () => {
    const { ticketOptionsFor } = await import('../ticketLinks')
    expect(ticketOptionsFor({ title: 'Canada vs USA', regionCode: 'CA' })[0].href).toContain('ticketmaster.ca')
    expect(ticketOptionsFor({ title: 'England vs France', regionCode: 'GB' })[0].href).toContain('ticketmaster.co.uk')
    expect(ticketOptionsFor({ title: 'Sydney FC vs Melbourne Victory', regionCode: 'AU' })[0].href).toContain('ticketmaster.com.au')
    expect(ticketOptionsFor({ title: 'All Blacks vs Springboks', regionCode: 'NZ' })[0].href).toContain('ticketmaster.co.nz')
    expect(ticketOptionsFor({ title: 'Mexico vs USA', regionCode: 'MX' })[0].href).toContain('ticketmaster.com.mx')
  })

  it('can swap a provider to an approved affiliate URL without changing callers', async () => {
    vi.stubEnv('VITE_TICKET_AFFILIATE_STUBHUB', 'https://affiliate.example/stubhub')
    vi.resetModules()
    const { ticketOptionsFor } = await import('../ticketLinks')
    const stubhub = ticketOptionsFor({ title: 'Arsenal vs Barcelona', regionCode: 'US' }).find((link) => link.key === 'stubhub')

    expect(stubhub).toMatchObject({
      href: 'https://affiliate.example/stubhub',
      affiliate: true,
    })

    vi.unstubAllEnvs()
  })

  it('can swap Ticketmaster itself to an approved affiliate URL', async () => {
    vi.stubEnv('VITE_TICKET_AFFILIATE_TICKETMASTER', 'https://ticketmaster.evyy.net/c/7423477/123456/4272')
    vi.resetModules()
    const { ticketOptionsFor } = await import('../ticketLinks')
    const ticketmaster = ticketOptionsFor({
      title: 'Canada vs USA',
      regionCode: 'CA',
      eventId: 'event-123',
      placement: 'web-event-detail',
    })[0]
    const tracking = new URL(ticketmaster.href)

    expect(ticketmaster).toMatchObject({
      key: 'ticketmaster',
      affiliate: true,
    })
    expect(tracking.origin + tracking.pathname).toBe('https://ticketmaster.evyy.net/c/7423477/123456/4272')
    expect(tracking.searchParams.get('u')).toContain('https://www.ticketmaster.ca/search?q=Canada%20vs%20USA')
    expect(tracking.searchParams.get('subId1')).toBe('web-event-detail')
    expect(tracking.searchParams.get('subId2')).toBe('event-123')

    vi.unstubAllEnvs()
  })

  it('uses territory-specific contracts and never sends UK traffic through the default contract', async () => {
    vi.stubEnv('VITE_TICKET_AFFILIATE_TICKETMASTER', 'https://ticketmaster.evyy.net/c/7423477/111/4272')
    vi.stubEnv('VITE_TICKET_AFFILIATE_TICKETMASTER_UK', 'https://ticketmaster.evyy.net/c/7423477/222/9001')
    vi.resetModules()
    const { ticketOptionsFor } = await import('../ticketLinks')
    const uk = ticketOptionsFor({ title: 'Arsenal vs Chelsea', regionCode: 'GB' })[0]
    const ukTracking = new URL(uk.href)

    expect(uk.affiliate).toBe(true)
    expect(ukTracking.pathname).toContain('/222/9001')
    expect(ukTracking.searchParams.get('u')).toContain('ticketmaster.co.uk')

    vi.unstubAllEnvs()
    vi.stubEnv('VITE_TICKET_AFFILIATE_TICKETMASTER', 'https://ticketmaster.evyy.net/c/7423477/111/4272')
    vi.resetModules()
    const { ticketOptionsFor: withoutUkContract } = await import('../ticketLinks')
    expect(withoutUkContract({ title: 'Arsenal vs Chelsea', regionCode: 'GB' })[0].affiliate).toBe(false)

    vi.unstubAllEnvs()
  })

  it('deep-links an official event URL only when it matches the regional Ticketmaster domain', async () => {
    vi.stubEnv('VITE_TICKET_AFFILIATE_TICKETMASTER', 'https://ticketmaster.evyy.net/c/7423477/111/4272')
    vi.resetModules()
    const { ticketOptionsFor } = await import('../ticketLinks')
    const direct = ticketOptionsFor({
      title: 'Bills vs Dolphins',
      regionCode: 'US',
      ticketmasterUrl: 'https://www.ticketmaster.com/event/000012345',
    })[0]
    const rejected = ticketOptionsFor({
      title: 'Bills vs Dolphins',
      regionCode: 'US',
      ticketmasterUrl: 'https://www.ticketmaster.ca/event/unsafe-cross-region',
    })[0]

    expect(new URL(direct.href).searchParams.get('u')).toBe('https://www.ticketmaster.com/event/000012345')
    expect(new URL(rejected.href).searchParams.get('u')).toContain('ticketmaster.com/search?q=')

    vi.unstubAllEnvs()
  })
})
