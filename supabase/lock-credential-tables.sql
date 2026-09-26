-- Lock CUSTOMER so the public Data API cannot read passwords.
-- Run this in the Supabase SQL Editor AFTER server-side login/signup is deployed.
-- Service role (used by Next.js server actions) still bypasses RLS.

ALTER TABLE public."CUSTOMER" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon to select customers" ON public."CUSTOMER";
DROP POLICY IF EXISTS "Allow authenticated users to read customers" ON public."CUSTOMER";

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'CUSTOMER'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public."CUSTOMER"', pol.policyname);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public."CUSTOMER" FROM anon, authenticated;
GRANT ALL ON TABLE public."CUSTOMER" TO postgres, service_role;

-- Same lock for owner credentials stored in BUSINESS_OWNER.
ALTER TABLE public."BUSINESS_OWNER" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'BUSINESS_OWNER'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public."BUSINESS_OWNER"', pol.policyname);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public."BUSINESS_OWNER" FROM anon, authenticated;
GRANT ALL ON TABLE public."BUSINESS_OWNER" TO postgres, service_role;
