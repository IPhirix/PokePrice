-- Add missing DELETE policy for card_price_history
-- Needed so syncCardDelete can clean up price history when a card is removed

create policy "Users delete own card price history"
  on card_price_history for delete using (auth.uid() = user_id);
