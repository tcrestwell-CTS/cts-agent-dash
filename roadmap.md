# Roadmap
- [x] Fix supplier-paid booking guessing in the page, payment trigger, and QBO resolver; explicit same-trip link required, actual amounts applied atomically, QBO resolver deployed, regression checks passed without moving real money.
- [x] Fix concurrent QBO renewal disconnections; deployed three functions, 23 tests passed, signed-in July net $2,565.55 and October net $238.96 verified; connection active.
- [x] Wire paid client-payment inserts and updates to automatic QBO invoice/payment posting; Tara invoice 2161 and payments 2162/2163 verified, replay skipped, no new charges.
- [x] Verify real Carnival supplier payment ($1,004.76, bill 2141) in QuickBooks and the signed-in app; refresh bills/payment cache without reposting.
- [x] Compare October client funds: app receipts $3,137.97; actual supplier payments $2,736.74; app additionally treats Nattaya's $123.80 advisor payout as supplier cash-out. QuickBooks October accrual net $238.96 is not app cash-flow net $277.43.
- [x] Replay Jessica's existing $835.76 paid payment through deployed sync; verify duplicate-safe skip against QBO payment 2145 (no new charge or duplicate).
- [x] Use QuickBooks P&L in the app, including COGS and other income/expenses; three tests passed and signed-in October row verified at $562.76 income, $323.80 expenses, $238.96 net.
- [x] Reconcile Tara's $491.53 and $514.67 receipts against invoice INV-2026-00124 in QuickBooks Client Funds; October P&L unchanged at $238.96 net. Older invoice/cancelled balances are outside this payment-automation task.
- [x] Add/deploy group advisor notifications and logged client copies; tests passed and Tim's saved Hawaii copies accepted for sending.
- [ ] Confirm inbox arrival: blocked by unavailable delivery-status access and recipient confirmation; Lovable sender-domain setup also needs verification in More → Emails.
- [x] Update Hawaii to November 20–27 only, cabin prices, and verify the page.


## Guided trip flow (approved 2026-09-27)
- [x] 1. Publish gate blocks (required vs recommended, admin override w/ reason, server trigger)
- [x] 2. Clone trip copies itinerary days/items
- [x] 3. Step-by-step Trip Builder (alongside New Trip)
- [x] 4. Per-item AI actions in itinerary builder
- [x] 5. Autosave itinerary edits + remove full refetch per edit
- [x] 6. Unified copy engine (sub-trips + templates), tested on real group-trip copies before switch

## QBO review follow-ups (2026-10-30)
- [x] Apply one payment-consistency migration copy after Tim confirms downloaded database export; 0003 applied through the managed migrator.
- [x] Deploy qbo-sync-trigger, stripe-webhook, and stripe-issuing-webhook after the migration; 20 accounting tests passed.
- [x] Post cash/check paid installments with no method
- [x] Check QuickBooks for an existing trip invoice before auto-creating one
- [x] Keep new client money on parent Client Funds (older Client Deposit entries left as-is)
- [x] Remove 500-row cap on sync status list
- [ ] Refunds to QuickBooks
- [ ] Partially paid supplier bills
- [ ] Virtual-card supplier charges

## Claire cabin prices
- [x] Update three total-cabin fares and Essential Fare label; six pricing tests passed, preview table and signup labels verified, functions deployed. Publication of frontend labels remains user-controlled.
