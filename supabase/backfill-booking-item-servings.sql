-- Run once in the Supabase SQL editor AFTER backing up BOOKING_ITEM. Run before relying on the new reservation logic.
-- Invoices already issued are not recalculated.
update "BOOKING_ITEM" bi
set "Quantity" = b."GuestCount"
from "BOOKING" b
where bi."BookingID" = b."BookingID"
  and bi."Quantity" = 1 and b."GuestCount" > 1
  and b."Status" in ('pending', 'confirmed')
  and b."EventDate" >= current_date
  and not exists (select 1 from "PREPARATION_LOG" p where p."BookingID" = b."BookingID");
