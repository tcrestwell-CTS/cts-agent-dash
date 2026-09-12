CREATE UNIQUE INDEX invitations_one_pending_per_email_uidx
ON public.invitations (lower(email))
WHERE status = 'pending';