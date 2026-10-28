-- Geographic ownership and reviewed retrieval context stay private to the
-- trusted application service. No anonymous or authenticated Data API access.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;

create table public.fmc_service_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  boundary extensions.geography(multipolygon, 4326) not null,
  created_at timestamptz not null default now()
);
create index fmc_service_areas_boundary_idx on public.fmc_service_areas using gist(boundary);

create table public.fmc_asset_owners (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid not null references public.fmc_service_areas(id),
  name text not null check (length(name) between 1 and 200),
  contact_details jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  unique(service_area_id, name)
);

create table public.fmc_managed_assets (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid not null references public.fmc_service_areas(id),
  owner_id uuid not null references public.fmc_asset_owners(id),
  asset_type text not null check (length(asset_type) between 1 and 100),
  location extensions.geography(point, 4326) not null,
  source_reference text,
  updated_at timestamptz not null default now()
);
create index fmc_managed_assets_location_idx on public.fmc_managed_assets using gist(location);
create index fmc_managed_assets_area_type_idx on public.fmc_managed_assets(service_area_id, asset_type);

create table public.fmc_context_documents (
  id uuid primary key default gen_random_uuid(),
  service_area_id uuid not null references public.fmc_service_areas(id),
  title text not null check (length(title) between 1 and 200),
  body text not null check (length(body) between 1 and 12000),
  embedding extensions.vector(384),
  approved_at timestamptz,
  approved_by text,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  check ((approved_at is null) = (approved_by is null))
);
create index fmc_context_documents_area_approved_idx on public.fmc_context_documents(service_area_id)
  where approved_at is not null;

alter table public.fmc_service_areas enable row level security;
alter table public.fmc_asset_owners enable row level security;
alter table public.fmc_managed_assets enable row level security;
alter table public.fmc_context_documents enable row level security;
revoke all on public.fmc_service_areas, public.fmc_asset_owners, public.fmc_managed_assets,
  public.fmc_context_documents from public, anon, authenticated;
grant select, insert, update, delete on public.fmc_service_areas, public.fmc_asset_owners,
  public.fmc_managed_assets, public.fmc_context_documents to service_role;

-- Security invoker: the calling service must have access to all underlying rows.
create function public.fmc_find_nearby_assets(area uuid, latitude double precision,
  longitude double precision, radius_metres double precision default 500)
returns table (asset_id uuid, asset_type text, owner_name text, distance_metres double precision)
language sql stable security invoker set search_path = '' as $$
  select a.id, a.asset_type, o.name,
    extensions.st_distance(a.location, extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography)
  from public.fmc_managed_assets as a
  join public.fmc_asset_owners as o on o.id = a.owner_id and o.service_area_id = a.service_area_id
  where a.service_area_id = area and o.verified_at is not null
    and latitude between -90 and 90 and longitude between -180 and 180
    and radius_metres between 1 and 10000
    and extensions.st_dwithin(a.location, extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography, radius_metres)
  order by a.location operator(extensions.<->) extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
  limit 50;
$$;
revoke all on function public.fmc_find_nearby_assets(uuid, double precision, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.fmc_find_nearby_assets(uuid, double precision, double precision, double precision)
  to service_role;

create function public.fmc_match_reviewed_context(area uuid, query_embedding extensions.vector(384), match_count integer default 5)
returns table (document_id uuid, title text, body text, similarity double precision)
language sql stable security invoker set search_path = '' as $$
  select d.id, d.title, d.body, 1 - (d.embedding operator(extensions.<=>) query_embedding)
  from public.fmc_context_documents as d
  where d.service_area_id = area and d.approved_at is not null and d.embedding is not null
    and match_count between 1 and 20
  order by d.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 0), 20);
$$;
revoke all on function public.fmc_match_reviewed_context(uuid, extensions.vector, integer)
  from public, anon, authenticated;
grant execute on function public.fmc_match_reviewed_context(uuid, extensions.vector, integer) to service_role;

alter table public.fmc_telemetry drop constraint if exists fmc_telemetry_mode_check;
alter table public.fmc_telemetry add constraint fmc_telemetry_mode_check check (mode in ('replay', 'live'));
