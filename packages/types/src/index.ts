// ─── Card condition ───────────────────────────────────────────────────────────

export type CardCondition =
  | "raw"
  | "psa10"
  | "psa9"
  | "psa8"
  | "cgc10"
  | "cgc9"
  | "sealed";

// ─── Card (shared shape used across the app) ─────────────────────────────────

export interface Card {
  id: string;
  tcgId: string;
  name: string;
  setName: string | null;
  setId: string | null;
  number: string | null;
  rarity: string | null;
  condition: CardCondition;
  quantity: number;
  type?: "card" | "sealed";
  section: "portfolio" | "watchlist";
  binder: string | null;
  purchasePrice: number | null;
  currentPrice: number | null;
  priceSource: string | null;
  imageUrl: string | null;
  imageUrlLarge: string | null;
  addedDate: string;
  lastPriceUpdate: string | null;
  targetBuyPrice: number | null;
  targetSellPrice: number | null;
  changeDay: number | null;
  changeWeek: number | null;
  changeMonth: number | null;
  recentHistory: PricePoint[];
  pricechartingId: string | null;
  pricechartingName: string | null;
}

export interface PricePoint {
  date: string;
  price: number;
  source?: string;
}

// ─── Portfolio stats ──────────────────────────────────────────────────────────

export interface PortfolioStats {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  dayChange: number;
  dayChangePct: number;
  weekChange: number;
  weekChangePct: number;
  monthChange: number;
  monthChangePct: number;
  cardCount: number;
  topMovers: Card[];
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface Profile {
  userId: string;
  currency: string;
  binderLists: string[];
  defaults: Record<string, unknown>;
  apiTokens: Record<string, string>;
}

// ─── Trade ───────────────────────────────────────────────────────────────────

export interface TradeCard {
  name: string;
  setName: string;
  condition: CardCondition;
  quantity: number;
  value: number | null;
}

export interface Trade {
  id: string;
  userId: string;
  cardsGiven: TradeCard[];
  cardsReceived: TradeCard[];
  notes: string | null;
  createdAt: string;
}

// ─── Card show ────────────────────────────────────────────────────────────────

export interface CardShow {
  name: string;
  date: string;
  location: string;
  city: string;
  state: string;
  zipCode: string | null;
  lat: number | null;
  lon: number | null;
  url: string | null;
}

// ─── TCGdex card search result ────────────────────────────────────────────────

export interface TcgCard {
  id: string;
  name: string;
  image: string | null;
  localId: string;
  set: {
    id: string;
    name: string;
    logo?: string | null;
  };
  rarity: string | null;
  types: string[] | null;
  variants?: Record<string, boolean> | null;
}

// ─── Named row type exports (for use before supabase gen types is run) ──────────

export type CollectionsRow = Database["public"]["Tables"]["collections"]["Row"];
export type WatchlistsRow = Database["public"]["Tables"]["watchlists"]["Row"];
export type CardPriceHistoryRow =
  Database["public"]["Tables"]["card_price_history"]["Row"];
/** @deprecated use CardPriceHistoryRow */
export type PokemonCardPricesRow = CardPriceHistoryRow;
export type TradesRow = Database["public"]["Tables"]["trades"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activity"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type UpcomingShowsRow =
  Database["public"]["Tables"]["upcoming_shows"]["Row"];
export type CardShowsCacheRow =
  Database["public"]["Tables"]["card_shows_cache"]["Row"];
export type SoldCardsRow = Database["public"]["Tables"]["sold_cards"]["Row"];

// ─── Supabase Database type (generated — will be replaced by supabase gen types) ─

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          currency: string;
          binder_lists: string[];
          defaults: Record<string, unknown>;
          api_tokens: Record<string, string>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["profiles"]["Row"],
          "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      collections: {
        Row: {
          id: string;
          user_id: string;
          tcg_id: string;
          name: string;
          set_name: string | null;
          set_id: string | null;
          number: string | null;
          rarity: string | null;
          condition: string;
          quantity: number;
          type: string;
          binder: string | null;
          purchase_price: number | null;
          current_price: number | null;
          price_source: string | null;
          image_url: string | null;
          image_url_large: string | null;
          target_buy_price: number | null;
          target_sell_price: number | null;
          change_day: number | null;
          change_week: number | null;
          change_month: number | null;
          pricecharting_id: string | null;
          pricecharting_name: string | null;
          added_date: string;
          last_price_update: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["collections"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["collections"]["Insert"]>;
      };
      watchlists: {
        Row: Database["public"]["Tables"]["collections"]["Row"];
        Insert: Database["public"]["Tables"]["collections"]["Insert"];
        Update: Database["public"]["Tables"]["collections"]["Update"];
      };
      card_price_history: {
        Row: {
          id: string;
          card_id: string;
          card_table: "collections" | "watchlists";
          user_id: string;
          date: string;
          price: number;
          source: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["card_price_history"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["card_price_history"]["Insert"]
        >;
      };
      trades: {
        Row: {
          id: string;
          user_id: string;
          cards_given: TradeCard[];
          cards_received: TradeCard[];
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["trades"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["trades"]["Insert"]>;
      };
      activity: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          description: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["activity"]["Row"],
          "id" | "created_at"
        >;
        Update: never;
      };
      upcoming_shows: {
        Row: {
          id: string;
          user_id: string;
          show_data: CardShow;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["upcoming_shows"]["Row"],
          "id" | "created_at"
        >;
        Update: never;
      };
      card_shows_cache: {
        Row: {
          state_code: string;
          shows: CardShow[];
          cached_at: string;
        };
        Insert: Database["public"]["Tables"]["card_shows_cache"]["Row"];
        Update: Partial<
          Database["public"]["Tables"]["card_shows_cache"]["Row"]
        >;
      };
      sold_cards: {
        Row: {
          id: string;
          user_id: string;
          tcg_id: string;
          name: string;
          set_name: string | null;
          set_id: string | null;
          number: string | null;
          rarity: string | null;
          condition: string;
          quantity: number;
          type: string;
          purchase_price: number | null;
          current_price: number | null;
          image_url: string | null;
          image_url_large: string | null;
          pricecharting_id: string | null;
          pricecharting_name: string | null;
          sale_price: number | null;
          sale_date: string | null;
          is_trade: boolean;
          trade_cards_received: TradeCard[];
          added_date: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["sold_cards"]["Row"],
          "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["sold_cards"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
