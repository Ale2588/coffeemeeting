-- Test della fase 4: tavoli, inviti, scadenze, conferma, disdetta, visibilità.
-- Indipendente dagli altri file: crea i propri utenti (prefisso 4…).

insert into public.pending_signups (email, first_name, job, format, zone_ids, slot_ids, gender, birth_year)
select e, n, 'Lavoro ' || n, 'both', '{1}', '{1}', 'female', 1985
from (values ('f4@t.it','Fede'), ('a4@t.it','Ada'), ('b4@t.it','Bea'), ('c4@t.it','Ciro'),
             ('d4@t.it','Dino'), ('e4@t.it','Elio'), ('g4@t.it','Gino'), ('w4@t.it','Walter')) as t(e, n);
insert into auth.users (id, email, email_confirmed_at) values
  ('40000000-0000-0000-0000-0000000000f0', 'f4@t.it', now()),
  ('40000000-0000-0000-0000-0000000000a0', 'a4@t.it', now()),
  ('40000000-0000-0000-0000-0000000000b0', 'b4@t.it', now()),
  ('40000000-0000-0000-0000-0000000000c0', 'c4@t.it', now()),
  ('40000000-0000-0000-0000-0000000000d0', 'd4@t.it', now()),
  ('40000000-0000-0000-0000-0000000000e0', 'e4@t.it', now()),
  ('40000000-0000-0000-0000-000000000070', 'g4@t.it', now()),
  ('40000000-0000-0000-0000-000000000077', 'w4@t.it', now());
update public.profiles set status = 'active' where email like '%4@t.it' and email <> 'w4@t.it';
update public.profiles set role = 'founder' where email = 'f4@t.it';
insert into public.venues (name, address, zone_id, notes) values ('Bar Quattro', 'Via Quattro 4', 1, 'accordo segreto');

-- Un martedì tra 7 e 13 giorni (slot 1 = martedì 7:45).
create temp table t4 as
select (d + ((2 - extract(isodow from d)::int + 7) % 7))::date as tue
from (select public.rome_today() + 7 as d) x;
grant select on t4 to authenticated, anon;

\echo '1. un iscritto non legge tavoli e inviti, non usa le funzioni del fondatore'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000a0';
select pg_temp.check((select count(*) from public.meetups) = 0, 'nessun tavolo visibile');
select pg_temp.check((select count(*) from public.invitations) = 0, 'nessun invito visibile');
select pg_temp.expect_error($$select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t4), 'group', null, '{}')$$, 'not_allowed');
select pg_temp.expect_error($$select public.expire_overdue_invitations()$$, 'permission denied');
commit;

\echo '2. bozza: validazioni'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000f0';
select pg_temp.expect_error($$select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t4) + 1, 'group', null, '{}')$$, 'invalid_date');
select pg_temp.expect_error($$select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t4) - 14, 'group', null, '{}')$$, 'invalid_date');
select pg_temp.expect_error($$select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t4), 'both', null, '{}')$$, 'invalid_format');
select pg_temp.expect_error($$select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t4), 'one_to_one', null,
  '{40000000-0000-0000-0000-0000000000a0,40000000-0000-0000-0000-0000000000b0,40000000-0000-0000-0000-0000000000c0}')$$, 'too_many_participants');
select pg_temp.expect_error($$select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t4), 'group', null,
  '{40000000-0000-0000-0000-000000000077}')$$, 'invalid_participants');
-- Bozza valida con tre persone e senza locale.
create temp table m4 as select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t4), 'group', null,
  '{40000000-0000-0000-0000-0000000000a0,40000000-0000-0000-0000-0000000000b0,40000000-0000-0000-0000-0000000000c0}') as id;
select pg_temp.check((select count(*) from public.invitations where meetup_id = (select id from m4) and status = 'draft') = 3, 'tre inviti in bozza');
-- Scadenza: 20:00 di due giorni prima, ora di Roma. Inizio: 7:45 ora di Roma.
select pg_temp.check((select (response_deadline at time zone 'Europe/Rome') = ((select tue from t4) - 2 + time '20:00') from public.meetups where id = (select id from m4)), 'scadenza 20:00 due giorni prima');
select pg_temp.check((select (starts_at at time zone 'Europe/Rome') = ((select tue from t4) + time '07:45') from public.meetups where id = (select id from m4)), 'inizio 7:45 ora di Roma');
commit;

\echo '3. la bozza è invisibile all iscritto'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000a0';
select pg_temp.check((select count(*) from public.my_invitations()) = 0, 'bozza invisibile');
commit;

\echo '4. invio: locale e numero di persone obbligatori'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000f0';
select pg_temp.expect_error($$select public.founder_send_meetup((select id from m4))$$, 'missing_venue');
select public.founder_save_meetup((select id from m4), 1::smallint, 1::smallint, (select tue from t4), 'group',
  (select id from public.venues where name = 'Bar Quattro'),
  '{40000000-0000-0000-0000-0000000000a0,40000000-0000-0000-0000-0000000000b0,40000000-0000-0000-0000-0000000000c0}');
select pg_temp.expect_error($$select public.founder_send_meetup((select id from m4))$$, 'invalid_group_size');
select public.founder_save_meetup((select id from m4), 1::smallint, 1::smallint, (select tue from t4), 'group',
  (select id from public.venues where name = 'Bar Quattro'),
  '{40000000-0000-0000-0000-0000000000a0,40000000-0000-0000-0000-0000000000b0,40000000-0000-0000-0000-0000000000c0,40000000-0000-0000-0000-0000000000d0}');
select public.founder_send_meetup((select id from m4));
select pg_temp.check((select count(*) from public.invitations where meetup_id = (select id from m4) and status = 'pending') = 4, 'quattro inviti inviati');
select pg_temp.expect_error($$select public.founder_save_meetup((select id from m4), 1::smallint, 1::smallint, (select tue from t4), 'group', null, '{}')$$, 'not_editable');
-- Stessa persona in un altro tavolo dello stesso giorno e slot.
select pg_temp.expect_error($$select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t4), 'group', null, '{40000000-0000-0000-0000-0000000000a0}')$$, 'participant_busy');
commit;

-- Id degli inviti, letti qui da superutente: agli iscritti la RLS li nasconde.
create temp table inv4 as select profile_id, id from public.invitations where meetup_id = (select id from m4);
grant select on inv4 to authenticated;

\echo '5. l iscritto vede il suo invito, senza note del locale'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000a0';
select pg_temp.check((select count(*) from public.my_invitations()) = 1, 'un invito');
select pg_temp.check((select status from public.my_invitations()) = 'pending', 'da confermare');
select pg_temp.check((select participants from public.my_invitations()) = 4, '4 persone, tu compreso');
select pg_temp.check((select venue_name || ' / ' || venue_address from public.my_invitations()) = 'Bar Quattro / Via Quattro 4', 'locale e indirizzo');
select pg_temp.check((select starts_at - free_cancellation_until from public.my_invitations()) = interval '12 hours', 'disdetta gratuita fino a 12 ore prima');
select pg_temp.check((select count(*) from public.venues) = 0, 'le note del locale restano nascoste');
select pg_temp.check((select count(*) from public.my_meetup_companions((select invitation_id from public.my_invitations()))) = 0, 'prima di confermare non vede nessuno');
commit;

\echo '6. conferma e compagni di tavolo'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000a0';
select pg_temp.check(public.confirm_invitation((select invitation_id from public.my_invitations())) = 'confirmed', 'Ada conferma');
select pg_temp.check((select count(*) from public.my_meetup_companions((select invitation_id from public.my_invitations()))) = 0, 'nessun altro ha confermato');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000b0';
select public.confirm_invitation((select invitation_id from public.my_invitations()));
-- Un altro iscritto non può confermare l'invito di Bea.
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000a0';
select pg_temp.check((select string_agg(first_name || ':' || job, ',') from public.my_meetup_companions((select invitation_id from public.my_invitations()))) = 'Bea:Lavoro Bea', 'Ada vede solo Bea, con nome e lavoro');
select pg_temp.expect_error(format('select public.confirm_invitation(%s)', (select id from inv4 where profile_id = '40000000-0000-0000-0000-0000000000c0')), 'not_found');
select pg_temp.check((select count(*) from public.my_meetup_companions((select id from inv4 where profile_id = '40000000-0000-0000-0000-0000000000b0'))) = 0, 'non si leggono i compagni dall invito di un altro');
commit;

\echo '7. scadenza di risposta'
update public.invitations set respond_by = now() - interval '1 minute' where profile_id = '40000000-0000-0000-0000-0000000000c0';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000c0';
select pg_temp.check((select status from public.my_invitations()) = 'expired', 'scaduto anche prima del job');
select pg_temp.check(public.confirm_invitation((select invitation_id from public.my_invitations())) = 'expired', 'conferma dopo la scadenza: scaduto');
commit;
select pg_temp.check((select status from public.invitations where profile_id = '40000000-0000-0000-0000-0000000000c0') = 'expired', 'stato scaduto salvato');

\echo '8. disdetta entro e oltre le 12 ore'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000d0';
select pg_temp.check(public.cancel_invitation((select invitation_id from public.my_invitations())), 'Dino disdice gratis');
select pg_temp.expect_error($$select public.cancel_invitation((select invitation_id from public.my_invitations()))$$, 'not_cancellable');
commit;
update public.meetups set starts_at = now() + interval '6 hours' where id = (select id from m4);
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000b0';
select pg_temp.check(not public.cancel_invitation((select invitation_id from public.my_invitations())), 'Bea disdice oltre le 12 ore');
commit;
update public.meetups set starts_at = ((select tue from t4) + time '07:45') at time zone 'Europe/Rome' where id = (select id from m4);

\echo '9. aggiunta di una persona a un tavolo inviato'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000f0';
select public.founder_add_participant((select id from m4), '40000000-0000-0000-0000-0000000000e0');
select pg_temp.check((select status from public.invitations where profile_id = '40000000-0000-0000-0000-0000000000e0') = 'pending', 'Elio invitato');
select pg_temp.check((select respond_by >= (select response_deadline from public.meetups where id = (select id from m4)) from public.invitations where profile_id = '40000000-0000-0000-0000-0000000000e0'), 'scadenza di Elio non anticipata');
select pg_temp.expect_error($$select public.founder_add_participant((select id from m4), '40000000-0000-0000-0000-0000000000e0')$$, 'already_invited');
select pg_temp.expect_error($$select public.founder_add_participant((select id from m4), '40000000-0000-0000-0000-000000000077')$$, 'invalid_participants');
commit;

\echo '10. un iscritto sospeso non conferma'
update public.profiles set status = 'suspended' where id = '40000000-0000-0000-0000-0000000000e0';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000e0';
select pg_temp.expect_error($$select public.confirm_invitation((select invitation_id from public.my_invitations()))$$, 'not_allowed');
commit;

\echo '11. colazioni fatte e annullamento del tavolo'
update public.meetups set starts_at = now() - interval '1 hour' where id = (select id from m4);
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-0000000000f0';
select pg_temp.check((select breakfasts from public.founder_breakfast_counts() where profile_id = '40000000-0000-0000-0000-0000000000a0') = 1, 'Ada: una colazione fatta');
select pg_temp.check((select count(*) from public.founder_breakfast_counts() where profile_id = '40000000-0000-0000-0000-0000000000b0') = 0, 'Bea ha disdetto: nessuna colazione');
-- Nuovo tavolo il martedì dopo con Gino, poi annullato.
create temp table m5 as select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t4) + 7, 'one_to_one',
  (select id from public.venues where name = 'Bar Quattro'),
  '{40000000-0000-0000-0000-000000000070,40000000-0000-0000-0000-0000000000a0}') as id;
select public.founder_send_meetup((select id from m5));
select public.founder_cancel_meetup((select id from m5));
select pg_temp.check((select count(*) from public.invitations where meetup_id = (select id from m5) and status = 'cancelled' and cancelled_by = 'founder') = 2, 'inviti annullati dal fondatore');
select pg_temp.expect_error($$select public.founder_cancel_meetup((select id from m5))$$, 'not_editable');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000070';
select pg_temp.expect_error($$select public.confirm_invitation((select invitation_id from public.my_invitations()))$$, 'meetup_cancelled');
commit;

\echo '12. job di scadenza'
update public.meetups set starts_at = now() + interval '3 days' where id = (select id from m4);
update public.invitations set status = 'pending', respond_by = now() - interval '1 minute' where profile_id = '40000000-0000-0000-0000-0000000000d0';
select pg_temp.check(public.expire_overdue_invitations() >= 1, 'il job rende persistenti gli scaduti');

\echo 'TUTTI I TEST DELLA FASE 4 SONO PASSATI'
