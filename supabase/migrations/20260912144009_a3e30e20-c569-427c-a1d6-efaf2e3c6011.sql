-- email_logs upserts on idempotency_key but no unique constraint existed,
-- so every send failed to log (42P10) and the email history stayed empty.
delete from public.email_logs a
using public.email_logs b
where a.idempotency_key is not null
  and a.idempotency_key = b.idempotency_key
  and a.ctid > b.ctid;

create unique index if not exists email_logs_idempotency_key_key
  on public.email_logs (idempotency_key)
  where idempotency_key is not null;