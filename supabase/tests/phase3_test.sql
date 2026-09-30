-- Test della fase 3: funzioni e visibilità del pannello del fondatore.
-- Indipendente dagli altri file: crea i propri utenti.

-- Fondatrice Anna, iscritti Bruno (in lista d'attesa) e Carla (in lista d'attesa, due zone).
insert into public.pending_signups (email, first_name, job, format, zone_ids, slot_ids, gender, birth_year) values
  ('anna@test.it', 'Anna', 'Fondatrice', 'both', '{1}', '{1}', 'female', 1985),
  ('bruno@test.it', 'Bruno', 'Architetto', 'group', '{1}', '{1,2}', 'male', 1979),
  ('carla@test.it', 'Carla', 'Medico', 'group', '{1,2}', '{1}', 'female', 1990);
insert into auth.users (id, email, email_confirmed_at) values
  ('30000000-0000-0000-0000-00000000000a', 'anna@test.it', now()),
  ('30000000-0000-0000-0000-00000000000b', 'bruno@test.it', now()),
  ('30000000-0000-0000-0000-00000000000c', 'carla@test.it', now());
update public.profiles set role = 'founder', status = 'active' where id = '30000000-0000-0000-0000-00000000000a';

\echo '1. un iscritto non usa le funzioni del fondatore e non vede i locali'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-00000000000b';
select pg_temp.expect_error($$select public.founder_set_member_status('30000000-0000-0000-0000-00000000000c', 'active')$$, 'not_allowed');
select pg_temp.expect_error($$select public.founder_save_venue(null, 'Bar', 'Via Roma 1', 1::smallint, '', '{1}', true)$$, 'not_allowed');
select pg_temp.expect_error($$select * from public.founder_availability()$$, 'not_allowed');
select pg_temp.expect_error($$select public.founder_pending_signups_count()$$, 'not_allowed');
select pg_temp.check((select count(*) from public.venues) = 0, 'nessun locale visibile');
select pg_temp.check((select count(*) from public.member_status_events) = 0, 'nessuno storico visibile');
select pg_temp.expect_error($$insert into public.venues (name, address, zone_id) values ('X', 'Y', 1)$$, 'permission denied');
commit;

\echo '2. anon non usa le funzioni del fondatore'
begin;
set local role anon;
select pg_temp.expect_error($$select * from public.founder_availability()$$, 'permission denied');
commit;

\echo '3. approvazione, annullamento e storico'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-00000000000a';
select pg_temp.check(public.founder_set_member_status('30000000-0000-0000-0000-00000000000b', 'active') = 'waitlisted', 'restituisce lo stato precedente');
select pg_temp.check((select status from public.profiles where id = '30000000-0000-0000-0000-00000000000b') = 'active', 'Bruno attivo');
-- Annulla: torna in lista d'attesa.
select public.founder_set_member_status('30000000-0000-0000-0000-00000000000b', 'waitlisted');
select public.founder_set_member_status('30000000-0000-0000-0000-00000000000b', 'active');
select public.founder_set_member_status('30000000-0000-0000-0000-00000000000c', 'active');
-- Stesso stato: nessun evento in più.
select public.founder_set_member_status('30000000-0000-0000-0000-00000000000c', 'active');
select pg_temp.check((select count(*) from public.member_status_events where profile_id = '30000000-0000-0000-0000-00000000000b') = 3, 'tre eventi per Bruno');
select pg_temp.check((select count(*) from public.member_status_events where profile_id = '30000000-0000-0000-0000-00000000000c') = 1, 'un evento per Carla');
select pg_temp.check((select changed_by from public.member_status_events limit 1) = '30000000-0000-0000-0000-00000000000a', 'autore registrato');
select pg_temp.expect_error($$select public.founder_set_member_status('30000000-0000-0000-0000-00000000000a', 'expelled')$$, 'cannot_change_self');
select pg_temp.expect_error($$select public.founder_set_member_status('30000000-0000-0000-0000-0000000000ff', 'active')$$, 'not_found');
-- Il ruolo resta invariato.
select pg_temp.check((select role from public.profiles where id = '30000000-0000-0000-0000-00000000000b') = 'member', 'ruolo invariato');
commit;

\echo '4. matrice di disponibilità'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-00000000000a';
-- Zona 1 × slot 1: Anna, Bruno, Carla (più eventuali profili attivi di altri test).
create temp table av as select * from public.founder_availability();
select pg_temp.check((select members from av where zone_id = 2 and slot_id = 1) >= 1, 'Carla contata anche nella zona 2');
select pg_temp.check((select members from av where zone_id = 1 and slot_id = 2) >= 1, 'Bruno nello slot 2');
commit;
-- Bruno in pausa: sparisce dallo slot 2 della zona 1 (solo lui lo aveva scelto in questo file).
update public.profiles set invites_resume_on = public.rome_today() + 7 where id = '30000000-0000-0000-0000-00000000000b';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-00000000000a';
select pg_temp.check(
  coalesce((select members from public.founder_availability() where zone_id = 1 and slot_id = 2), 0)
  < (select members from av where zone_id = 1 and slot_id = 2),
  'chi è in pausa non è contato');
commit;
-- Sospeso: non contato.
update public.profiles set invites_resume_on = null, status = 'suspended' where id = '30000000-0000-0000-0000-00000000000c';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-00000000000a';
select pg_temp.check(
  coalesce((select members from public.founder_availability() where zone_id = 2 and slot_id = 1), 0)
  < (select members from av where zone_id = 2 and slot_id = 1),
  'chi è sospeso non è contato');
commit;

\echo '5. locali'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-00000000000a';
select pg_temp.expect_error($$select public.founder_save_venue(null, ' ', 'Via Roma 1', 1::smallint, '', '{1}', true)$$, 'invalid_venue_name');
select pg_temp.expect_error($$select public.founder_save_venue(null, 'Bar', 'Via Roma 1', 99::smallint, '', '{1}', true)$$, 'invalid_zones');
select pg_temp.expect_error($$select public.founder_save_venue(null, 'Bar', 'Via Roma 1', 1::smallint, '', '{99}', true)$$, 'invalid_slots');
create temp table v as select public.founder_save_venue(null, ' Bar Centrale ', 'Via Roma 1', 1::smallint, 'Tavolo in fondo', '{1,3}', true) as id;
select pg_temp.check((select name from public.venues where id = (select id from v)) = 'Bar Centrale', 'nome ripulito');
select pg_temp.check((select count(*) from public.venue_slots where venue_id = (select id from v)) = 2, 'due slot');
select public.founder_save_venue((select id from v), 'Bar Centrale', 'Via Roma 2', 2::smallint, '', '{2}', false);
select pg_temp.check((select address from public.venues where id = (select id from v)) = 'Via Roma 2', 'indirizzo modificato');
select pg_temp.check((select not active from public.venues where id = (select id from v)), 'locale disattivato');
select pg_temp.check((select array_agg(slot_id) from public.venue_slots where venue_id = (select id from v)) = '{2}', 'slot sostituiti');
select pg_temp.expect_error($$select public.founder_save_venue(999999, 'Bar', 'Via', 1::smallint, '', '{}', true)$$, 'not_found');
select pg_temp.check(public.founder_pending_signups_count() >= 0, 'conteggio iscrizioni non confermate');
commit;

\echo '6. il fondatore vede genere e anno nella lista iscritti; un iscritto no'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from public.profiles p join public.profile_private pp on pp.profile_id = p.id where p.email like '%@test.it') = 3, 'fondatore: tre righe private');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-00000000000b';
select pg_temp.check((select count(*) from public.profile_private) = 0, 'iscritto: nessuna riga privata');
commit;

\echo 'TUTTI I TEST DELLA FASE 3 SONO PASSATI'
