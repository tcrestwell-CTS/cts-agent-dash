
-- Agent payout/banking info for commission payments
CREATE TABLE public.agent_payout_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_method TEXT NOT NULL DEFAULT 'ach' CHECK (payout_method IN ('ach','check','wire','zelle','paypal','venmo','other')),
  -- Payee / vendor identity
  payee_name TEXT,
  business_name TEXT,
  tax_id_last4 TEXT CHECK (tax_id_last4 IS NULL OR tax_id_last4 ~ '^[0-9]{4}$'),
  tax_form TEXT CHECK (tax_form IS NULL OR tax_form IN ('W9','W8BEN','none')),
  -- Mailing / remittance address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  email TEXT,
  phone TEXT,
  -- Banking (ACH / wire)
  bank_name TEXT,
  account_holder_name TEXT,
  account_type TEXT CHECK (account_type IS NULL OR account_type IN ('checking','savings')),
  routing_number TEXT CHECK (routing_number IS NULL OR routing_number ~ '^[0-9]{9}$'),
  account_number TEXT,
  account_number_last4 TEXT,
  -- Alt payout handles
  zelle_handle TEXT,
  paypal_email TEXT,
  venmo_handle TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-derive last4 of account number on write
CREATE OR REPLACE FUNCTION public.set_agent_payout_account_last4()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.account_number IS NOT NULL AND length(NEW.account_number) >= 4 THEN
    NEW.account_number_last4 := right(NEW.account_number, 4);
  ELSIF NEW.account_number IS NULL THEN
    NEW.account_number_last4 := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_payout_accounts_set_last4
BEFORE INSERT OR UPDATE ON public.agent_payout_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_agent_payout_account_last4();

CREATE TRIGGER agent_payout_accounts_updated_at
BEFORE UPDATE ON public.agent_payout_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.agent_payout_accounts ENABLE ROW LEVEL SECURITY;

-- Owners can fully manage their own payout info
CREATE POLICY "Agents view own payout account"
ON public.agent_payout_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Agents insert own payout account"
ON public.agent_payout_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Agents update own payout account"
ON public.agent_payout_accounts FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Agents delete own payout account"
ON public.agent_payout_accounts FOR DELETE
USING (auth.uid() = user_id);

-- Admins (only) can view/manage all payout accounts for QBO vendor sync
CREATE POLICY "Admins view all payout accounts"
ON public.agent_payout_accounts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update all payout accounts"
ON public.agent_payout_accounts FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete all payout accounts"
ON public.agent_payout_accounts FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Mapping of agent -> QBO vendor (for commission payouts)
CREATE TABLE public.qbo_agent_vendor_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  qbo_vendor_id TEXT NOT NULL,
  qbo_realm_id TEXT,
  vendor_display_name TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER qbo_agent_vendor_mappings_updated_at
BEFORE UPDATE ON public.qbo_agent_vendor_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.qbo_agent_vendor_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents view own qbo vendor mapping"
ON public.qbo_agent_vendor_mappings FOR SELECT
USING (auth.uid() = agent_user_id);

CREATE POLICY "Admins manage qbo agent vendor mappings - select"
ON public.qbo_agent_vendor_mappings FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage qbo agent vendor mappings - insert"
ON public.qbo_agent_vendor_mappings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage qbo agent vendor mappings - update"
ON public.qbo_agent_vendor_mappings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage qbo agent vendor mappings - delete"
ON public.qbo_agent_vendor_mappings FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));
