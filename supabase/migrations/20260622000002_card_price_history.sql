-- Per-user price history for tracked cards
-- Named "card_price_history" to avoid collision with existing "pokemon_card_prices" price source table
create table if not exists card_price_history (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null,
  card_table text not null check (card_table in ('collections', 'watchlists')),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  price numeric(10,2) not null,
  source text,
  created_at timestamptz not null default now(),
  unique (card_id, date)
);

alter table card_price_history enable row level security;

create policy "Users see own card price history"
  on card_price_history for select using (auth.uid() = user_id);

create policy "Users insert own card price history"
  on card_price_history for insert with check (auth.uid() = user_id);

create policy "Users upsert own card price history"
  on card_price_history for update using (auth.uid() = user_id);

create index card_price_history_card_id_idx on card_price_history(card_id);
create index card_price_history_user_id_idx on card_price_history(user_id);
create index card_price_history_date_idx on card_price_history(date);
