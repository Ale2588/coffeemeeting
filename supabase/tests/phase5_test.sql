-- Test della fase 5: prezzi, pagamenti, rimborsi, abbonamento, chiusura dell'account.
-- Indipendente dagli altri file: crea i propri utenti (prefisso 5…).

insert into public.pending_signups (email, first_name, job, format, zone_ids, slot_ids, gender, birth_year)
select e, n, 'Lavoro ' || n, 'both', '{1}', '{1}', 'female', 1985
from (values ('f5@t.it','Fede'), ('a5@t.it','Ada'), ('b5@t.it','Bea'), ('c5@t.it','Ciro'),
             ('d5@t.it','Dino'), ('e5@t.it','Elio')) as t(e, n);
insert into auth.users (id, email, email_confirmed_at) values
  ('50000000-0000-0000-0000-0000000000f0', 'f5@t.it', now()),
  ('50000000-0000-0000-0000-0000000000a0', 'a5@t.it', now()),
  ('50000000-0000-0000-0000-0000000000b0', 'b5@t.it', now()),
  ('50000000-0000-0000-0000-0000000000c0', 'c5@t.it', now()),
  ('50000000-0000-0000-0000-0000000000d0', 'd5@t.it', now()),
  ('50000000-0000-0000-0000-0000000000e0', 'e5@t.it', now());
update public.profiles set status = 'active' where email like '%5@t.it';
update public.profiles set role = 'founder' where email = 'f5@t.it';
insert into public.venues (name, address, zone_id) values ('Bar Cinque', 'Via Cinque 5', 1);

-- Un martedì tra 21 e 27 giorni (lontano dai tavoli degli altri test).
create temp table t5 as
select (d + ((2 - extract(isodow from d)::int + 7) % 7))::date as tue
from (select public.rome_today() + 21 as d) x;
grant select on t5 to authenticated, anon, service_role;

-- Tavolo inviato con Ada, Bea, Ciro, Dino.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000f0';
create temp table m5 as select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t5), 'group',
  (select id from public.venues where name = 'Bar Cinque'),
  '{50000000-0000-0000-0000-0000000000a0,50000000-0000-0000-0000-0000000000b0,50000000-0000-0000-0000-0000000000c0,50000000-0000-0000-0000-0000000000d0}') as id;
select public.founder_send_meetup((select id from m5));
commit;
create temp table inv5 as select profile_id, id from public.invitations where meetup_id = (select id from m5);
grant select on m5, inv5 to authenticated, service_role;

\echo '1. prezzi pubblici solo quando il fondatore lo decide'
begin;
set local role anon;
select pg_temp.check((select breakfast_cents from public.public_prices()) is null, 'prezzi nascosti');
commit;
update public.app_settings set prices_public = true;
begin;
set local role anon;
select pg_temp.check((select breakfast_cents || '/' || monthly_cents || '/' || yearly_cents from public.public_prices()) = '800/1200/9900', 'prezzi di prova');
commit;
update public.app_settings set prices_public = false;

\echo '2. l iscritto non conferma senza pagare e non usa le funzioni di servizio'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000a0';
select pg_temp.expect_error($$select public.confirm_invitation((select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000a0'))$$, 'permission denied');
select pg_temp.expect_error($$select public.cancel_invitation((select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000a0'))$$, 'permission denied');
select pg_temp.expect_error($$select public.svc_payment_succeeded('x', 'y', 'visa', '4242')$$, 'permission denied');
select pg_temp.expect_error($$select public.purge_closed_accounts()$$, 'permission denied');
select pg_temp.check((select count(*) from public.payments) = 0, 'pagamenti invisibili');
select pg_temp.check((select count(*) from public.subscriptions) = 0, 'abbonamenti invisibili');
select pg_temp.check((select price_cents from public.my_invitations()) = 800, 'prezzo nell invito');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000f0';
select pg_temp.expect_error($$select public.founder_cancel_meetup((select id from m5))$$, 'permission denied');
commit;

\echo '3. pagamento fallito, poi riuscito'
begin;
set local role service_role;
select pg_temp.check((select amount_cents from public.svc_prepare_breakfast_checkout((select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000a0'), '50000000-0000-0000-0000-0000000000a0')) = 800, 'importo 8 €');
select pg_temp.expect_error($$select * from public.svc_prepare_breakfast_checkout((select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000a0'), '50000000-0000-0000-0000-0000000000b0')$$, 'not_found');
select public.svc_record_checkout('cs_a1', (select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000a0'), '50000000-0000-0000-0000-0000000000a0', 800);
select public.svc_payment_failed('pi_a1', 'cs_a1', 'visa', '4417', 'Carta rifiutata');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000a0';
select pg_temp.check((select payment_status || ':' || card_last4 from public.my_invitations()) = 'failed:4417', 'Ada vede la carta rifiutata');
select pg_temp.check((select status from public.my_invitations()) = 'pending', 'invito ancora da confermare');
commit;
begin;
set local role service_role;
select pg_temp.check(public.svc_payment_succeeded('cs_a1', 'pi_a1', 'visa', '4242') = 'confirmed', 'pagamento riuscito conferma');
select pg_temp.check(public.svc_payment_succeeded('cs_a1', 'pi_a1', 'visa', '4242') = 'duplicate', 'webhook ripetuto ignorato');
select pg_temp.expect_error($$select * from public.svc_prepare_breakfast_checkout((select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000a0'), '50000000-0000-0000-0000-0000000000a0')$$, 'already_paid');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000a0';
select pg_temp.check((select status || ':' || payment_status || ':' || payment_amount_cents from public.my_invitations()) = 'confirmed:succeeded:800', 'confermato e pagato');
commit;

\echo '4. abbonamento necessario dalla seconda colazione'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000a0';
select pg_temp.check((select needs_subscription and not active and confirmed_breakfasts = 1 from public.my_subscription()), 'Ada ora deve abbonarsi');
select pg_temp.check((select monthly_cents || '/' || yearly_cents from public.my_subscription()) = '1200/9900', 'prezzi dei piani');
select pg_temp.check(public.remind_subscription_later() = public.rome_today() + 7, 'promemoria tra una settimana');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000f0';
select pg_temp.expect_error($$select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t5) + 7, 'one_to_one', null,
  '{50000000-0000-0000-0000-0000000000a0}')$$, 'subscription_required');
-- Bea non ha ancora confermato nulla: la prima colazione non richiede l'abbonamento.
select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t5) + 7, 'one_to_one', null, '{50000000-0000-0000-0000-0000000000b0}');
select pg_temp.check((select needs_subscription from public.founder_subscription_states() where profile_id = '50000000-0000-0000-0000-0000000000a0'), 'il pannello vede chi deve abbonarsi');
commit;
begin;
set local role service_role;
select public.svc_set_stripe_customer('50000000-0000-0000-0000-0000000000a0', 'cus_a');
select pg_temp.check((select stripe_customer_id from public.svc_get_stripe_customer('50000000-0000-0000-0000-0000000000a0')) = 'cus_a', 'cliente Stripe salvato');
select pg_temp.check(public.svc_prepare_subscription_checkout('50000000-0000-0000-0000-0000000000a0', 'monthly') = 1200, 'importo mensile');
-- Il webhook non porta l'id del profilo: si ritrova dal cliente.
select public.svc_upsert_subscription('sub_a', 'cus_a', null, 'monthly', 'active', now() + interval '30 days', false);
select pg_temp.expect_error($$select public.svc_prepare_subscription_checkout('50000000-0000-0000-0000-0000000000a0', 'yearly')$$, 'already_subscribed');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000a0';
select pg_temp.check((select active and not needs_subscription and plan = 'monthly' and reminder_on is null from public.my_subscription()), 'Ada abbonata, promemoria tolto');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000f0';
select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t5) + 14, 'one_to_one', null, '{50000000-0000-0000-0000-0000000000a0}');
commit;
-- Disdetta dell'abbonamento: resta valido fino a fine periodo.
begin;
set local role service_role;
select public.svc_upsert_subscription('sub_a', 'cus_a', null, 'monthly', 'active', now() + interval '30 days', true);
select pg_temp.check(public.has_active_subscription('50000000-0000-0000-0000-0000000000a0'), 'valido fino a fine periodo');
select public.svc_upsert_subscription('sub_a', 'cus_a', null, 'monthly', 'canceled', now() - interval '1 minute', true);
select pg_temp.check(not public.has_active_subscription('50000000-0000-0000-0000-0000000000a0'), 'scaduto dopo');
select public.svc_upsert_subscription('sub_a', 'cus_a', null, 'monthly', 'active', now() + interval '30 days', false);
commit;

\echo '5. scadenza durante il pagamento'
update public.invitations set respond_by = now() - interval '1 minute' where id = (select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000c0');
begin;
set local role service_role;
select pg_temp.expect_error($$select * from public.svc_prepare_breakfast_checkout((select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000c0'), '50000000-0000-0000-0000-0000000000c0')$$, 'invitation_expired');
-- Checkout aperto dopo la scadenza (non dovrebbe succedere): pagamento da rimborsare.
select public.svc_record_checkout('cs_c1', (select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000c0'), '50000000-0000-0000-0000-0000000000c0', 800);
select pg_temp.check(public.svc_payment_succeeded('cs_c1', 'pi_c1', 'visa', '4242') = 'refund', 'pagato dopo la scadenza: rimborso');
-- Checkout aperto prima della scadenza e chiuso dopo: vale.
select public.svc_record_checkout('cs_d1', (select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000d0'), '50000000-0000-0000-0000-0000000000d0', 800);
commit;
update public.invitations set respond_by = now() - interval '1 second' where id = (select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000d0');
update public.payments set created_at = now() - interval '1 minute' where stripe_checkout_session_id = 'cs_d1';
begin;
set local role service_role;
select pg_temp.check(public.svc_payment_succeeded('cs_d1', 'pi_d1', 'visa', '4242') = 'confirmed', 'Checkout iniziato in tempo: confermato');
select public.svc_checkout_expired('cs_zzz');
commit;

\echo '6. disdetta con e senza rimborso'
begin;
set local role service_role;
select pg_temp.check((select free and refund_payment_intent_id = 'pi_a1' and refund_amount_cents = 800
  from public.svc_cancel_invitation((select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000a0'), '50000000-0000-0000-0000-0000000000a0')), 'Ada disdice: rimborso');
select public.svc_mark_refunded('pi_a1', 're_a1');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000a0';
select pg_temp.check((select status || ':' || payment_status from public.my_invitations() where meetup_id = (select id from m5)) = 'cancelled:refunded', 'Ada vede il rimborso');
commit;
update public.meetups set starts_at = now() + interval '6 hours' where id = (select id from m5);
begin;
set local role service_role;
select pg_temp.check((select not free and refund_payment_intent_id is null
  from public.svc_cancel_invitation((select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000d0'), '50000000-0000-0000-0000-0000000000d0')), 'Dino disdice tardi: nessun rimborso');
commit;
update public.meetups set starts_at = ((select tue from t5) + time '07:45') at time zone 'Europe/Rome' where id = (select id from m5);

\echo '7. annullamento del tavolo: rimborso a chi ha pagato'
begin;
set local role service_role;
select public.svc_record_checkout('cs_b1', (select id from inv5 where profile_id = '50000000-0000-0000-0000-0000000000b0'), '50000000-0000-0000-0000-0000000000b0', 800);
select public.svc_payment_succeeded('cs_b1', 'pi_b1', 'visa', '4242');
select pg_temp.expect_error($$select * from public.svc_founder_cancel_meetup((select id from m5), '50000000-0000-0000-0000-0000000000b0')$$, 'not_allowed');
select pg_temp.check((select string_agg(refund_payment_intent_id, ',' order by refund_payment_intent_id) from public.svc_founder_cancel_meetup((select id from m5), '50000000-0000-0000-0000-0000000000f0')) = 'pi_b1', 'rimborso solo a chi era confermato');
commit;

\echo '8. chiusura dell account, riapertura, cancellazione dopo 30 giorni'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000f0';
create temp table m6 as select public.founder_save_meetup(null, 1::smallint, 1::smallint, (select tue from t5) + 21, 'group',
  (select id from public.venues where name = 'Bar Cinque'),
  '{50000000-0000-0000-0000-0000000000e0,50000000-0000-0000-0000-0000000000c0,50000000-0000-0000-0000-0000000000d0,50000000-0000-0000-0000-0000000000b0}') as id;
select public.founder_send_meetup((select id from m6));
commit;
grant select on m6 to service_role;
begin;
set local role service_role;
select public.svc_record_checkout('cs_e1', (select id from public.invitations where meetup_id = (select id from m6) and profile_id = '50000000-0000-0000-0000-0000000000e0'), '50000000-0000-0000-0000-0000000000e0', 800);
select public.svc_payment_succeeded('cs_e1', 'pi_e1', 'visa', '4242');
select public.svc_set_stripe_customer('50000000-0000-0000-0000-0000000000e0', 'cus_e');
select public.svc_upsert_subscription('sub_e', 'cus_e', '50000000-0000-0000-0000-0000000000e0', 'yearly', 'active', now() + interval '300 days', false);
create temp table closed5 as select * from public.svc_close_account('50000000-0000-0000-0000-0000000000e0');
select pg_temp.check((select string_agg(coalesce(refund_payment_intent_id, stripe_subscription_id), ',') from closed5) = 'pi_e1,sub_e', 'rimborso e abbonamento da fermare');
select pg_temp.expect_error($$select * from public.svc_close_account('50000000-0000-0000-0000-0000000000e0')$$, 'not_allowed');
commit;
select pg_temp.check((select status from public.profiles where id = '50000000-0000-0000-0000-0000000000e0') = 'closed', 'account chiuso');
select pg_temp.check((select status from public.invitations where meetup_id = (select id from m6) and profile_id = '50000000-0000-0000-0000-0000000000e0') = 'cancelled', 'inviti futuri disdetti');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000e0';
select public.reopen_my_account();
commit;
select pg_temp.check((select status from public.profiles where id = '50000000-0000-0000-0000-0000000000e0') = 'active', 'riaperto allo stato precedente');
begin;
set local role service_role;
select * from public.svc_close_account('50000000-0000-0000-0000-0000000000e0');
commit;
update public.profiles set closed_at = now() - interval '31 days' where id = '50000000-0000-0000-0000-0000000000e0';
begin;
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-0000-0000-0000000000e0';
select pg_temp.expect_error($$select public.reopen_my_account()$$, 'not_allowed');
commit;
select pg_temp.check(public.purge_closed_accounts() = 1, 'un account cancellato');
select pg_temp.check(not exists (select 1 from auth.users where id = '50000000-0000-0000-0000-0000000000e0'), 'utente cancellato');
select pg_temp.check((select profile_id is null and amount_cents = 800 from public.payments where stripe_checkout_session_id = 'cs_e1'), 'il pagamento resta, senza persona');

\echo '9. eventi Stripe elaborati una volta sola'
begin;
set local role service_role;
select pg_temp.check(public.svc_register_stripe_event('evt_1', 'checkout.session.completed'), 'evento nuovo');
select pg_temp.check(not public.svc_register_stripe_event('evt_1', 'checkout.session.completed'), 'evento ripetuto');
select public.svc_forget_stripe_event('evt_1');
select pg_temp.check(public.svc_register_stripe_event('evt_1', 'checkout.session.completed'), 'evento dimenticato e riprovato');
commit;

\echo 'TUTTI I TEST DELLA FASE 5 SONO PASSATI'
