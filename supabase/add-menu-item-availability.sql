-- Add persisted availability state for menu items.
ALTER TABLE public."MENU_ITEM"
ADD COLUMN IF NOT EXISTS "Availability" boolean NOT NULL DEFAULT true;

-- Existing rows remain available after the column is added.
UPDATE public."MENU_ITEM"
SET "Availability" = true
WHERE "Availability" IS NULL;
