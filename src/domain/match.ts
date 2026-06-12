// World Cup match types for the current prototype dataset.
// These are the concrete shapes used by the WC2026 view today. The generic, multi-sport
// model the backend will use lives in ./types.ts.

export type RawMatch = {
  round: string
  num?: number
  date: string
  time: string
  team1: string
  team2: string
  group?: string
  ground: string
}

export type Match = RawMatch & {
  startsAt: Date
}
