-- Entry metadata submitted with a version must remain private until that
-- version passes review.
ALTER TABLE market_versions ADD COLUMN entry_patch TEXT;
