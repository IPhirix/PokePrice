-- User profiles (replaces settings.json)
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'USD',
  binder_lists jsonb not null default '[]',
  defaults jsonb not null default '{}',
  api_tokens jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

do $$ begin
  create policy "Users see own profile" on profiles for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users insert own profile" on profiles for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users update own profile" on profiles for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Collections (portfolio section of cards.json)
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tcg_id text not null,
  name text not null,
  set_name text,
  set_id text,
  number text,
  rarity text,
  condition text not null default 'raw',
  quantity integer not null default 1,
  binder text,
  purchase_price numeric(10,2),
  current_price numeric(10,2),
  price_source text,
  image_url text,
  image_url_large text,
  target_buy_price numeric(10,2),
  target_sell_price numeric(10,2),
  change_day numeric(6,2),
  change_week numeric(6,2),
  change_month numeric(6,2),
  pricecharting_id text,
  pricecharting_name text,
  added_date timestamptz not null default now(),
  last_price_update timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table collections enable row level security;

do $$ begin
  create policy "Users see own collections" on collections for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users insert own collections" on collections for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users update own collections" on collections for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users delete own collections" on collections for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists collections_user_id_idx on collections(user_id);
create index if not exists collections_tcg_id_idx on collections(tcg_id);

-- Watchlists (watchlist section of cards.json)
create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tcg_id text not null,
  name text not null,
  set_name text,
  set_id text,
  number text,
  rarity text,
  condition text not null default 'raw',
  quantity integer not null default 1,
  binder text,
  purchase_price numeric(10,2),
  current_price numeric(10,2),
  price_source text,
  image_url text,
  image_url_large text,
  target_buy_price numeric(10,2),
  target_sell_price numeric(10,2),
  change_day numeric(6,2),
  change_week numeric(6,2),
  change_month numeric(6,2),
  pricecharting_id text,
  pricecharting_name text,
  added_date timestamptz not null default now(),
  last_price_update timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table watchlists enable row level security;

do $$ begin
  create policy "Users see own watchlists" on watchlists for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users insert own watchlists" on watchlists for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users update own watchlists" on watchlists for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users delete own watchlists" on watchlists for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists watchlists_user_id_idx on watchlists(user_id);
create index if not exists watchlists_tcg_id_idx on watchlists(tcg_id);

-- Trades (replaces trades.json)
create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cards_given jsonb not null default '[]',
  cards_received jsonb not null default '[]',
  notes text,
  created_at timestamptz not null default now()
);

alter table trades enable row level security;

do $$ begin
  create policy "Users see own trades" on trades for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users insert own trades" on trades for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users update own trades" on trades for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users delete own trades" on trades for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists trades_user_id_idx on trades(user_id);

-- Activity log (replaces activity.json)
create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table activity enable row level security;

do $$ begin
  create policy "Users see own activity" on activity for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users insert own activity" on activity for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists activity_user_id_idx on activity(user_id);
create index if not exists activity_created_at_idx on activity(created_at desc);

-- Upcoming shows saved by user (replaces upcoming-shows.json)
create table if not exists upcoming_shows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  show_data jsonb not null,
  created_at timestamptz not null default now()
);

alter table upcoming_shows enable row level security;

do $$ begin
  create policy "Users see own upcoming shows" on upcoming_shows for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users insert own upcoming shows" on upcoming_shows for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users delete own upcoming shows" on upcoming_shows for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists upcoming_shows_user_id_idx on upcoming_shows(user_id);

-- Shared cache: card shows per US state (replaces cardshows-{state}.json)
create table if not exists card_shows_cache (
  state_code char(2) primary key,
  shows jsonb not null default '[]',
  cached_at timestamptz not null default now()
);

alter table card_shows_cache enable row level security;

do $$ begin
  create policy "Authenticated users read card shows cache" on card_shows_cache for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- Updated_at auto-bump trigger
create or replace function handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create trigger profiles_updated_at before update on profiles for each row execute procedure handle_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger collections_updated_at before update on collections for each row execute procedure handle_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger watchlists_updated_at before update on watchlists for each row execute procedure handle_updated_at();
exception when duplicate_object then null; end $$;
