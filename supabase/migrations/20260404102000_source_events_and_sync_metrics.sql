create table public.source_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  scope text not null default 'transactions',
  event_type text not null default 'transaction_ingest',
  idempotency_key text not null,
  status public.sync_status not null default 'queued',
  occurred_at timestamptz,
  processed_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  sync_run_id uuid references public.sync_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_events_idempotency_key_check check (char_length(trim(idempotency_key)) > 0),
  unique (user_id, provider, idempotency_key)
);

create index source_events_user_created_idx
  on public.source_events (user_id, created_at desc);

create index source_events_status_created_idx
  on public.source_events (user_id, status, created_at desc);

create index source_events_sync_run_idx
  on public.source_events (sync_run_id);

create index source_events_provider_created_idx
  on public.source_events (user_id, provider, created_at desc);

alter table public.sync_runs
  add column if not exists scanned_count integer not null default 0,
  add column if not exists matched_count integer not null default 0,
  add column if not exists inserted_count integer not null default 0,
  add column if not exists updated_count integer not null default 0,
  add column if not exists failed_count integer not null default 0,
  add column if not exists duration_ms integer,
  add column if not exists correlation_id text;

alter table public.sync_runs
  add constraint sync_runs_scanned_count_non_negative check (scanned_count >= 0);

alter table public.sync_runs
  add constraint sync_runs_matched_count_non_negative check (matched_count >= 0);

alter table public.sync_runs
  add constraint sync_runs_inserted_count_non_negative check (inserted_count >= 0);

alter table public.sync_runs
  add constraint sync_runs_updated_count_non_negative check (updated_count >= 0);

alter table public.sync_runs
  add constraint sync_runs_failed_count_non_negative check (failed_count >= 0);

create index if not exists sync_runs_user_provider_started_at_idx
  on public.sync_runs (user_id, provider, started_at desc);

create index if not exists transactions_user_category_booked_at_idx
  on public.transactions (user_id, category_id, booked_at desc);

create index if not exists accounts_user_kind_last_synced_at_idx
  on public.accounts (user_id, kind, last_synced_at desc);

create trigger source_events_set_updated_at
before update on public.source_events
for each row
execute function public.handle_updated_at();

alter table public.source_events enable row level security;

create policy "source_events_manage_own"
on public.source_events
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
