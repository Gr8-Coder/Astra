create type public.bank_link_session_status as enum (
  'created',
  'exchanged',
  'synced',
  'failed',
  'expired'
);

create table public.bank_link_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_session_id text not null,
  provider_institution_id text,
  institution_name text,
  link_token_hint text,
  status public.bank_link_session_status not null default 'created',
  connection_id uuid references public.provider_connections (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_session_id)
);

create index bank_link_sessions_user_created_idx
  on public.bank_link_sessions (user_id, created_at desc);

create index bank_link_sessions_connection_idx
  on public.bank_link_sessions (connection_id);

create trigger bank_link_sessions_set_updated_at
before update on public.bank_link_sessions
for each row
execute function public.handle_updated_at();

alter table public.bank_link_sessions enable row level security;

create policy "bank_link_sessions_manage_own"
on public.bank_link_sessions
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
