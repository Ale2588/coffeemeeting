-- Fase 5 — Pagamenti (Stripe Checkout, modalità di prova) e abbonamento.
--
-- * La logica sta qui, in funzioni `svc_*` eseguibili solo dal ruolo service_role, cioè dalle
--   funzioni server su Vercel. Le funzioni server parlano con Stripe; il database decide.
-- * La conferma di un invito ora passa dal pagamento: `confirm_invitation` non è più
--   chiamabile dagli iscritti. La disdetta passa dal server (per il rimborso).
-- * Dalla seconda colazione serve un abbonamento attivo (feedback, punto 1).
-- * "Chiudi il mio account": niente più inviti da subito, dati personali cancellati dopo
--   30 giorni, restano i dati di pagamento (decisione del fondatore, 1 ottobre 2026).

-- ---------------------------------------------------------------------------
-- Prezzi (in centesimi). Valori di prova da PRODUCT.md; `prices_public` decide se la home li mostra.
-- ---------------------------------------------------------------------------

alter table public.app_settings
  add column breakfast_price_cents integer not null default 800 check (breakfast_price_cents > 0),
  add column subscription_monthly_cents integer not null default 1200 check (subscription_monthly_cents > 0),
  add column subscription_yearly_cents integer not null default 9900 check (subscription_yearly_cents > 0),
  add column prices_public boolean not null default false;

-- Prezzi per la home: null finché il fondatore non li rende pubblici.
create function public.public_prices()
returns table (breakfast_cents integer, monthly_cents integer, yearly_cents integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when prices_public then breakfast_price_cents end,
    case when prices_public then subscription_monthly_cents end,
    case when prices_public then subscription_yearly_cents end
  from public.app_settings;
$$;

-- ---------------------------------------------------------------------------
-- Account chiuso
-- ---------------------------------------------------------------------------

alter type public.member_status add value if not exists 'closed';

alter table public.profiles
  add column closed_at timestamptz,
  add column status_before_close public.member_status,
  -- "Non ora, ricordamelo tra una settimana": data del promemoria (l'email arriva con la fase 7).
  add column subscription_reminder_on date;

-- ---------------------------------------------------------------------------
-- Clienti Stripe, pagamenti, abbonamenti, eventi
-- ---------------------------------------------------------------------------

create table public.stripe_customers (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique
);
alter table public.stripe_customers enable row level security;

create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'expired', 'refunded');

-- I pagamenti restano anche se l'account viene cancellato (obblighi fiscali).
create table public.payments (
  id bigint generated always as identity primary key,
  invitation_id bigint references public.invitations (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur',
  status public.payment_status not null default 'pending',
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  card_brand text,
  card_last4 text,
  failure_message text,
  refund_id text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payments enable row level security;

create index payments_invitation_idx on public.payments (invitation_id, created_at desc);

create type public.subscription_plan as enum ('monthly', 'yearly');

create table public.subscriptions (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles (id) on delete set null,
  stripe_subscription_id text not null unique,
  plan public.subscription_plan not null,
  -- Stato di Stripe: active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired, paused.
  stripe_status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;

create index subscriptions_profile_idx on public.subscriptions (profile_id);

-- Eventi Stripe già elaborati: il webhook può arrivare più volte.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- ---------------------------------------------------------------------------
-- Regole di abbonamento
-- ---------------------------------------------------------------------------

-- Abbonamento valido adesso. "past_due" resta valido mentre Stripe riprova l'addebito.
create function public.has_active_subscription(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions
    where profile_id = p_profile_id
      and stripe_status in ('active', 'trialing', 'past_due')
      and (current_period_end is null or current_period_end > now())
  );
$$;

-- Colazioni confermate (anche future): dalla seconda serve l'abbonamento.
create function public.confirmed_breakfasts(p_profile_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.invitations i
  join public.meetups m on m.id = i.meetup_id
  where i.profile_id = p_profile_id and i.status = 'confirmed' and m.status = 'sent';
$$;

create function public.needs_subscription(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.confirmed_breakfasts(p_profile_id) >= 1 and not public.has_active_subscription(p_profile_id);
$$;

-- Estende il controllo dei partecipanti della fase 4 con l'abbonamento.
create or replace function public.assert_valid_participants(
  p_meetup_id bigint,
  p_date date,
  p_slot_id smallint,
  p_profile_ids uuid[]
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(p_profile_ids) as u(id)
    where not exists (
      select 1 from public.profiles p where p.id = u.id and p.status in ('active', 'warned')
    )
  ) then
    raise exception 'invalid_participants';
  end if;

  if exists (
    select 1
    from public.invitations i
    join public.meetups m on m.id = i.meetup_id
    where i.profile_id = any (p_profile_ids)
      and m.id is distinct from p_meetup_id
      and m.meetup_date = p_date
      and m.slot_id = p_slot_id
      and m.status <> 'cancelled'
      and i.status in ('draft', 'pending', 'confirmed')
  ) then
    raise exception 'participant_busy';
  end if;

  -- Chi ha già una colazione confermata in un altro tavolo deve essere abbonato.
  if exists (
    select 1 from unnest(p_profile_ids) as u(id)
    where public.has_active_subscription(u.id) = false
      and exists (
        select 1 from public.invitations i
        join public.meetups m on m.id = i.meetup_id
        where i.profile_id = u.id and i.status = 'confirmed' and m.status = 'sent'
          and m.id is distinct from p_meetup_id
      )
  ) then
    raise exception 'subscription_required';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funzioni di servizio (solo service_role, chiamate dalle funzioni server)
-- ---------------------------------------------------------------------------

-- Prima del Checkout: controlla che l'invito si possa pagare e restituisce importo e descrizione.
create function public.svc_prepare_breakfast_checkout(p_invitation_id bigint, p_profile_id uuid)
returns table (amount_cents integer, starts_at timestamptz, respond_by timestamptz, venue_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invitations;
  m public.meetups;
begin
  select * into i from public.invitations
  where id = p_invitation_id and profile_id = p_profile_id and status <> 'draft';
  if not found then
    raise exception 'not_found';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and status in ('active', 'warned')) then
    raise exception 'not_allowed';
  end if;
  select * into m from public.meetups where id = i.meetup_id;
  if m.status <> 'sent' then
    raise exception 'meetup_cancelled';
  end if;
  if i.status = 'confirmed' then
    raise exception 'already_paid';
  end if;
  if i.status <> 'pending' or now() >= i.respond_by then
    raise exception 'invitation_expired';
  end if;
  if exists (
    select 1 from public.invitations o
    join public.meetups om on om.id = o.meetup_id
    where o.profile_id = p_profile_id and o.status = 'confirmed' and om.status = 'sent'
  ) and not public.has_active_subscription(p_profile_id) then
    raise exception 'subscription_required';
  end if;

  return query
    select s.breakfast_price_cents, m.starts_at, i.respond_by, v.name
    from public.app_settings s
    left join public.venues v on v.id = m.venue_id;
end;
$$;

create function public.svc_record_checkout(
  p_session_id text,
  p_invitation_id bigint,
  p_profile_id uuid,
  p_amount_cents integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.payments (stripe_checkout_session_id, invitation_id, profile_id, amount_cents)
  values (p_session_id, p_invitation_id, p_profile_id, p_amount_cents)
  on conflict (stripe_checkout_session_id) do nothing;
$$;

-- Pagamento riuscito (webhook). Conferma l'invito se è ancora valido; altrimenti chiede il rimborso.
-- Restituisce 'confirmed', 'refund' o 'duplicate'.
create function public.svc_payment_succeeded(
  p_session_id text,
  p_payment_intent_id text,
  p_card_brand text,
  p_card_last4 text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  i public.invitations;
  m public.meetups;
begin
  select * into p from public.payments where stripe_checkout_session_id = p_session_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if p.status in ('succeeded', 'refunded') then
    return 'duplicate';
  end if;

  update public.payments
  set status = 'succeeded', stripe_payment_intent_id = p_payment_intent_id,
      card_brand = p_card_brand, card_last4 = p_card_last4, failure_message = null, updated_at = now()
  where id = p.id;

  select * into i from public.invitations where id = p.invitation_id for update;
  select * into m from public.meetups where id = i.meetup_id;

  -- Il Checkout è iniziato prima della scadenza: vale anche se il pagamento si chiude poco dopo.
  if i.id is not null and m.status = 'sent' and now() < m.starts_at
     and i.status in ('pending', 'expired') and p.created_at < i.respond_by then
    update public.invitations set status = 'confirmed', responded_at = now() where id = i.id;
    return 'confirmed';
  end if;
  return 'refund';
end;
$$;

create function public.svc_payment_failed(
  p_payment_intent_id text,
  p_session_id text,
  p_card_brand text,
  p_card_last4 text,
  p_message text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments
  set status = 'failed', stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
      card_brand = p_card_brand, card_last4 = p_card_last4, failure_message = p_message, updated_at = now()
  where (stripe_checkout_session_id = p_session_id or stripe_payment_intent_id = p_payment_intent_id)
    and status in ('pending', 'failed');
$$;

create function public.svc_checkout_expired(p_session_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments set status = 'expired', updated_at = now()
  where stripe_checkout_session_id = p_session_id and status = 'pending';
$$;

create function public.svc_mark_refunded(p_payment_intent_id text, p_refund_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments set status = 'refunded', refund_id = p_refund_id, refunded_at = now(), updated_at = now()
  where stripe_payment_intent_id = p_payment_intent_id and status = 'succeeded';
$$;

-- Disdetta da parte dell'iscritto. Restituisce se era gratuita e, se va rimborsato,
-- il pagamento da rimborsare.
create function public.svc_cancel_invitation(p_invitation_id bigint, p_profile_id uuid)
returns table (free boolean, refund_payment_intent_id text, refund_amount_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invitations;
  m public.meetups;
  v_free boolean;
  v_pi text;
  v_amount integer;
begin
  select * into i from public.invitations
  where id = p_invitation_id and profile_id = p_profile_id and status <> 'draft'
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into m from public.meetups where id = i.meetup_id;
  if m.status <> 'sent' then
    raise exception 'meetup_cancelled';
  end if;
  if public.effective_invitation_status(i.status, i.respond_by) not in ('pending', 'confirmed') then
    raise exception 'not_cancellable';
  end if;
  if now() >= m.starts_at then
    raise exception 'too_late';
  end if;

  v_free := now() < m.starts_at - make_interval(hours => public.free_cancellation_hours());
  update public.invitations
  set status = 'cancelled', cancelled_by = 'member', responded_at = now()
  where id = i.id;

  if v_free then
    select stripe_payment_intent_id, amount_cents into v_pi, v_amount
    from public.payments where invitation_id = i.id and status = 'succeeded'
    order by created_at desc limit 1;
  end if;
  return query select v_free, v_pi, v_amount;
end;
$$;

-- Il fondatore annulla un tavolo: rimborso a tutti quelli che hanno pagato.
create function public.svc_founder_cancel_meetup(p_meetup_id bigint, p_founder_id uuid)
returns table (refund_payment_intent_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refunds text[];
begin
  if not exists (select 1 from public.profiles where id = p_founder_id and role = 'founder') then
    raise exception 'not_allowed';
  end if;
  update public.meetups set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_meetup_id and status in ('draft', 'sent');
  if not found then
    raise exception 'not_editable';
  end if;

  -- Rimborso solo a chi era confermato: chi aveva già disdetto segue la regola delle 12 ore.
  select coalesce(array_agg(p.stripe_payment_intent_id), '{}') into v_refunds
  from public.invitations i
  join public.payments p on p.invitation_id = i.id and p.status = 'succeeded'
  where i.meetup_id = p_meetup_id and i.status = 'confirmed' and p.stripe_payment_intent_id is not null;

  update public.invitations
  set status = 'cancelled', cancelled_by = 'founder', responded_at = now()
  where meetup_id = p_meetup_id and status in ('pending', 'confirmed');

  return query select unnest(v_refunds);
end;
$$;

-- Cliente Stripe dell'iscritto (per ritrovarlo tra colazioni e abbonamento).
create function public.svc_get_stripe_customer(p_profile_id uuid)
returns table (stripe_customer_id text, email text, first_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.stripe_customer_id, p.email, p.first_name
  from public.profiles p
  left join public.stripe_customers c on c.profile_id = p.id
  where p.id = p_profile_id;
$$;

create function public.svc_set_stripe_customer(p_profile_id uuid, p_customer_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.stripe_customers (profile_id, stripe_customer_id) values (p_profile_id, p_customer_id)
  on conflict (profile_id) do nothing;
$$;

-- Prima del Checkout dell'abbonamento.
create function public.svc_prepare_subscription_checkout(p_profile_id uuid, p_plan public.subscription_plan)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_plan is null then
    raise exception 'invalid_plan';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and status in ('active', 'warned')) then
    raise exception 'not_allowed';
  end if;
  if public.has_active_subscription(p_profile_id) then
    raise exception 'already_subscribed';
  end if;
  return (
    select case when p_plan = 'monthly' then subscription_monthly_cents else subscription_yearly_cents end
    from public.app_settings
  );
end;
$$;

-- Abbonamento creato o aggiornato su Stripe (webhook).
create function public.svc_upsert_subscription(
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_profile_id uuid,
  p_plan public.subscription_plan,
  p_stripe_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := coalesce(
    p_profile_id,
    (select profile_id from public.stripe_customers where stripe_customer_id = p_stripe_customer_id)
  );
begin
  insert into public.subscriptions
    (stripe_subscription_id, profile_id, plan, stripe_status, current_period_end, cancel_at_period_end)
  values
    (p_stripe_subscription_id, v_profile, p_plan, p_stripe_status, p_current_period_end, coalesce(p_cancel_at_period_end, false))
  on conflict (stripe_subscription_id) do update set
    plan = excluded.plan,
    stripe_status = excluded.stripe_status,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    profile_id = coalesce(public.subscriptions.profile_id, excluded.profile_id),
    updated_at = now();
  if v_profile is not null then
    update public.profiles set subscription_reminder_on = null where id = v_profile;
  end if;
end;
$$;

-- Evento Stripe: true se è nuovo (da elaborare), false se già visto.
create function public.svc_register_stripe_event(p_event_id text, p_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stripe_events (id, type) values (p_event_id, p_type);
  return true;
exception when unique_violation then
  return false;
end;
$$;

-- Se l'elaborazione fallisce, l'evento si toglie: Stripe lo rimanderà.
create function public.svc_forget_stripe_event(p_event_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.stripe_events where id = p_event_id;
$$;

-- "Chiudi il mio account": disdice gli inviti futuri (con rimborso se entro la disdetta
-- gratuita) e chiude l'account. Restituisce i pagamenti da rimborsare e l'abbonamento
-- Stripe da non rinnovare.
create function public.svc_close_account(p_profile_id uuid)
returns table (refund_payment_intent_id text, stripe_subscription_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.member_status;
  v_refunds text[];
begin
  select status into v_status from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_status in ('closed', 'expelled') then
    raise exception 'not_allowed';
  end if;

  select coalesce(array_agg(p.stripe_payment_intent_id), '{}') into v_refunds
  from public.invitations i
  join public.meetups m on m.id = i.meetup_id
  join public.payments p on p.invitation_id = i.id and p.status = 'succeeded'
  where i.profile_id = p_profile_id and i.status = 'confirmed' and m.status = 'sent'
    and now() < m.starts_at - make_interval(hours => public.free_cancellation_hours())
    and p.stripe_payment_intent_id is not null;

  update public.invitations i
  set status = 'cancelled', cancelled_by = 'member', responded_at = now()
  from public.meetups m
  where m.id = i.meetup_id and i.profile_id = p_profile_id
    and i.status in ('draft', 'pending', 'confirmed') and now() < m.starts_at;

  update public.profiles
  set status_before_close = status, status = 'closed', closed_at = now(), updated_at = now()
  where id = p_profile_id;

  return query
    select r, null::text from unnest(v_refunds) as r
    union all
    select null::text, s.stripe_subscription_id from public.subscriptions s
    where s.profile_id = p_profile_id and s.stripe_status in ('active', 'trialing', 'past_due')
      and s.cancel_at_period_end = false;
end;
$$;

-- Cancella i dati personali degli account chiusi da più di 30 giorni (per pg_cron).
-- I pagamenti restano, senza collegamento alla persona.
create function public.purge_closed_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  with gone as (
    delete from auth.users u
    using public.profiles p
    where p.id = u.id and p.status = 'closed' and p.closed_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer into v_n from gone;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funzioni dell'iscritto
-- ---------------------------------------------------------------------------

-- I miei inviti, ora con prezzo e stato dell'ultimo pagamento.
drop function public.my_invitations();

create function public.my_invitations()
returns table (
  invitation_id bigint,
  status public.invitation_status,
  respond_by timestamptz,
  responded_at timestamptz,
  cancelled_by public.cancelled_by,
  meetup_id bigint,
  meetup_status public.meetup_status,
  starts_at timestamptz,
  duration_minutes smallint,
  free_cancellation_until timestamptz,
  format public.meeting_format,
  zone_name text,
  venue_name text,
  venue_address text,
  participants integer,
  price_cents integer,
  payment_status public.payment_status,
  payment_amount_cents integer,
  card_last4 text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    public.effective_invitation_status(i.status, i.respond_by),
    i.respond_by,
    i.responded_at,
    i.cancelled_by,
    m.id,
    m.status,
    m.starts_at,
    m.duration_minutes,
    m.starts_at - make_interval(hours => public.free_cancellation_hours()),
    m.format,
    z.name,
    v.name,
    v.address,
    (select count(*)::integer from public.invitations o
     where o.meetup_id = m.id
       and public.effective_invitation_status(o.status, o.respond_by) in ('pending', 'confirmed')),
    (select breakfast_price_cents from public.app_settings),
    pay.status,
    pay.amount_cents,
    pay.card_last4
  from public.invitations i
  join public.meetups m on m.id = i.meetup_id
  join public.zones z on z.id = m.zone_id
  left join public.venues v on v.id = m.venue_id
  left join lateral (
    select p.status, p.amount_cents, p.card_last4 from public.payments p
    where p.invitation_id = i.id
    order by p.created_at desc limit 1
  ) pay on true
  where i.profile_id = auth.uid()
    and i.status <> 'draft'
    and m.status <> 'draft'
  order by m.starts_at desc;
$$;

-- Stato del mio abbonamento e prezzi dei piani.
create function public.my_subscription()
returns table (
  plan public.subscription_plan,
  stripe_status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  active boolean,
  needs_subscription boolean,
  confirmed_breakfasts integer,
  reminder_on date,
  monthly_cents integer,
  yearly_cents integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.plan,
    s.stripe_status,
    s.current_period_end,
    coalesce(s.cancel_at_period_end, false),
    public.has_active_subscription(auth.uid()),
    public.needs_subscription(auth.uid()),
    public.confirmed_breakfasts(auth.uid()),
    p.subscription_reminder_on,
    st.subscription_monthly_cents,
    st.subscription_yearly_cents
  from public.profiles p
  cross join public.app_settings st
  left join lateral (
    select * from public.subscriptions x where x.profile_id = p.id order by x.created_at desc limit 1
  ) s on true
  where p.id = auth.uid();
$$;

-- "Non ora, ricordamelo tra una settimana".
create function public.remind_subscription_later()
returns date
language sql
security definer
set search_path = ''
as $$
  update public.profiles set subscription_reminder_on = public.rome_today() + 7
  where id = auth.uid()
  returning subscription_reminder_on;
$$;

-- Riapre un account chiuso entro i 30 giorni, tornando allo stato precedente.
create function public.reopen_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set status = coalesce(status_before_close, 'waitlisted'), status_before_close = null,
      closed_at = null, updated_at = now()
  where id = auth.uid() and status = 'closed' and closed_at > now() - interval '30 days';
  if not found then
    raise exception 'not_allowed';
  end if;
end;
$$;

-- Per il pannello: stato dell'abbonamento di ciascun iscritto.
create function public.founder_subscription_states()
returns table (profile_id uuid, active boolean, needs_subscription boolean, plan public.subscription_plan)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_founder();
  return query
    select p.id, public.has_active_subscription(p.id), public.needs_subscription(p.id),
           (select x.plan from public.subscriptions x where x.profile_id = p.id order by x.created_at desc limit 1)
    from public.profiles p;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: solo il fondatore legge; scritture solo dal server
-- ---------------------------------------------------------------------------

create policy "payments: solo il fondatore"
  on public.payments for select to authenticated
  using (public.is_founder());

create policy "subscriptions: solo il fondatore"
  on public.subscriptions for select to authenticated
  using (public.is_founder());

-- stripe_customers e stripe_events: nessuna policy, nessun accesso dai client.

-- ---------------------------------------------------------------------------
-- Privilegi
-- ---------------------------------------------------------------------------

revoke all on table public.stripe_customers, public.payments, public.subscriptions, public.stripe_events
  from anon, authenticated;
grant select on public.payments, public.subscriptions to authenticated;

-- La conferma passa dal pagamento, la disdetta e l'annullamento dal server (rimborsi).
revoke execute on function
  public.confirm_invitation(bigint),
  public.cancel_invitation(bigint),
  public.founder_cancel_meetup(bigint)
from authenticated;

revoke execute on function
  public.public_prices(),
  public.has_active_subscription(uuid),
  public.confirmed_breakfasts(uuid),
  public.needs_subscription(uuid),
  public.svc_prepare_breakfast_checkout(bigint, uuid),
  public.svc_record_checkout(text, bigint, uuid, integer),
  public.svc_payment_succeeded(text, text, text, text),
  public.svc_payment_failed(text, text, text, text, text),
  public.svc_checkout_expired(text),
  public.svc_mark_refunded(text, text),
  public.svc_cancel_invitation(bigint, uuid),
  public.svc_founder_cancel_meetup(bigint, uuid),
  public.svc_get_stripe_customer(uuid),
  public.svc_set_stripe_customer(uuid, text),
  public.svc_prepare_subscription_checkout(uuid, public.subscription_plan),
  public.svc_upsert_subscription(text, text, uuid, public.subscription_plan, text, timestamptz, boolean),
  public.svc_register_stripe_event(text, text),
  public.svc_forget_stripe_event(text),
  public.svc_close_account(uuid),
  public.purge_closed_accounts(),
  public.my_invitations(),
  public.my_subscription(),
  public.remind_subscription_later(),
  public.reopen_my_account(),
  public.founder_subscription_states()
from public, anon, authenticated;

grant execute on function public.public_prices() to anon, authenticated;
grant execute on function
  public.my_invitations(),
  public.my_subscription(),
  public.remind_subscription_later(),
  public.reopen_my_account(),
  public.founder_subscription_states()
to authenticated;

grant execute on function
  public.svc_prepare_breakfast_checkout(bigint, uuid),
  public.svc_record_checkout(text, bigint, uuid, integer),
  public.svc_payment_succeeded(text, text, text, text),
  public.svc_payment_failed(text, text, text, text, text),
  public.svc_checkout_expired(text),
  public.svc_mark_refunded(text, text),
  public.svc_cancel_invitation(bigint, uuid),
  public.svc_founder_cancel_meetup(bigint, uuid),
  public.svc_get_stripe_customer(uuid),
  public.svc_set_stripe_customer(uuid, text),
  public.svc_prepare_subscription_checkout(uuid, public.subscription_plan),
  public.svc_upsert_subscription(text, text, uuid, public.subscription_plan, text, timestamptz, boolean),
  public.svc_register_stripe_event(text, text),
  public.svc_forget_stripe_event(text),
  public.svc_close_account(uuid)
to service_role;
