ALTER TABLE public.loan_applications
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN phone SET DEFAULT '';

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS alt_phone             TEXT,
  ADD COLUMN IF NOT EXISTS years_at_address      TEXT,
  ADD COLUMN IF NOT EXISTS housing_status        TEXT,
  ADD COLUMN IF NOT EXISTS employer_name         TEXT,
  ADD COLUMN IF NOT EXISTS job_title             TEXT,
  ADD COLUMN IF NOT EXISTS years_employed        TEXT,
  ADD COLUMN IF NOT EXISTS other_income          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS other_income_source   TEXT,
  ADD COLUMN IF NOT EXISTS down_payment          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS preferred_term_months INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_rent_mortgage NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_car_payment   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_other_debt    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS checking_account      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS savings_account       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bankruptcy_history    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bankruptcy_details    TEXT,
  ADD COLUMN IF NOT EXISTS reference1_name       TEXT,
  ADD COLUMN IF NOT EXISTS reference1_phone      TEXT,
  ADD COLUMN IF NOT EXISTS reference1_relation   TEXT,
  ADD COLUMN IF NOT EXISTS reference2_name       TEXT,
  ADD COLUMN IF NOT EXISTS reference2_phone      TEXT,
  ADD COLUMN IF NOT EXISTS reference2_relation   TEXT,
  ADD COLUMN IF NOT EXISTS autopay_method        TEXT,
  ADD COLUMN IF NOT EXISTS consent_autopay       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS autopay_esignature    TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS equifax_score         INTEGER,
  ADD COLUMN IF NOT EXISTS equifax_raw           JSONB,
  ADD COLUMN IF NOT EXISTS equifax_reasons       TEXT[],
  ADD COLUMN IF NOT EXISTS equifax_error         TEXT,
  ADD COLUMN IF NOT EXISTS decision              TEXT,
  ADD COLUMN IF NOT EXISTS badge_color           TEXT,
  ADD COLUMN IF NOT EXISTS client_message        TEXT,
  ADD COLUMN IF NOT EXISTS environment           TEXT DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS ip_address            TEXT,
  ADD COLUMN IF NOT EXISTS user_agent            TEXT,
  ADD COLUMN IF NOT EXISTS signed_at             TIMESTAMPTZ;

ALTER TABLE public.loan_applications
  DROP CONSTRAINT IF EXISTS loan_applications_decision_check;
ALTER TABLE public.loan_applications
  ADD CONSTRAINT loan_applications_decision_check
  CHECK (decision IN ('approved', 'review', 'declined') OR decision IS NULL);