create extension if not exists pgcrypto;

create type content_status as enum ('draft', 'published');
create type landmark_category as enum ('religious','residential','civic','commercial','transport','museum','military','other');
create type podcast_length_class as enum ('short','standard','long');
create type manager_role as enum ('editor','admin');

create table heritage_parks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(name) between 1 and 120),
  district text not null,
  description text not null default '',
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  boundary jsonb null,                       -- GeoJSON Polygon, validated by zod in the CMS
  thumbnail_path text null,
  thumbnail_bytes bigint null check (thumbnail_bytes > 0),
  attribution text not null default '',
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table heritage_landmarks (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references heritage_parks(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  aliases text[] not null default '{}',
  category landmark_category not null default 'other',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geofence_radius_m integer not null default 30 check (geofence_radius_m between 15 and 100),
  short_description text not null default '',
  description text not null default '',
  thumbnail_path text null,
  image_path text null,
  image_bytes bigint null check (image_bytes > 0),
  built_year integer null check (built_year between 1000 and 2100),
  architectural_style text null,
  wikidata_id text null check (wikidata_id ~ '^Q[0-9]+$'),
  osm_type text null check (osm_type in ('node','way','relation')),
  osm_id bigint null,
  attribution text not null default '',
  sort_order integer not null default 0,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on heritage_landmarks (park_id, sort_order);

create table podcasts (
  id uuid primary key default gen_random_uuid(),
  landmark_id uuid not null references heritage_landmarks(id) on delete cascade,
  title text not null,
  audio_path text null,
  duration_seconds integer null check (duration_seconds > 0),
  file_size_bytes bigint null check (file_size_bytes > 0),
  checksum_sha256 text null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  checksum_md5 text null check (checksum_md5 ~ '^[0-9a-f]{32}$'),
  transcript text null,
  voice text null,
  accent text null,
  length_class podcast_length_class null,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_podcast_complete check (
    status = 'draft' or (audio_path is not null and duration_seconds is not null
      and file_size_bytes is not null and checksum_sha256 is not null and checksum_md5 is not null))
);
create index on podcasts (landmark_id);

create table content_managers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role manager_role not null default 'editor',
  created_at timestamptz not null default now()
);

create table content_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  entity text not null check (entity in ('park','landmark','podcast')),
  entity_id uuid not null,
  action text not null check (action in ('create','update','publish','unpublish','delete','import')),
  at timestamptz not null default now()
);

-- updated_at trigger on the three content tables
create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger t_parks before update on heritage_parks for each row execute function touch_updated_at();
create trigger t_landmarks before update on heritage_landmarks for each row execute function touch_updated_at();
create trigger t_podcasts before update on podcasts for each row execute function touch_updated_at();

-- publish rule: a published landmark needs a published park
create function enforce_landmark_publish() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and (select status from heritage_parks where id = new.park_id) is distinct from 'published' then
    raise exception 'landmark_requires_published_park';
  end if;
  return new;
end $$;
create trigger t_landmark_publish before insert or update on heritage_landmarks
  for each row execute function enforce_landmark_publish();

alter table heritage_parks enable row level security;
alter table heritage_landmarks enable row level security;
alter table podcasts enable row level security;
alter table content_managers enable row level security;
alter table content_audit enable row level security;
-- no policies: only the server (service role) reads and writes

insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict do nothing;

create index on content_audit (at desc);

-- a published podcast needs a published landmark
create function enforce_podcast_publish() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and (select status from heritage_landmarks where id = new.landmark_id) is distinct from 'published' then
    raise exception 'podcast_requires_published_landmark';
  end if;
  return new;
end $$;
create trigger t_podcast_publish before insert or update on podcasts
  for each row execute function enforce_podcast_publish();

-- unpublishing a park unpublishes its landmarks, unpublishing a landmark unpublishes its podcasts
create function cascade_unpublish_park() returns trigger language plpgsql as $$
begin
  if new.status = 'draft' and old.status = 'published' then
    update heritage_landmarks set status = 'draft' where park_id = new.id and status = 'published';
  end if;
  return new;
end $$;
create trigger t_park_unpublish after update of status on heritage_parks
  for each row execute function cascade_unpublish_park();

create function cascade_unpublish_landmark() returns trigger language plpgsql as $$
begin
  if new.status = 'draft' and old.status = 'published' then
    update podcasts set status = 'draft' where landmark_id = new.id and status = 'published';
  end if;
  return new;
end $$;
create trigger t_landmark_unpublish after update of status on heritage_landmarks
  for each row execute function cascade_unpublish_landmark();

create policy "public read media" on storage.objects for select using (bucket_id = 'media');
