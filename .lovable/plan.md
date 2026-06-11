## Fix QBO sync link on Bookkeeper Dashboard

In `src/pages/bookkeeper/BookkeeperDashboard.tsx`, the "failed QBO syncs" alert's Review button currently links to `/bookkeeper/qbo-logs`. Update it to link to `/qbo-payment-sync` so bookkeepers land on the actionable per-payment sync view (with retry) instead of the read-only log list.

Single one-line change: `<Link to="/bookkeeper/qbo-logs">` → `<Link to="/qbo-payment-sync">`.