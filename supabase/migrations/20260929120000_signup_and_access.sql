-- Fase 2 — Iscrizione, lista d'attesa, accesso.
--
-- Regole di sicurezza (CLAUDE.md, "Ruoli e sicurezza dei dati"):
-- * RLS attiva su tutte le tabelle.
-- * Gli iscritti hanno solo SELECT sulle proprie righe; ogni scrittura passa da funzioni
--   SECURITY DEFINER che validano i dati. Così un iscritto non può cambiarsi ruolo o stato.
-- * Genere e anno di nascita stanno in `profile_private`, leggibile solo dal fondatore.
-- * Il ruolo `founder` si assegna a mano in SQL, mai dall'interfaccia.
--
-- Supabase concede per default tutti i privilegi sulle nuove tabelle ad anon e authenticated:
-- ogni migrazione che crea tabelle deve revocarli e concedere solo ciò che serve.

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('member', 'founder');

-- waitlisted = in lista d'attesa; rejected = iscrizione rifiutata dal fondatore.
create type public.member_status as enum (
  'waitlisted', 'active', 'warned', 'suspended', 'expelled', 'rejected'
);

create type public.meeting_format as enum ('group', 'one_to_one', 'both');

-- 'other' e 'undisclosed' non pesano nell'equilibrio dei tavoli: servono solo alle statistiche.
create type public.gender as enum ('female', 'male', 'other', 'undisclosed');

-- ---------------------------------------------------------------------------
-- Catalogo: zone e slot
-- ---------------------------------------------------------------------------

create table public.zones (
  id smallint generated always as identity primary key,
  name text not null unique,
  active boolean not null default true,
  sort_order smallint not null default 0
);

create table public.slots (
  id smallint generated always as identity primary key,
  -- ISO 8601: 1 = lunedì … 7 = domenica.
  weekday smallint not null check (weekday between 1 and 7),
  -- Ora locale Europe/Rome.
  start_time time not null,
  duration_minutes smallint not null default 45 check (duration_minutes > 0),
  active boolean not null default true,
  unique (weekday, start_time)
);

-- Valori provvisori dalla specifica, sezione 3 ("da confermare").
insert into public.zones (name, sort_order) values
  ('Porta Venezia', 1), ('Isola', 2), ('Navigli', 3), ('Città Studi', 4),
  ('Porta Romana', 5), ('CityLife', 6), ('Centrale', 7), ('Lambrate', 8);

insert into public.slots (weekday, start_time) values
  (2, '07:45'), (2, '08:30'), (4, '07:45'), (4, '08:30');

-- ---------------------------------------------------------------------------
-- Iscritti
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text not null check (char_length(first_name) between 1 and 60),
  job text not null check (char_length(job) between 1 and 80),
  format public.meeting_format not null,
  role public.member_role not null default 'member',
  status public.member_status not null default 'waitlisted',
  -- Inviti in pausa fino a questa data esclusa (data locale Europe/Rome). Null = nessuna pausa.
  invites_resume_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_status_idx on public.profiles (status);

create table public.profile_zones (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  zone_id smallint not null references public.zones (id),
  primary key (profile_id, zone_id)
);

create table public.profile_slots (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  slot_id smallint not null references public.slots (id),
  primary key (profile_id, slot_id)
);

-- Dati usati solo dal fondatore per bilanciare i tavoli e per le statistiche.
create table public.profile_private (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  gender public.gender not null,
  birth_year smallint not null check (birth_year between 1900 and 2100)
);

-- Iscrizioni inviate dal modulo ma con email non ancora confermata dal link.
-- Diventano un profilo quando l'email viene confermata. Nessun accesso dai client.
create table public.pending_signups (
  email text primary key check (email = lower(email)),
  first_name text not null,
  job text not null,
  format public.meeting_format not null,
  zone_ids smallint[] not null,
  slot_ids smallint[] not null,
  gender public.gender not null,
  birth_year smallint not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Funzioni di supporto
-- ---------------------------------------------------------------------------

create function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'founder'
  );
$$;

create function public.rome_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

-- Valida le preferenze comuni a iscrizione e modifica. Solleva un'eccezione con un codice
-- leggibile dal client (campo MESSAGE) se qualcosa non va.
create function public.assert_valid_preferences(
  p_first_name text,
  p_job text,
  p_zone_ids smallint[],
  p_slot_ids smallint[]
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if char_length(coalesce(btrim(p_first_name), '')) not between 1 and 60 then
    raise exception 'invalid_first_name';
  end if;
  if char_length(coalesce(btrim(p_job), '')) not between 1 and 80 then
    raise exception 'invalid_job';
  end if;
  if coalesce(cardinality(p_zone_ids), 0) = 0
     or exists (
       select 1 from unnest(p_zone_ids) as z(id)
       where not exists (select 1 from public.zones where zones.id = z.id and zones.active)
     ) then
    raise exception 'invalid_zones';
  end if;
  if coalesce(cardinality(p_slot_ids), 0) = 0
     or exists (
       select 1 from unnest(p_slot_ids) as s(id)
       where not exists (select 1 from public.slots where slots.id = s.id and slots.active)
     ) then
    raise exception 'invalid_slots';
  end if;
end;
$$;

-- Crea il profilo a partire da un'iscrizione in attesa di conferma. Idempotente.
create function public.create_profile_from_signup(p_user_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.pending_signups;
begin
  if exists (select 1 from public.profiles where id = p_user_id) then
    delete from public.pending_signups where email = lower(p_email);
    return true;
  end if;

  select * into s from public.pending_signups where email = lower(p_email);
  if not found then
    return false;
  end if;

  insert into public.profiles (id, email, first_name, job, format)
  values (p_user_id, s.email, s.first_name, s.job, s.format);

  -- Una zona o uno slot disattivati nel frattempo vengono ignorati.
  insert into public.profile_zones (profile_id, zone_id)
  select distinct p_user_id, z.id
  from unnest(s.zone_ids) as u(id)
  join public.zones z on z.id = u.id and z.active;

  insert into public.profile_slots (profile_id, slot_id)
  select distinct p_user_id, sl.id
  from unnest(s.slot_ids) as u(id)
  join public.slots sl on sl.id = u.id and sl.active;

  insert into public.profile_private (profile_id, gender, birth_year)
  values (p_user_id, s.gender, s.birth_year);

  delete from public.pending_signups where email = s.email;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger su auth.users: il profilo nasce quando l'email è confermata dal link.
-- ---------------------------------------------------------------------------

create function public.handle_auth_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    perform public.create_profile_from_signup(new.id, new.email);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.handle_auth_user_confirmed();

-- ---------------------------------------------------------------------------
-- Funzioni chiamabili dai client
-- ---------------------------------------------------------------------------

-- Modulo di iscrizione (A2). Chiamabile senza accesso. Non rivela se l'email è già iscritta.
create function public.submit_signup(
  p_email text,
  p_first_name text,
  p_job text,
  p_format public.meeting_format,
  p_zone_ids smallint[],
  p_slot_ids smallint[],
  p_gender public.gender,
  p_birth_year smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_year int := extract(year from public.rome_today());
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;
  perform public.assert_valid_preferences(p_first_name, p_job, p_zone_ids, p_slot_ids);
  if p_format is null then
    raise exception 'invalid_format';
  end if;
  if p_gender is null then
    raise exception 'invalid_gender';
  end if;
  -- Maggiorenni, e non oltre i 100 anni.
  if p_birth_year is null or p_birth_year > v_year - 18 or p_birth_year < v_year - 100 then
    raise exception 'invalid_birth_year';
  end if;

  -- Già iscritto: niente da fare, l'app manda comunque il link di accesso.
  if exists (select 1 from public.profiles where lower(email) = v_email) then
    return;
  end if;

  insert into public.pending_signups
    (email, first_name, job, format, zone_ids, slot_ids, gender, birth_year)
  values
    (v_email, btrim(p_first_name), btrim(p_job), p_format, p_zone_ids, p_slot_ids, p_gender, p_birth_year)
  on conflict (email) do update set
    first_name = excluded.first_name,
    job = excluded.job,
    format = excluded.format,
    zone_ids = excluded.zone_ids,
    slot_ids = excluded.slot_ids,
    gender = excluded.gender,
    birth_year = excluded.birth_year,
    created_at = now();
end;
$$;

-- Recupero: utente confermato ma senza profilo (es. si è iscritto dopo aver già un account).
create function public.claim_pending_signup()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users
  where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then
    return false;
  end if;
  return public.create_profile_from_signup(auth.uid(), v_email);
end;
$$;

-- "Modifica preferenze". Genere e anno di nascita non si modificano da qui.
create function public.update_my_preferences(
  p_first_name text,
  p_job text,
  p_format public.meeting_format,
  p_zone_ids smallint[],
  p_slot_ids smallint[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and status not in ('expelled', 'rejected')
  ) then
    raise exception 'not_allowed';
  end if;
  perform public.assert_valid_preferences(p_first_name, p_job, p_zone_ids, p_slot_ids);
  if p_format is null then
    raise exception 'invalid_format';
  end if;

  update public.profiles
  set first_name = btrim(p_first_name), job = btrim(p_job), format = p_format, updated_at = now()
  where id = v_uid;

  delete from public.profile_zones where profile_id = v_uid;
  insert into public.profile_zones (profile_id, zone_id)
  select distinct v_uid, unnest(p_zone_ids);

  delete from public.profile_slots where profile_id = v_uid;
  insert into public.profile_slots (profile_id, slot_id)
  select distinct v_uid, unnest(p_slot_ids);
end;
$$;

-- "Metti in pausa gli inviti": null riprende subito, altrimenti una data futura (Europe/Rome).
create function public.set_my_invite_pause(p_resume_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.profiles where id = v_uid and status not in ('expelled', 'rejected')
  ) then
    raise exception 'not_allowed';
  end if;
  if p_resume_on is not null
     and (p_resume_on <= public.rome_today() or p_resume_on > public.rome_today() + 365) then
    raise exception 'invalid_resume_date';
  end if;

  update public.profiles
  set invites_resume_on = p_resume_on, updated_at = now()
  where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.zones enable row level security;
alter table public.slots enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_zones enable row level security;
alter table public.profile_slots enable row level security;
alter table public.profile_private enable row level security;
alter table public.pending_signups enable row level security;

create policy "zones: attive visibili a tutti, tutte al fondatore"
  on public.zones for select to anon, authenticated
  using (active or public.is_founder());

create policy "slots: attivi visibili a tutti, tutti al fondatore"
  on public.slots for select to anon, authenticated
  using (active or public.is_founder());

create policy "profiles: il proprio, o tutti per il fondatore"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_founder());

create policy "profile_zones: le proprie, o tutte per il fondatore"
  on public.profile_zones for select to authenticated
  using (profile_id = auth.uid() or public.is_founder());

create policy "profile_slots: i propri, o tutti per il fondatore"
  on public.profile_slots for select to authenticated
  using (profile_id = auth.uid() or public.is_founder());

-- Nemmeno l'iscritto rilegge il proprio genere o anno: solo il fondatore.
create policy "profile_private: solo il fondatore"
  on public.profile_private for select to authenticated
  using (public.is_founder());

-- pending_signups: nessuna policy, nessun accesso dai client.

-- ---------------------------------------------------------------------------
-- Privilegi
-- ---------------------------------------------------------------------------

revoke all on table
  public.zones, public.slots, public.profiles, public.profile_zones,
  public.profile_slots, public.profile_private, public.pending_signups
from anon, authenticated;

grant select on public.zones, public.slots to anon, authenticated;
grant select on public.profiles, public.profile_zones, public.profile_slots, public.profile_private
  to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_founder() to anon, authenticated;
grant execute on function public.rome_today() to anon, authenticated;
grant execute on function public.submit_signup(
  text, text, text, public.meeting_format, smallint[], smallint[], public.gender, smallint
) to anon, authenticated;
grant execute on function public.claim_pending_signup() to authenticated;
grant execute on function public.update_my_preferences(
  text, text, public.meeting_format, smallint[], smallint[]
) to authenticated;
grant execute on function public.set_my_invite_pause(date) to authenticated;
