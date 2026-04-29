-- =========================================================
-- BuildLedger: Construction Financial OS — Phase 1 Schema
-- Single-tenant for now; auth + per-user RLS comes next phase.
-- =========================================================

-- Enums
create type public.project_status as enum ('active', 'completed', 'archived');
create type public.expense_category as enum (
  'labor', 'materials', 'equipment', 'subcontractor',
  'cogs', 'operating', 'other'
);
create type public.payment_status as enum ('paid', 'unpaid', 'partial');
create type public.account_type as enum ('cash', 'bank', 'credit_card');

-- ---------------------------------------------------------
-- Projects
-- ---------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_number text,
  client_name text,
  address text,
  start_date date not null default current_date,
  budget numeric(14,2),
  status public.project_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Accounts (cash / bank / credit card)
-- ---------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.account_type not null,
  starting_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Vendors (smart autofill source)
-- ---------------------------------------------------------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_category public.expense_category,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  date date not null default current_date,
  category public.expense_category not null,
  vendor text not null,
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  payment_method text,
  payment_status public.payment_status not null default 'paid',
  due_date date,
  receipt_url text,
  notes text,
  hours numeric(10,2),
  rate numeric(10,2),
  quantity numeric(12,2),
  unit_price numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expenses_project on public.expenses(project_id);
create index idx_expenses_date on public.expenses(date desc);
create index idx_expenses_status on public.expenses(payment_status);
create index idx_expenses_category on public.expenses(category);

-- ---------------------------------------------------------
-- Incomes
-- ---------------------------------------------------------
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  date date not null default current_date,
  client_name text,
  description text,
  invoice_number text,
  amount numeric(14,2) not null check (amount >= 0),
  payment_status public.payment_status not null default 'paid',
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_incomes_project on public.incomes(project_id);
create index idx_incomes_date on public.incomes(date desc);

-- ---------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger trg_incomes_updated before update on public.incomes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- RLS — open for single-tenant demo. Tighten when auth lands.
-- ---------------------------------------------------------
alter table public.projects enable row level security;
alter table public.accounts enable row level security;
alter table public.vendors enable row level security;
alter table public.expenses enable row level security;
alter table public.incomes enable row level security;

-- Open policies (TODO: scope by auth.uid() once auth is added)
create policy "open_all_projects" on public.projects for all using (true) with check (true);
create policy "open_all_accounts" on public.accounts for all using (true) with check (true);
create policy "open_all_vendors"  on public.vendors  for all using (true) with check (true);
create policy "open_all_expenses" on public.expenses for all using (true) with check (true);
create policy "open_all_incomes"  on public.incomes  for all using (true) with check (true);

-- ---------------------------------------------------------
-- Storage bucket: receipts
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

create policy "Public receipts read"   on storage.objects for select using (bucket_id = 'receipts');
create policy "Public receipts insert" on storage.objects for insert with check (bucket_id = 'receipts');
create policy "Public receipts update" on storage.objects for update using (bucket_id = 'receipts');
create policy "Public receipts delete" on storage.objects for delete using (bucket_id = 'receipts');

-- ---------------------------------------------------------
-- Seed: a couple default accounts so the app isn't empty
-- ---------------------------------------------------------
insert into public.accounts (name, type, starting_balance) values
  ('Operating Bank', 'bank', 0),
  ('Cash on Hand', 'cash', 0),
  ('Business Credit Card', 'credit_card', 0);
