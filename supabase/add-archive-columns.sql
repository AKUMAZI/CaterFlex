alter table if exists public."BOOKING"
  add column if not exists "IsArchived" boolean not null default false,
  add column if not exists "ArchivedAt" timestamptz;

alter table if exists public."MEAL_PREP_ORDER"
  add column if not exists "IsArchived" boolean not null default false,
  add column if not exists "ArchivedAt" timestamptz;

create index if not exists booking_operator_archived_idx
  on public."BOOKING" ("OperatorID", "IsArchived");

create index if not exists meal_prep_order_operator_archived_idx
  on public."MEAL_PREP_ORDER" ("OperatorID", "IsArchived");

update public."BOOKING"
set "IsArchived" = false
where "IsArchived" is null;

update public."MEAL_PREP_ORDER"
set "IsArchived" = false
where "IsArchived" is null;

alter table if exists public."BOOKING"
  alter column "IsArchived" set default false,
  alter column "IsArchived" set not null;

alter table if exists public."MEAL_PREP_ORDER"
  alter column "IsArchived" set default false,
  alter column "IsArchived" set not null;

-- Safe to run repeatedly: existing archive timestamps are preserved.
-- The application writes ArchivedAt when IsArchived changes to true.

-- Verification:
-- select "IsArchived", "ArchivedAt" from public."BOOKING" limit 1;
-- select "IsArchived", "ArchivedAt" from public."MEAL_PREP_ORDER" limit 1;

-- Payments and invoices intentionally remain untouched so financial history is retained.

-- Archive fields are deliberately additive and do not delete customer or order data.

-- Ensure both tables are ready for the owner archive actions.

-- no-op marker for migration runners
select 1;
