import { Link, useParams } from 'react-router-dom'
import { Button, EmptyState } from '../components/ui'

export function EventDetailPage() {
  const { eventId } = useParams()
  return (
    <EmptyState
      title="Event details are next"
      body={`Event ${eventId ?? ''} will carry time, venue, follows, exports, alerts, and where-to-watch details once the server event API is connected.`}
    >
      <Link to="/my-schedule">
        <Button variant="ghost">Back to My Schedule</Button>
      </Link>
    </EmptyState>
  )
}

export function LeaguePage() {
  const { leagueId } = useParams()
  return (
    <EmptyState
      title="League pages are staged"
      body={`${leagueId ?? 'This league'} will show teams, spotlight events, source freshness, and follow controls after the taxonomy migration lands.`}
    >
      <Link to="/explore">
        <Button variant="ghost">Back to Explore</Button>
      </Link>
    </EmptyState>
  )
}

export function TeamPage() {
  const { teamId } = useParams()
  return (
    <EmptyState
      title="Team pages are staged"
      body={`${teamId ?? 'This team'} will show upcoming events, where-to-watch context, and alert controls after server follows are connected.`}
    >
      <Link to="/explore">
        <Button variant="ghost">Back to Explore</Button>
      </Link>
    </EmptyState>
  )
}
