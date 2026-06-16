-- Flood the hydration allowlist with candidate leagues across all sports.
-- The hydrator self-verifies each (lookupleague + sport-match) and deactivates wrong IDs,
-- and wrong season labels degrade gracefully to the next-fixtures delta. So a generous
-- batch is safe by design.

insert into public.provider_targets
  (provider_key, provider_league_id, sport_key, expected_name, current_season, priority, is_active)
select 'thesportsdb', v.lid, v.sk, v.nm, v.season, v.pri, true
from (values
  -- Soccer: continental + major domestic
  ('4481','soccer','UEFA Europa League','2025-2026',18),
  ('4485','soccer','UEFA Conference League','2025-2026',19),
  ('4329','soccer','English League Championship','2025-2026',72),
  ('4337','soccer','Dutch Eredivisie','2025-2026',74),
  ('4344','soccer','Portuguese Primeira Liga','2025-2026',76),
  ('4330','soccer','Scottish Premiership','2025-2026',78),
  ('4339','soccer','Turkish Super Lig','2025-2026',80),
  ('4351','soccer','Brazilian Serie A','2026',82),
  ('4406','soccer','Argentine Liga Profesional','2026',84),
  ('4521','soccer','Saudi Pro League','2025-2026',86),
  -- Basketball
  ('4476','basketball','Spanish Liga ACB','2025-2026',120),
  ('4547','basketball','Australian NBL','2025-2026',122),
  ('5025','basketball','NCAA Basketball','2025-2026',124),
  -- Hockey
  ('4810','hockey','KHL','2025-2026',130),
  ('4965','hockey','Swedish SHL','2025-2026',132),
  -- American football
  ('5378','american_football','UFL','2026',140),
  ('4607','american_football','NCAA Football','2025',142),
  -- Golf
  ('4426','golf','DP World Tour','2026',150),
  ('4598','golf','LPGA Tour','2026',152),
  -- Motorsport
  ('4371','motorsport','Formula 2','2026',162),
  ('4373','motorsport','Formula 3','2026',164),
  ('4488','motorsport','World Endurance Championship','2026',166)
) as v(lid, sk, nm, season, pri)
where not exists (
  select 1 from public.provider_targets t
  where t.provider_key = 'thesportsdb' and t.provider_league_id = v.lid
);
