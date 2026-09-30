-- Fase 4 — Tavoli e inviti.
--
-- * Il fondatore compone i tavoli (bozza), poi "Invia inviti".
-- * L'iscritto non legge direttamente tavoli, inviti o locali: passa da funzioni che
--   restituiscono solo ciò che deve vedere. Degli altri partecipanti vede solo nome e
--   lavoro, e solo dopo aver confermato, e solo di chi ha confermato (decisione del
--   fondatore, 30 settembre 2026).
-- * La conferma per ora non comporta pagamento: Stripe arriva con la fase 5.

-- ---------------------------------------------------------------------------
-- Parametri configurabili (una sola riga)
-- ---------------------------------------------------------------------------

create table public.app_settings (
  id boolean primary key default true check (id),
  -- Scadenza di risposta: alle `response_time` di `response_days_before` giorni prima.
  response_days_before smallint not null default 2 check (response_days_before between 0 and 14),
  response_time time not null default '20:00',
  -- Disdetta gratuita fino a N ore prima dell'inizio.
  free_cancellation_hours smallint not null default 12 check (free_cancellation_hours between 0 and 72)
);
alter table public.app_settings enable row level security;

insert into public.app_settings default values;

-- ---------------------------------------------------------------------------
-- Tavoli e inviti
-- ---------------------------------------------------------------------------

create type public.meetup_status as enum ('draft', 'sent', 'cancelled');

-- 'draft': partecipante di una bozza, invisibile all'iscritto.
create type public.invitation_status as enum ('draft', 'pending', 'confirmed', 'expired', 'cancelled');

create type public.cancelled_by as enum ('member', 'founder');

create table public.meetups (
  id bigint generated always as identity primary key,
  zone_id smallint not null references public.zones (id),
  slot_id smallint not null references public.slots (id),
  meetup_date date not null,
  -- Un tavolo è di gruppo o uno a uno; "entrambi" vale solo come preferenza.
  format public.meeting_format not null check (format <> 'both'),
  venue_id bigint references public.venues (id),
  status public.meetup_status not null default 'draft',
  -- Calcolati alla creazione dal giorno e dallo slot, fuso Europe/Rome.
  starts_at timestamptz not null,
  duration_minutes smallint not null,
  response_deadline timestamptz not null,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.meetups enable row level security;

create index meetups_date_idx on public.meetups (meetup_date);

create table public.invitations (
  id bigint generated always as identity primary key,
  meetup_id bigint not null references public.meetups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.invitation_status not null default 'draft',
  respond_by timestamptz not null,
  responded_at timestamptz,
  cancelled_by public.cancelled_by,
  created_at timestamptz not null default now(),
  unique (meetup_id, profile_id)
);
alter table public.invitations enable row level security;

create index invitations_profile_idx on public.invitations (profile_id);

-- ---------------------------------------------------------------------------
-- Funzioni di supporto
-- ---------------------------------------------------------------------------

-- Stato effettivo: un invito "pending" oltre la scadenza è scaduto, anche prima
-- che il job periodico lo aggiorni.
create function public.effective_invitation_status(p_status public.invitation_status, p_respond_by timestamptz)
returns public.invitation_status
language sql
stable
set search_path = ''
as $$
  select case when p_status = 'pending' and now() >= p_respond_by then 'expired'::public.invitation_status
              else p_status end;
$$;

create function public.free_cancellation_hours()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select free_cancellation_hours from public.app_settings;
$$;

-- Da chiamare periodicamente (pg_cron): rende persistenti gli inviti scaduti.
create function public.expire_overdue_invitations()
returns integer
language sql
security definer
set search_path = ''
as $$
  with expired as (
    update public.invitations set status = 'expired'
    where status = 'pending' and now() >= respond_by
    returning 1
  )
  select count(*)::integer from expired;
$$;

-- Controlla che i partecipanti siano attivi e liberi in quel giorno e slot.
create function public.assert_valid_participants(
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
end;
$$;

-- ---------------------------------------------------------------------------
-- Funzioni del fondatore
-- ---------------------------------------------------------------------------

-- Crea (p_id null) o modifica una bozza di tavolo con i suoi partecipanti.
create function public.founder_save_meetup(
  p_id bigint,
  p_zone_id smallint,
  p_slot_id smallint,
  p_date date,
  p_format public.meeting_format,
  p_venue_id bigint,
  p_profile_ids uuid[]
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot public.slots;
  v_settings public.app_settings;
  v_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(p_profile_ids) as x), '{}');
  v_max int;
  v_starts timestamptz;
  v_deadline timestamptz;
  v_id bigint;
begin
  perform public.assert_founder();

  if p_format is null or p_format = 'both' then
    raise exception 'invalid_format';
  end if;
  if not exists (select 1 from public.zones where id = p_zone_id and active) then
    raise exception 'invalid_zones';
  end if;
  select * into v_slot from public.slots where id = p_slot_id and active;
  if not found then
    raise exception 'invalid_slots';
  end if;
  if p_date is null or p_date < public.rome_today() or extract(isodow from p_date) <> v_slot.weekday then
    raise exception 'invalid_date';
  end if;
  if p_venue_id is not null and not exists (select 1 from public.venues where id = p_venue_id and active) then
    raise exception 'invalid_venue';
  end if;

  v_max := case when p_format = 'one_to_one' then 2 else 6 end;
  if cardinality(v_ids) > v_max then
    raise exception 'too_many_participants';
  end if;
  perform public.assert_valid_participants(p_id, p_date, p_slot_id, v_ids);

  select * into v_settings from public.app_settings;
  v_starts := (p_date + v_slot.start_time) at time zone 'Europe/Rome';
  v_deadline := ((p_date - v_settings.response_days_before) + v_settings.response_time) at time zone 'Europe/Rome';

  if p_id is null then
    insert into public.meetups
      (zone_id, slot_id, meetup_date, format, venue_id, starts_at, duration_minutes, response_deadline)
    values
      (p_zone_id, p_slot_id, p_date, p_format, p_venue_id, v_starts, v_slot.duration_minutes, v_deadline)
    returning id into v_id;
  else
    update public.meetups
    set zone_id = p_zone_id, slot_id = p_slot_id, meetup_date = p_date, format = p_format,
        venue_id = p_venue_id, starts_at = v_starts, duration_minutes = v_slot.duration_minutes,
        response_deadline = v_deadline, updated_at = now()
    where id = p_id and status = 'draft'
    returning id into v_id;
    if v_id is null then
      raise exception 'not_editable';
    end if;
  end if;

  delete from public.invitations where meetup_id = v_id and status = 'draft';
  insert into public.invitations (meetup_id, profile_id, status, respond_by)
  select v_id, x, 'draft', v_deadline from unnest(v_ids) as x;
  return v_id;
end;
$$;

-- "Invia inviti": la bozza diventa visibile ai partecipanti.
create function public.founder_send_meetup(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.meetups;
  v_n int;
begin
  perform public.assert_founder();
  select * into v from public.meetups where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v.status <> 'draft' then
    raise exception 'not_editable';
  end if;
  if v.venue_id is null then
    raise exception 'missing_venue';
  end if;
  if not exists (select 1 from public.venues where id = v.venue_id and active) then
    raise exception 'invalid_venue';
  end if;
  if now() >= v.response_deadline then
    raise exception 'deadline_passed';
  end if;

  select count(*) into v_n from public.invitations where meetup_id = p_id and status = 'draft';
  if (v.format = 'group' and v_n not between 4 and 6) or (v.format = 'one_to_one' and v_n <> 2) then
    raise exception 'invalid_group_size';
  end if;

  update public.meetups set status = 'sent', sent_at = now(), updated_at = now() where id = p_id;
  update public.invitations set status = 'pending' where meetup_id = p_id and status = 'draft';
end;
$$;

-- Aggiunge una persona a un tavolo già inviato (es. al posto di chi ha disdetto).
create function public.founder_add_participant(p_meetup_id bigint, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.meetups;
  v_hours smallint := public.free_cancellation_hours();
  v_n int;
begin
  perform public.assert_founder();
  select * into v from public.meetups where id = p_meetup_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v.status <> 'sent' then
    raise exception 'not_editable';
  end if;
  if now() >= v.starts_at - make_interval(hours => v_hours) then
    raise exception 'too_late';
  end if;
  if exists (select 1 from public.invitations where meetup_id = p_meetup_id and profile_id = p_profile_id) then
    raise exception 'already_invited';
  end if;
  perform public.assert_valid_participants(p_meetup_id, v.meetup_date, v.slot_id, array[p_profile_id]);

  select count(*) into v_n from public.invitations
  where meetup_id = p_meetup_id
    and public.effective_invitation_status(status, respond_by) in ('pending', 'confirmed');
  if v_n >= (case when v.format = 'one_to_one' then 2 else 6 end) then
    raise exception 'too_many_participants';
  end if;

  -- Chi entra tardi ha almeno 24 ore per rispondere, ma non oltre la soglia della disdetta.
  insert into public.invitations (meetup_id, profile_id, status, respond_by)
  values (
    p_meetup_id, p_profile_id, 'pending',
    greatest(v.response_deadline, least(now() + interval '24 hours', v.starts_at - make_interval(hours => v_hours)))
  );
end;
$$;

-- Annulla un tavolo (bozza o inviato). Gli inviti aperti risultano annullati dal fondatore.
create function public.founder_cancel_meetup(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_founder();
  update public.meetups set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_id and status in ('draft', 'sent');
  if not found then
    raise exception 'not_editable';
  end if;
  update public.invitations
  set status = 'cancelled', cancelled_by = 'founder', responded_at = now()
  where meetup_id = p_id and status in ('pending', 'confirmed');
end;
$$;

-- Colazioni fatte: inviti confermati a tavoli già iniziati.
create function public.founder_breakfast_counts()
returns table (profile_id uuid, breakfasts integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_founder();
  return query
    select i.profile_id, count(*)::integer
    from public.invitations i
    join public.meetups m on m.id = i.meetup_id
    where i.status = 'confirmed' and m.status = 'sent' and m.starts_at <= now()
    group by i.profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funzioni dell'iscritto
-- ---------------------------------------------------------------------------

-- I miei inviti (mai le bozze), con locale, orari e scadenze. Niente note del locale.
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
  participants integer
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
       and public.effective_invitation_status(o.status, o.respond_by) in ('pending', 'confirmed'))
  from public.invitations i
  join public.meetups m on m.id = i.meetup_id
  join public.zones z on z.id = m.zone_id
  left join public.venues v on v.id = m.venue_id
  where i.profile_id = auth.uid()
    and i.status <> 'draft'
    and m.status <> 'draft'
  order by m.starts_at desc;
$$;

-- Nome e lavoro degli altri che hanno confermato, solo se ho confermato anch'io.
create function public.my_meetup_companions(p_invitation_id bigint)
returns table (first_name text, job text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.first_name, p.job
  from public.invitations mine
  join public.invitations other on other.meetup_id = mine.meetup_id and other.id <> mine.id
  join public.profiles p on p.id = other.profile_id
  where mine.id = p_invitation_id
    and mine.profile_id = auth.uid()
    and mine.status = 'confirmed'
    and other.status = 'confirmed'
  order by p.first_name;
$$;

-- Conferma. Restituisce il nuovo stato: 'confirmed', oppure 'expired' se la scadenza è passata.
-- Fase 4: nessun pagamento. Dalla fase 5 la conferma passa da Stripe.
create function public.confirm_invitation(p_invitation_id bigint)
returns public.invitation_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invitations;
  m public.meetups;
begin
  select * into i from public.invitations
  where id = p_invitation_id and profile_id = auth.uid() and status <> 'draft'
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and status in ('active', 'warned')) then
    raise exception 'not_allowed';
  end if;
  select * into m from public.meetups where id = i.meetup_id;
  if m.status <> 'sent' then
    raise exception 'meetup_cancelled';
  end if;
  if i.status = 'confirmed' then
    return i.status;
  end if;
  if i.status <> 'pending' then
    raise exception 'not_pending';
  end if;
  if now() >= i.respond_by then
    update public.invitations set status = 'expired' where id = i.id;
    return 'expired';
  end if;

  update public.invitations set status = 'confirmed', responded_at = now() where id = i.id;
  return 'confirmed';
end;
$$;

-- Disdetta (o rifiuto di un invito non ancora confermato). Restituisce true se è entro
-- la disdetta gratuita. Dopo l'inizio del tavolo non si può più disdire.
create function public.cancel_invitation(p_invitation_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.invitations;
  m public.meetups;
begin
  select * into i from public.invitations
  where id = p_invitation_id and profile_id = auth.uid() and status <> 'draft'
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

  update public.invitations
  set status = 'cancelled', cancelled_by = 'member', responded_at = now()
  where id = i.id;
  return now() < m.starts_at - make_interval(hours => public.free_cancellation_hours());
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: lettura diretta solo per il fondatore
-- ---------------------------------------------------------------------------

create policy "app_settings: solo il fondatore"
  on public.app_settings for select to authenticated
  using (public.is_founder());

create policy "meetups: solo il fondatore"
  on public.meetups for select to authenticated
  using (public.is_founder());

create policy "invitations: solo il fondatore"
  on public.invitations for select to authenticated
  using (public.is_founder());

-- ---------------------------------------------------------------------------
-- Privilegi
-- ---------------------------------------------------------------------------

revoke all on table public.app_settings, public.meetups, public.invitations from anon, authenticated;
grant select on public.app_settings, public.meetups, public.invitations to authenticated;

revoke execute on function
  public.effective_invitation_status(public.invitation_status, timestamptz),
  public.free_cancellation_hours(),
  public.expire_overdue_invitations(),
  public.assert_valid_participants(bigint, date, smallint, uuid[]),
  public.founder_save_meetup(bigint, smallint, smallint, date, public.meeting_format, bigint, uuid[]),
  public.founder_send_meetup(bigint),
  public.founder_add_participant(bigint, uuid),
  public.founder_cancel_meetup(bigint),
  public.founder_breakfast_counts(),
  public.my_invitations(),
  public.my_meetup_companions(bigint),
  public.confirm_invitation(bigint),
  public.cancel_invitation(bigint)
from public, anon, authenticated;

grant execute on function
  public.founder_save_meetup(bigint, smallint, smallint, date, public.meeting_format, bigint, uuid[]),
  public.founder_send_meetup(bigint),
  public.founder_add_participant(bigint, uuid),
  public.founder_cancel_meetup(bigint),
  public.founder_breakfast_counts(),
  public.my_invitations(),
  public.my_meetup_companions(bigint),
  public.confirm_invitation(bigint),
  public.cancel_invitation(bigint)
to authenticated;
