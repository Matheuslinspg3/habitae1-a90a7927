create table if not exists public.function_usage_limits (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  organization_id uuid null references public.organizations(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  max_requests integer not null check (max_requests > 0),
  window_seconds integer not null check (window_seconds > 0),
  burst_threshold integer not null check (burst_threshold > 0),
  burst_window_seconds integer not null default 60 check (burst_window_seconds > 0),
  cooldown_seconds integer not null default 300 check (cooldown_seconds > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_function_usage_limits_unique_scope
on public.function_usage_limits (
  function_name,
  coalesce(organization_id::text, 'global'),
  coalesce(user_id::text, 'global')
);

create table if not exists public.function_usage_events (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  organization_id uuid null references public.organizations(id) on delete set null,
  user_id uuid null references auth.users(id) on delete set null,
  allowed boolean not null,
  reason text null,
  response_status integer null,
  duration_ms integer null,
  cost_units numeric(12,2) not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.function_usage_blocks (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  organization_id uuid null references public.organizations(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  reason text not null,
  blocked_until timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_function_usage_blocks_unique_scope
on public.function_usage_blocks (
  function_name,
  coalesce(organization_id::text, 'global'),
  coalesce(user_id::text, 'global')
);

create index if not exists idx_function_usage_events_fn_created_at on public.function_usage_events(function_name, created_at desc);
create index if not exists idx_function_usage_events_org_created_at on public.function_usage_events(organization_id, created_at desc);
create index if not exists idx_function_usage_events_user_created_at on public.function_usage_events(user_id, created_at desc);
create index if not exists idx_function_usage_blocks_until on public.function_usage_blocks(function_name, blocked_until desc);

alter table public.function_usage_limits enable row level security;
alter table public.function_usage_events enable row level security;
alter table public.function_usage_blocks enable row level security;

create or replace function public.set_updated_at_function_usage()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_function_usage_limits on public.function_usage_limits;
create trigger set_updated_at_function_usage_limits
before update on public.function_usage_limits
for each row execute function public.set_updated_at_function_usage();

drop trigger if exists set_updated_at_function_usage_blocks on public.function_usage_blocks;
create trigger set_updated_at_function_usage_blocks
before update on public.function_usage_blocks
for each row execute function public.set_updated_at_function_usage();

delete from public.function_usage_limits
where function_name in ('imobzi-process','extract-property-pdf','cloudinary-purge','scrape-drive-photos')
  and organization_id is null
  and user_id is null;

insert into public.function_usage_limits (function_name, organization_id, user_id, max_requests, window_seconds, burst_threshold, burst_window_seconds, cooldown_seconds)
values
  ('imobzi-process', null, null, 50, 3600, 6, 120, 600),
  ('extract-property-pdf', null, null, 80, 3600, 10, 120, 600),
  ('cloudinary-purge', null, null, 5, 3600, 2, 300, 1800),
  ('scrape-drive-photos', null, null, 120, 3600, 20, 120, 600);
