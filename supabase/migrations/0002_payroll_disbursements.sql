-- Migration 0002: Payroll Disbursements, Partial Payments & Challan Cancellation
ALTER TABLE public.labour_payroll
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0);

CREATE TABLE IF NOT EXISTS public.labour_payroll_disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id uuid NOT NULL REFERENCES public.labour_payroll(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_mode text NOT NULL DEFAULT 'Cash' CHECK (payment_mode IN ('Cash','UPI','Bank Transfer','Cheque','Other')),
  disbursed_at timestamptz NOT NULL DEFAULT now(),
  reference_notes text,
  disbursed_by uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_disbursements_payroll ON public.labour_payroll_disbursements(payroll_id);
ALTER TABLE public.labour_payroll_disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read disbursements" ON public.labour_payroll_disbursements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY "Admins add disbursements" ON public.labour_payroll_disbursements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

GRANT SELECT, INSERT ON public.labour_payroll_disbursements TO authenticated;
GRANT ALL ON public.labour_payroll_disbursements TO service_role;

CREATE OR REPLACE FUNCTION public.fn_apply_payroll_disbursement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_net numeric; v_paid numeric;
BEGIN
  SELECT net_paid INTO v_net FROM public.labour_payroll WHERE id = NEW.payroll_id FOR UPDATE;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.labour_payroll_disbursements WHERE payroll_id = NEW.payroll_id;
  IF v_paid > v_net THEN
    RAISE EXCEPTION 'Total payments % exceed net payable %', v_paid, v_net;
  END IF;
  UPDATE public.labour_payroll
    SET amount_paid = v_paid,
        status = CASE WHEN v_paid >= v_net THEN 'Paid' ELSE 'Partially Paid' END
    WHERE id = NEW.payroll_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_apply_payroll_disbursement ON public.labour_payroll_disbursements;
CREATE TRIGGER trg_apply_payroll_disbursement
AFTER INSERT ON public.labour_payroll_disbursements
FOR EACH ROW EXECUTE FUNCTION public.fn_apply_payroll_disbursement();

-- Alert sent timestamp for tentative completion scheduler
ALTER TABLE public.production_allocations
  ADD COLUMN IF NOT EXISTS completion_alert_sent_at timestamptz;
