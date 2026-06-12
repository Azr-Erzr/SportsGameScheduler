// Provider adapter contract (plan Objective 4). Every external data source implements this;
// the sync function only ever sees normalized ProviderEvent values.

export type ProviderKey = 'worldcup_json' | 'thesportsdb' | 'api_sports' | 'openf1'

export type ProviderCompetitor = {
  role: 'home' | 'away' | 'driver' | 'player' | 'field' | 'participant'
  providerCompetitorId?: string
  name: string
  shortName?: string
  country?: string
}

export type ProviderEvent = {
  providerKey: ProviderKey
  providerEventId: string
  sportKey: string
  leagueExternalId?: string
  seasonExternalId?: string
  kind: string
  status: string
  title: string
  shortTitle?: string
  startsAt?: string
  startsAtTbd?: boolean
  timezone?: string
  venue?: { name: string; city?: string; country?: string; timezone?: string }
  competitors: ProviderCompetitor[]
  broadcasts?: Array<{ country: string; channel: string; streamUrl?: string }>
  metadata: Record<string, unknown>
  raw: unknown
}

export interface SportsProviderAdapter {
  key: ProviderKey
  listEvents(input: { leagueId?: string; season?: string; from: string; to: string }): Promise<ProviderEvent[]>
}
