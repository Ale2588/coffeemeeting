-- Fase 3 — Pannello del fondatore: lista d'attesa, iscritti, locali, disponibilità.
--
-- Stesse regole della fase 2: RLS su ogni tabella, attivata subito dopo la create table;
-- lettura riservata al fondatore; scritture solo da funzioni che verificano is_founder().

-- ---------------------------------------------------------------------------
-- Locali
-- ---------------------------------------------------------------------------

create table public.venues (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address text not null check (char_length(btrim(address)) between 1 and 200),
  zone_id smallint not null references public.zones (id),
  notes text not null default '' check (char_length(notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.venues enable row level security;

-- Slot in cui il locale può ospitare un tavolo.
create table public.venue_slots (
  venue_id bigint not null references public.venues (id) on delete cascade,
  slot_id smallint not null references public.slots (id),
  primary key (venue_id, slot_id)
);
alter table public.venue_slots enable row level security;

-- ---------------------------------------------------------------------------
-- Storico dei cambi di stato degli iscritti (approvazioni, rifiuti, sospensioni…)
-- ---------------------------------------------------------------------------

create table public.member_status_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  from_status public.member_status not null,
  to_status public.member_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
alter table public.member_status_events enable row level security;

create index member_status_events_profile_idx on public.member_status_events (profile_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- Funzioni del fondatore
-- ---------------------------------------------------------------------------

create function public.assert_founder()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_founder() then
    raise exception 'not_allowed';
  end if;
end;
$$;

-- Cambia lo stato di un iscritto e restituisce lo stato precedente (serve per "Annulla").
-- Il ruolo non si tocca mai da qui; il fondatore non può cambiare il proprio stato.
create function public.founder_set_member_status(p_profile_id uuid, p_status public.member_status)
returns public.member_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.member_status;
begin
  perform public.assert_founder();
  if p_status is null then
    raise exception 'invalid_status';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'cannot_change_self';
  end if;

  select status into v_old from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_old = p_status then
    return v_old;
  end if;

  update public.profiles set status = p_status, updated_at = now() where id = p_profile_id;
  insert into public.member_status_events (profile_id, from_status, to_status, changed_by)
  values (p_profile_id, v_old, p_status, auth.uid());
  return v_old;
end;
$$;

-- Crea (p_id null) o modifica un locale, con i suoi slot. Restituisce l'id.
create function public.founder_save_venue(
  p_id bigint,
  p_name text,
  p_address text,
  p_zone_id smallint,
  p_notes text,
  p_slot_ids smallint[],
  p_active boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform public.assert_founder();
  if char_length(coalesce(btrim(p_name), '')) not between 1 and 120 then
    raise exception 'invalid_venue_name';
  end if;
  if char_length(coalesce(btrim(p_address), '')) not between 1 and 200 then
    raise exception 'invalid_venue_address';
  end if;
  if p_zone_id is null or not exists (select 1 from public.zones where id = p_zone_id) then
    raise exception 'invalid_zones';
  end if;
  if char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'invalid_venue_notes';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_slot_ids, '{}')) as s(id)
    where not exists (select 1 from public.slots where slots.id = s.id)
  ) then
    raise exception 'invalid_slots';
  end if;

  if p_id is null then
    insert into public.venues (name, address, zone_id, notes, active)
    values (btrim(p_name), btrim(p_address), p_zone_id, coalesce(btrim(p_notes), ''), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.venues
    set name = btrim(p_name), address = btrim(p_address), zone_id = p_zone_id,
        notes = coalesce(btrim(p_notes), ''), active = coalesce(p_active, true), updated_at = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'not_found';
    end if;
  end if;

  delete from public.venue_slots where venue_id = v_id;
  insert into public.venue_slots (venue_id, slot_id)
  select distinct v_id, unnest(coalesce(p_slot_ids, '{}'));
  return v_id;
end;
$$;

-- Matrice zona × slot: iscritti disponibili, cioè attivi o avvisati e non in pausa.
-- Chi ha scelto più zone è contato in ognuna (feedback, punto 6).
create function public.founder_availability()
returns table (zone_id smallint, slot_id smallint, members integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_founder();
  return query
    select pz.zone_id, ps.slot_id, count(*)::integer
    from public.profiles p
    join public.profile_zones pz on pz.profile_id = p.id
    join public.profile_slots ps on ps.profile_id = p.id
    where p.status in ('active', 'warned')
      and (p.invites_resume_on is null or p.invites_resume_on <= public.rome_today())
    group by pz.zone_id, ps.slot_id;
end;
$$;

-- Iscrizioni inviate ma con email non ancora confermata (non entrano in lista d'attesa).
create function public.founder_pending_signups_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_founder();
  return (select count(*)::integer from public.pending_signups);
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: solo lettura, solo fondatore
-- ---------------------------------------------------------------------------

create policy "venues: solo il fondatore"
  on public.venues for select to authenticated
  using (public.is_founder());

create policy "venue_slots: solo il fondatore"
  on public.venue_slots for select to authenticated
  using (public.is_founder());

create policy "member_status_events: solo il fondatore"
  on public.member_status_events for select to authenticated
  using (public.is_founder());

-- ---------------------------------------------------------------------------
-- Privilegi
-- ---------------------------------------------------------------------------

revoke all on table public.venues, public.venue_slots, public.member_status_events
  from anon, authenticated;
grant select on public.venues, public.venue_slots, public.member_status_events to authenticated;

revoke execute on function
  public.assert_founder(),
  public.founder_set_member_status(uuid, public.member_status),
  public.founder_save_venue(bigint, text, text, smallint, text, smallint[], boolean),
  public.founder_availability(),
  public.founder_pending_signups_count()
from public, anon, authenticated;

grant execute on function
  public.founder_set_member_status(uuid, public.member_status),
  public.founder_save_venue(bigint, text, text, smallint, text, smallint[], boolean),
  public.founder_availability(),
  public.founder_pending_signups_count()
to authenticated;
