import type { SupabaseClient } from '@supabase/supabase-js'

// Alert preferences live server-side (alert_preferences) because the notifications worker
// materializes reminders from user_follows × alert_preferences. They require an account.

export type AlertChannelPref = {
  targetType: 'league' | 'competitor'
  targetId: string
  emailEnabled: boolean
  pushEnabled: boolean
  remindMinutesBefore: number
  notifyTimeChanges: boolean
  notifyCancellations: boolean
  notifyNewEvents: boolean
  notifyParticipantUpdates: boolean
  notifyVenueChanges: boolean
  notifyBroadcastUpdates: boolean
}

export type FollowLabel = { id: string; name: string; type: 'league' | 'competitor' }

export function defaultAlertPref(targetType: 'league' | 'competitor', targetId: string, lead = 60): AlertChannelPref {
  return {
    targetType,
    targetId,
    emailEnabled: true,
    pushEnabled: false,
    remindMinutesBefore: lead,
    notifyTimeChanges: true,
    notifyCancellations: true,
    notifyNewEvents: true,
    notifyParticipantUpdates: true,
    notifyVenueChanges: true,
    notifyBroadcastUpdates: true,
  }
}

export async function loadAlertPreferences(supabase: SupabaseClient, userId: string): Promise<AlertChannelPref[]> {
  const { data } = await supabase
    .from('alert_preferences')
    .select(
      'target_type, target_id, email_enabled, push_enabled, remind_minutes_before, notify_time_changes, notify_cancellations, notify_new_events, notify_participant_updates, notify_venue_changes, notify_broadcast_updates',
    )
    .eq('user_id', userId)
  return (data ?? []).map((r) => ({
    targetType: r.target_type as 'league' | 'competitor',
    targetId: r.target_id as string,
    emailEnabled: r.email_enabled as boolean,
    pushEnabled: r.push_enabled as boolean,
    remindMinutesBefore: r.remind_minutes_before as number,
    notifyTimeChanges: r.notify_time_changes as boolean,
    notifyCancellations: r.notify_cancellations as boolean,
    notifyNewEvents: (r.notify_new_events ?? true) as boolean,
    notifyParticipantUpdates: (r.notify_participant_updates ?? true) as boolean,
    notifyVenueChanges: (r.notify_venue_changes ?? true) as boolean,
    notifyBroadcastUpdates: (r.notify_broadcast_updates ?? true) as boolean,
  }))
}

export async function saveAlertPreference(supabase: SupabaseClient, userId: string, pref: AlertChannelPref): Promise<void> {
  await supabase.from('alert_preferences').upsert(
    {
      user_id: userId,
      target_type: pref.targetType,
      target_id: pref.targetId,
      email_enabled: pref.emailEnabled,
      push_enabled: pref.pushEnabled,
      remind_minutes_before: pref.remindMinutesBefore,
      notify_time_changes: pref.notifyTimeChanges,
      notify_cancellations: pref.notifyCancellations,
      notify_new_events: pref.notifyNewEvents,
      notify_participant_updates: pref.notifyParticipantUpdates,
      notify_venue_changes: pref.notifyVenueChanges,
      notify_broadcast_updates: pref.notifyBroadcastUpdates,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,target_type,target_id' },
  )
}

export async function deleteAlertPreference(
  supabase: SupabaseClient,
  userId: string,
  targetType: string,
  targetId: string,
): Promise<void> {
  await supabase
    .from('alert_preferences')
    .delete()
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
}

// Resolve human names for the user's followed leagues + competitors so the alerts list is readable.
export async function resolveFollowLabels(
  supabase: SupabaseClient,
  leagueIds: string[],
  competitorIds: string[],
): Promise<FollowLabel[]> {
  const labels: FollowLabel[] = []
  if (leagueIds.length) {
    const { data } = await supabase.from('leagues').select('id, name').in('id', leagueIds)
    for (const l of data ?? []) labels.push({ id: l.id as string, name: l.name as string, type: 'league' })
  }
  if (competitorIds.length) {
    const { data } = await supabase.from('competitors').select('id, name').in('id', competitorIds)
    for (const c of data ?? []) labels.push({ id: c.id as string, name: c.name as string, type: 'competitor' })
  }
  return labels
}
