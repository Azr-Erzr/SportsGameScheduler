-- Esports as a first-class sport, hydrated by the PandaScore edge function
-- (supabase/functions/provider-hydrate-pandascore). Events/leagues/competitors attach to this
-- sport row via sport_id; the frontend reads them through useSportSchedule('esports').

insert into public.sports (key, name)
values ('esports', 'Esports')
on conflict (key) do nothing;
