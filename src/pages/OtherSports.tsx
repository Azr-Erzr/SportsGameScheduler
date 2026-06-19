import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SportChannelBanner } from '../components/SportChannelBanner'

// The "Other Sports" channel — the umbrella for everything outside the main category list.
// Coverage lands sport-by-sport as licensed schedule data comes online; until then each reads
// as a tracked-soon tile. Reuses the community art + theme (the `custom` sport key).
type OtherSport = {
  name: string
  note: string
}

const otherSports: OtherSport[] = [
  { name: 'Cricket', note: 'Tests, ODIs, T20 & franchise leagues' },
  { name: 'Rugby', note: 'Union, league, Sevens & World Cups' },
  { name: 'Badminton', note: 'BWF World Tour & championships' },
  { name: 'Table Tennis', note: 'ITTF tour, ping pong & Olympics' },
  { name: 'Squash', note: 'PSA World Tour' },
  { name: 'Volleyball', note: 'Indoor & beach (FIVB)' },
  { name: 'Handball', note: 'EHF & world championships' },
  { name: 'Lacrosse', note: 'PLL & World Lacrosse' },
  { name: 'Pickleball', note: 'PPA Tour & MLP' },
  { name: 'Cycling', note: 'Grand Tours, classics & worlds' },
  { name: 'Snooker', note: 'World Snooker Tour' },
  { name: 'Darts', note: 'PDC & World Championship' },
  { name: 'Baseball', note: 'MLB, NPB & the WBC' },
  { name: 'Esports', note: 'Majors across the big titles' },
  { name: 'Cricket Sevens', note: 'Short-form & exhibition events' },
  { name: 'Water Polo', note: 'World Aquatics calendar' },
]

export function OtherSportsPage() {
  return (
    <div className="space-y-6">
      <SportChannelBanner
        sportKey="custom"
        kicker="Channel 12 / Everything else"
        title="Other Sports"
        body="Badminton, cricket, rugby, squash, table tennis and the rest — the sports people actually play. Each one lands in your schedule as licensed coverage comes online."
        ctaLabel="Create your own league"
        ctaTo="/custom-leagues"
        stats={[
          { value: String(otherSports.length) + '+', label: 'Sports' },
          { value: 'Soon', label: 'Coverage' },
          { value: 'Your', label: 'Schedule' },
        ]}
      />

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-primary">Everything else people play</h2>
            <p className="text-sm text-ink/60">
              Coverage rolls out sport-by-sport. Want one sooner, or run your own?{' '}
              <Link to="/custom-leagues" className="font-bold text-primary underline-offset-2 hover:underline">
                Build a custom league
              </Link>
              .
            </p>
          </div>
          <Link to="/custom-leagues" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
            Create a league <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {otherSports.map((sport) => (
            <article
              key={sport.name}
              className="group relative overflow-hidden rounded-card border-2 border-primary/25 bg-surface/70 px-4 py-3.5 transition-colors hover:border-primary/45 hover:bg-primary/5"
            >
              <div className="absolute inset-y-0 left-0 w-1.5 bg-primary/70" aria-hidden="true" />
              <div className="flex items-start justify-between gap-3 pl-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black uppercase leading-tight text-primary">{sport.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink/62">{sport.note}</p>
                </div>
                <span className="shrink-0 rounded-sm bg-primary/15 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-primary">
                  Soon
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
