export const cityOptions = [
  { label: 'Toronto', zone: 'America/Toronto' },
  { label: 'New York', zone: 'America/New_York' },
  { label: 'Los Angeles', zone: 'America/Los_Angeles' },
  { label: 'Mexico City', zone: 'America/Mexico_City' },
  { label: 'Vancouver', zone: 'America/Vancouver' },
  { label: 'London', zone: 'Europe/London' },
  { label: 'Paris', zone: 'Europe/Paris' },
  { label: 'Dubai', zone: 'Asia/Dubai' },
  { label: 'Tokyo', zone: 'Asia/Tokyo' },
  { label: 'Sydney', zone: 'Australia/Sydney' },
]

export function cityLabelFor(timezone: string, city: string) {
  return city || cityOptions.find((item) => item.zone === timezone)?.label || 'Your city'
}
