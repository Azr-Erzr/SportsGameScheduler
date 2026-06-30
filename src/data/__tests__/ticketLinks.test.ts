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
})
