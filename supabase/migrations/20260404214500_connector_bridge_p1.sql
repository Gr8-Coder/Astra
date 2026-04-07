create type public.connector_link_state as enum (
  'idle',
  'session_created',
  'awaiting_user',
  'token_exchanged',
  'syncing_accounts',
  'syncing_transactions',
  'connected',
  'retry_scheduled',
  'error'
);

alter table public.provider_connections
  add column if not exists link_state public.connector_link_state not null default 'idle',
  add column if not exists retry_count integer not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_attempted_at timestamptz,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_message text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_connections_retry_count_check'
  ) then
    alter table public.provider_connections
      add constraint provider_connections_retry_count_check check (retry_count >= 0);
  end if;
end;
$$;

create index if not exists provider_connections_link_state_idx
  on public.provider_connections (user_id, link_state, next_retry_at);

alter table public.bank_link_sessions
  add column if not exists retry_count integer not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_attempted_at timestamptz,
  add column if not exists last_completed_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_message text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bank_link_sessions_retry_count_check'
  ) then
    alter table public.bank_link_sessions
      add constraint bank_link_sessions_retry_count_check check (retry_count >= 0);
  end if;
end;
$$;

create table public.statement_import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid references public.provider_connections (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  provider text not null default 'statement-import',
  source text not null default 'upload',
  file_name text,
  file_type text,
  file_hash text,
  status public.sync_status not null default 'queued',
  row_count integer not null default 0,
  inserted_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint statement_import_batches_row_count_check check (row_count >= 0),
  constraint statement_import_batches_inserted_count_check check (inserted_count >= 0),
  constraint statement_import_batches_skipped_count_check check (skipped_count >= 0),
  constraint statement_import_batches_failed_count_check check (failed_count >= 0)
);

create index statement_import_batches_user_created_idx
  on public.statement_import_batches (user_id, created_at desc);

create trigger statement_import_batches_set_updated_at
before update on public.statement_import_batches
for each row
execute function public.handle_updated_at();

alter table public.statement_import_batches enable row level security;

create policy "statement_import_batches_manage_own"
on public.statement_import_batches
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
