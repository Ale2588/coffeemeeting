-- Test della fase 2: iscrizione, conferma email, RLS, preferenze, pausa.
-- Ogni blocco solleva un'eccezione se l'aspettativa non è rispettata.

-- Aiuto: esegue uno statement e verifica che fallisca con un messaggio che contiene `expected`.
create function pg_temp.expect_error(stmt text, expected text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'ATTESO ERRORE "%" MA NESSUN ERRORE: %', expected, stmt;
exception when others then
  if sqlerrm like 'ATTESO ERRORE%' or position(expected in sqlerrm) = 0 then
    raise exception 'Errore diverso da "%": % (%)', expected, sqlerrm, stmt;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

create function pg_temp.check(ok boolean, what text) returns void
language plpgsql as $$ begin if not ok then raise exception 'FALLITO: %', what; end if; end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

\echo '1. anon legge il catalogo, non i profili'
begin;
set local role anon;
select pg_temp.check((select count(*) from public.zones) = 8, 'anon vede 8 zone');
select pg_temp.check((select count(*) from public.slots) = 4, 'anon vede 4 slot');
select pg_temp.expect_error('select * from public.profiles', 'permission denied');
select pg_temp.expect_error('select * from public.pending_signups', 'permission denied');
select pg_temp.expect_error('select * from public.profile_private', 'permission denied');
commit;

\echo '2. submit_signup valida i dati'
begin;
set local role anon;
select pg_temp.expect_error($$select public.submit_signup('non-email', 'Chiara', 'Consulente', 'group', '{1}', '{1}', 'female', 1988::smallint)$$, 'invalid_email');
select pg_temp.expect_error($$select public.submit_signup('a@b.it', ' ', 'Consulente', 'group', '{1}', '{1}', 'female', 1988::smallint)$$, 'invalid_first_name');
select pg_temp.expect_error($$select public.submit_signup('a@b.it', 'Chiara', 'Consulente', 'group', '{}', '{1}', 'female', 1988::smallint)$$, 'invalid_zones');
select pg_temp.expect_error($$select public.submit_signup('a@b.it', 'Chiara', 'Consulente', 'group', '{99}', '{1}', 'female', 1988::smallint)$$, 'invalid_zones');
select pg_temp.expect_error($$select public.submit_signup('a@b.it', 'Chiara', 'Consulente', 'group', '{1}', '{}', 'female', 1988::smallint)$$, 'invalid_slots');
select pg_temp.expect_error(format($$select public.submit_signup('a@b.it', 'Chiara', 'Consulente', 'group', '{1}', '{1}', 'female', %s::smallint)$$, extract(year from now())::int - 10), 'invalid_birth_year');
select pg_temp.expect_error($$select public.submit_signup('a@b.it', 'Chiara', 'Consulente', 'group', '{1}', '{1}', null, 1988::smallint)$$, 'invalid_gender');
-- Validi: Chiara (due zone, due slot) e Marco.
select public.submit_signup(' Chiara@Esempio.IT ', 'Chiara', 'Consulente', 'group', '{1,2}', '{1,3}', 'female', 1988::smallint);
select public.submit_signup('marco@esempio.it', 'Marco', 'Avvocato', 'both', '{1}', '{2}', 'male', 1980::smallint);
-- Reinvio: sovrascrive l'iscrizione in attesa.
select public.submit_signup('marco@esempio.it', 'Marco', 'Avvocato', 'both', '{1,3}', '{2}', 'male', 1981::smallint);
commit;
select pg_temp.check((select count(*) from public.pending_signups) = 2, 'due iscrizioni in attesa');
select pg_temp.check((select zone_ids from public.pending_signups where email = 'marco@esempio.it') = '{1,3}', 'reinvio sovrascrive');

\echo '3. il profilo nasce solo alla conferma dell email'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'chiara@esempio.it'),
  ('00000000-0000-0000-0000-0000000000b2', 'marco@esempio.it');
select pg_temp.check((select count(*) from public.profiles) = 0, 'nessun profilo prima della conferma');
update auth.users set email_confirmed_at = now();
select pg_temp.check((select count(*) from public.profiles where status = 'waitlisted' and role = 'member') = 2, 'due profili in lista d attesa');
select pg_temp.check((select count(*) from public.profile_zones where profile_id = '00000000-0000-0000-0000-0000000000a1') = 2, 'Chiara ha due zone');
select pg_temp.check((select count(*) from public.profile_slots where profile_id = '00000000-0000-0000-0000-0000000000a1') = 2, 'Chiara ha due slot');
select pg_temp.check((select birth_year from public.profile_private where profile_id = '00000000-0000-0000-0000-0000000000b2') = 1981, 'anno di Marco');
select pg_temp.check((select count(*) from public.pending_signups) = 0, 'iscrizioni in attesa consumate');

\echo '4. un iscritto vede solo i propri dati e non il proprio genere'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.check((select count(*) from public.profiles) = 1, 'Chiara vede un profilo');
select pg_temp.check((select first_name from public.profiles) = 'Chiara', 'ed è il suo');
select pg_temp.check((select count(*) from public.profile_zones) = 2, 'Chiara vede solo le sue zone');
select pg_temp.check((select count(*) from public.profile_private) = 0, 'Chiara non vede genere e anno');
select pg_temp.check(not public.is_founder(), 'Chiara non è fondatrice');
select pg_temp.expect_error($$update public.profiles set role = 'founder'$$, 'permission denied');
select pg_temp.expect_error($$update public.profiles set status = 'active'$$, 'permission denied');
select pg_temp.expect_error($$insert into public.profile_zones values ('00000000-0000-0000-0000-0000000000a1', 5)$$, 'permission denied');
select pg_temp.expect_error($$select public.submit_signup('x@y.it', 'X', 'Y', 'group', '{1}', '{1}', 'female', 1988::smallint) from public.pending_signups$$, 'permission denied');
commit;

\echo '5. modifica preferenze e pausa'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.update_my_preferences('Chiara', 'Consulente legale', 'both', '{4,5,6}', '{2}');
select pg_temp.check((select job from public.profiles) = 'Consulente legale', 'lavoro aggiornato');
select pg_temp.check((select count(*) from public.profile_zones) = 3, 'tre zone');
select pg_temp.check((select count(*) from public.profile_slots) = 1, 'uno slot');
select pg_temp.expect_error($$select public.update_my_preferences('Chiara', 'X', 'both', '{}', '{2}')$$, 'invalid_zones');
select pg_temp.expect_error($$select public.set_my_invite_pause(public.rome_today())$$, 'invalid_resume_date');
select pg_temp.expect_error($$select public.set_my_invite_pause(public.rome_today() + 400)$$, 'invalid_resume_date');
select public.set_my_invite_pause(public.rome_today() + 14);
select pg_temp.check((select invites_resume_on from public.profiles) = public.rome_today() + 14, 'pausa impostata');
select public.set_my_invite_pause(null);
select pg_temp.check((select invites_resume_on from public.profiles) is null, 'pausa tolta');
commit;

\echo '6. anon non modifica preferenze; un espulso nemmeno'
begin;
set local role anon;
select pg_temp.expect_error($$select public.update_my_preferences('A', 'B', 'both', '{1}', '{1}')$$, 'permission denied');
commit;
update public.profiles set status = 'expelled' where id = '00000000-0000-0000-0000-0000000000b2';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.expect_error($$select public.update_my_preferences('Marco', 'Avvocato', 'both', '{1}', '{1}')$$, 'not_allowed');
commit;

\echo '7. il fondatore vede tutto, compresi genere e anno'
update public.profiles set role = 'founder', status = 'active' where id = '00000000-0000-0000-0000-0000000000b2';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.check(public.is_founder(), 'Marco è fondatore');
select pg_temp.check((select count(*) from public.profiles) = 2, 'il fondatore vede due profili');
select pg_temp.check((select count(*) from public.profile_private) = 2, 'il fondatore vede genere e anno');
-- Anche il fondatore non scrive direttamente: le azioni passano da funzioni dedicate (fase 3).
select pg_temp.expect_error($$update public.profiles set status = 'active'$$, 'permission denied');
commit;

\echo '8. reiscrizione di un email già iscritta non crea nulla'
begin;
set local role anon;
select public.submit_signup('CHIARA@esempio.it', 'Chiara', 'Altro', 'group', '{1}', '{1}', 'female', 1988::smallint);
commit;
select pg_temp.check((select count(*) from public.pending_signups) = 0, 'nessuna nuova iscrizione in attesa');

\echo '9. recupero: utente confermato senza profilo'
insert into public.pending_signups (email, first_name, job, format, zone_ids, slot_ids, gender, birth_year)
values ('luca@esempio.it', 'Luca', 'Ingegnere', 'group', '{1}', '{1}', 'undisclosed', 1990);
-- Utente confermato prima che esistesse l'iscrizione: il trigger non trova nulla.
alter table auth.users disable trigger on_auth_user_confirmed;
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000c3', 'luca@esempio.it', now());
alter table auth.users enable trigger on_auth_user_confirmed;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
select pg_temp.check((select count(*) from public.profiles) = 0, 'Luca non ha ancora un profilo');
select pg_temp.check(public.claim_pending_signup(), 'claim riuscito');
select pg_temp.check((select count(*) from public.profiles) = 1, 'Luca ora ha un profilo');
commit;

\echo 'TUTTI I TEST DELLA FASE 2 SONO PASSATI'
