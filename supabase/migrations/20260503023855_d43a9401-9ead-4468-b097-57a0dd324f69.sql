
DO $$ BEGIN
  CREATE TYPE public.check_status AS ENUM ('outstanding','cleared','voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_number text NOT NULL,
  payee text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  memo text,
  status public.check_status NOT NULL DEFAULT 'outstanding',
  cleared_date date,
  project_id uuid,
  account_id uuid,
  category public.expense_category,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS open_all_checks ON public.checks;
CREATE POLICY open_all_checks ON public.checks FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_checks_updated_at ON public.checks;
CREATE TRIGGER trg_checks_updated_at
  BEFORE UPDATE ON public.checks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_checks_date ON public.checks(date DESC);
CREATE INDEX IF NOT EXISTS idx_checks_payee ON public.checks(payee);
CREATE INDEX IF NOT EXISTS idx_checks_status ON public.checks(status);

ALTER TABLE public.checks REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.checks;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
