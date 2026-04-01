create extension if not exists pgcrypto;

create type public.account_kind as enum (
  'bank',
  'credit',
  'cash',
  'investment',
  'loan',
  'wallet',
  'other'
);

create type public.account_status as enum (
  'active',
  'inactive',
  'archived',
  'sync_error'
);

create type public.category_kind as enum (
  'expense',
  'income',
  'transfer'
);

create type public.transaction_direction as enum (
  'debit',
  'credit',
  'transfer'
);

create type public.recurring_cadence as enum (
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom'
);

create type public.sync_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed'
);

create type public.investment_asset_class as enum (
  'equity',
  'mutual_fund',
  'etf',
  'crypto',
  'bond',
  'cash',
  'other'
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  base_currency text not null default 'INR',
  locale text not null default 'en-IN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_institution_id text,
  name text not null,
  logo_url text,
  status public.account_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  provider text not null,
  external_connection_id text not null,
  display_name text,
  status public.account_status not null default 'active',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_connection_id)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  provider_connection_id uuid references public.provider_connections (id) on delete set null,
  provider text,
  provider_account_id text,
  name text not null,
  official_name text,
  mask text,
  kind public.account_kind not null default 'bank',
  subtype text,
  currency_code text not null default 'INR',
  current_balance numeric(14, 2) not null default 0,
  available_balance numeric(14, 2),
  credit_limit numeric(14, 2),
  is_manual boolean not null default false,
  status public.account_status not null default 'active',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_account_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  parent_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null,
  icon text,
  accent_color text,
  kind public.category_kind not null default 'expense',
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_system_slug_idx
  on public.categories (slug)
  where user_id is null;

create unique index categories_user_slug_idx
  on public.categories (user_id, slug)
  where user_id is not null;

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  assigned_amount numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_period_check check (period_end >= period_start),
  unique (user_id, category_id, period_start, period_end)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  provider text,
  provider_transaction_id text,
  merchant_name text not null,
  description text,
  amount numeric(14, 2) not null,
  currency_code text not null default 'INR',
  direction public.transaction_direction not null default 'debit',
  booked_at timestamptz not null,
  authorized_at timestamptz,
  pending boolean not null default false,
  manual boolean not null default false,
  review_required boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_transaction_id)
);

create table public.transaction_category_suggestions (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  suggested_category_id uuid not null references public.categories (id) on delete cascade,
  source text not null default 'rules',
  confidence numeric(5, 4) not null default 0.0,
  reason text,
  accepted boolean,
  created_at timestamptz not null default now(),
  constraint suggestion_confidence_range check (confidence >= 0 and confidence <= 1),
  unique (transaction_id, suggested_category_id, source)
);

create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  provider text,
  provider_recurring_id text,
  merchant_name text not null,
  label text not null,
  amount numeric(14, 2) not null,
  currency_code text not null default 'INR',
  cadence public.recurring_cadence not null default 'monthly',
  next_due_on date,
  last_paid_at timestamptz,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_recurring_id)
);

create table public.investment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  provider_connection_id uuid references public.provider_connections (id) on delete set null,
  provider text,
  provider_account_id text,
  name text not null,
  broker_name text,
  currency_code text not null default 'INR',
  current_value numeric(14, 2) not null default 0,
  cost_basis numeric(14, 2),
  day_change_amount numeric(14, 2),
  day_change_percent numeric(9, 4),
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_account_id)
);

create table public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  investment_account_id uuid not null references public.investment_accounts (id) on delete cascade,
  symbol text not null,
  display_name text,
  asset_class public.investment_asset_class not null default 'equity',
  quantity numeric(20, 6) not null default 0,
  average_cost numeric(14, 4),
  market_value numeric(14, 2),
  day_change_percent numeric(9, 4),
  weight numeric(9, 4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investment_account_id, symbol)
);

create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  range_key text not null,
  total_value numeric(14, 2) not null,
  captured_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  scope text not null,
  status public.sync_status not null default 'queued',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index institutions_user_id_idx on public.institutions (user_id);
create index provider_connections_user_id_idx on public.provider_connections (user_id);
create index accounts_user_id_kind_idx on public.accounts (user_id, kind);
create index budgets_user_id_period_idx on public.budgets (user_id, period_start desc);
create index transactions_user_id_booked_at_idx on public.transactions (user_id, booked_at desc);
create index transactions_account_id_booked_at_idx on public.transactions (account_id, booked_at desc);
create index recurring_items_user_id_due_idx on public.recurring_items (user_id, next_due_on);
create index investment_accounts_user_id_idx on public.investment_accounts (user_id);
create index investment_positions_user_id_symbol_idx on public.investment_positions (user_id, symbol);
create index portfolio_snapshots_user_id_captured_at_idx on public.portfolio_snapshots (user_id, captured_at desc);
create index sync_runs_user_id_started_at_idx on public.sync_runs (user_id, started_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.handle_updated_at();

create trigger institutions_set_updated_at
before update on public.institutions
for each row
execute function public.handle_updated_at();

create trigger provider_connections_set_updated_at
before update on public.provider_connections
for each row
execute function public.handle_updated_at();

create trigger accounts_set_updated_at
before update on public.accounts
for each row
execute function public.handle_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.handle_updated_at();

create trigger budgets_set_updated_at
before update on public.budgets
for each row
execute function public.handle_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.handle_updated_at();

create trigger recurring_items_set_updated_at
before update on public.recurring_items
for each row
execute function public.handle_updated_at();

create trigger investment_accounts_set_updated_at
before update on public.investment_accounts
for each row
execute function public.handle_updated_at();

create trigger investment_positions_set_updated_at
before update on public.investment_positions
for each row
execute function public.handle_updated_at();

create trigger sync_runs_set_updated_at
before update on public.sync_runs
for each row
execute function public.handle_updated_at();

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.provider_connections enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_category_suggestions enable row level security;
alter table public.recurring_items enable row level security;
alter table public.investment_accounts enable row level security;
alter table public.investment_positions enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.sync_runs enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "institutions_manage_own"
on public.institutions
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "provider_connections_manage_own"
on public.provider_connections
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "accounts_manage_own"
on public.accounts
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "categories_select_system_or_own"
on public.categories
for select
using (is_system = true or user_id = auth.uid());

create policy "categories_insert_own"
on public.categories
for insert
with check (user_id = auth.uid() and is_system = false);

create policy "categories_update_own"
on public.categories
for update
using (user_id = auth.uid() and is_system = false)
with check (user_id = auth.uid() and is_system = false);

create policy "categories_delete_own"
on public.categories
for delete
using (user_id = auth.uid() and is_system = false);

create policy "budgets_manage_own"
on public.budgets
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "transactions_manage_own"
on public.transactions
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "transaction_suggestions_manage_own"
on public.transaction_category_suggestions
for all
using (
  exists (
    select 1
    from public.transactions
    where public.transactions.id = transaction_category_suggestions.transaction_id
      and public.transactions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.transactions
    where public.transactions.id = transaction_category_suggestions.transaction_id
      and public.transactions.user_id = auth.uid()
  )
);

create policy "recurring_items_manage_own"
on public.recurring_items
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "investment_accounts_manage_own"
on public.investment_accounts
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "investment_positions_manage_own"
on public.investment_positions
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "portfolio_snapshots_manage_own"
on public.portfolio_snapshots
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "sync_runs_manage_own"
on public.sync_runs
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into public.categories (
  user_id,
  name,
  slug,
  icon,
  accent_color,
  kind,
  sort_order,
  is_system
)
values
  (null, 'Rent', 'rent', 'key', '#DA2017', 'expense', 10, true),
  (null, 'Food & Drink', 'food-drink', 'restaurant', '#4CD112', 'expense', 20, true),
  (null, 'Car & Transport', 'car-transport', 'car-sport', '#20C5C1', 'expense', 30, true),
  (null, 'Shopping', 'shopping', 'bag-handle', '#5A58D8', 'expense', 40, true),
  (null, 'Travel & Vacation', 'travel-vacation', 'boat', '#E11D1D', 'expense', 50, true),
  (null, 'Entertainment', 'entertainment', 'film', '#E11D1D', 'expense', 60, true),
  (null, 'Utilities', 'utilities', 'construct', '#E11D1D', 'expense', 70, true),
  (null, 'Streaming', 'streaming', 'tv', '#E11D1D', 'expense', 80, true),
  (null, 'Healthcare', 'healthcare', 'medkit', '#E11D1D', 'expense', 90, true),
  (null, 'Gym', 'gym', 'barbell', '#E11D1D', 'expense', 100, true),
  (null, 'Other', 'other', 'person', '#E11D1D', 'expense', 110, true)
on conflict do nothing;

with
  food_group as (
    select id
    from public.categories
    where user_id is null and slug = 'food-drink'
  ),
  shopping_group as (
    select id
    from public.categories
    where user_id is null and slug = 'shopping'
  )
insert into public.categories (
  user_id,
  parent_id,
  name,
  slug,
  icon,
  accent_color,
  kind,
  sort_order,
  is_system
)
select
  null::uuid,
  food_group.id,
  'Groceries',
  'groceries',
  'nutrition',
  '#68D61D',
  'expense'::public.category_kind,
  21,
  true
from food_group
where not exists (
  select 1 from public.categories where user_id is null and slug = 'groceries'
)
union all
select
  null::uuid,
  food_group.id,
  'Restaurant',
  'restaurant',
  'fast-food',
  '#68D61D',
  'expense'::public.category_kind,
  22,
  true
from food_group
where not exists (
  select 1 from public.categories where user_id is null and slug = 'restaurant'
)
union all
select
  null::uuid,
  food_group.id,
  'Coffee',
  'coffee',
  'cafe',
  '#68D61D',
  'expense'::public.category_kind,
  23,
  true
from food_group
where not exists (
  select 1 from public.categories where user_id is null and slug = 'coffee'
)
union all
select
  null::uuid,
  shopping_group.id,
  'Clothing',
  'clothing',
  'shirt',
  '#735DFF',
  'expense'::public.category_kind,
  41,
  true
from shopping_group
where not exists (
  select 1 from public.categories where user_id is null and slug = 'clothing'
)
union all
select
  null::uuid,
  shopping_group.id,
  'Shops',
  'shops',
  'basket',
  '#735DFF',
  'expense'::public.category_kind,
  42,
  true
from shopping_group
where not exists (
  select 1 from public.categories where user_id is null and slug = 'shops'
);
