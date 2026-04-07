# Astra P0 Plan: `Astra Spine`

## Mission
Build the foundational data spine so all screens read from one consistent ledger and update smoothly in near real-time.

## P0 Window
- Start: Week 1
- End: Week 3
- Output: production-ready MVP data foundation for Accounts, Transactions, Categories, Dashboard, and Recurring sync behavior

## Non-Goals (for P0)
- No full bank production connector rollout yet
- No advanced AI coaching UI yet
- No multi-provider investment reconciliation yet

## Workstreams

### W1 `Ledger Core`
Goal: define one canonical transaction and account model with strict idempotency.

Tasks:
- `P0-W1-T01` Add migration for `source_events` (raw incoming payload log + idempotency key).
- `P0-W1-T02` Add migration for `sync_runs` (status, latency, provider, error metadata).
- `P0-W1-T03` Add migration indexes for high-frequency reads:
  - `transactions(user_id, booked_at desc)`
  - `transactions(user_id, category_id, booked_at desc)`
  - `accounts(user_id, kind, last_synced_at desc)`
- `P0-W1-T04` Add DB constraints for robust dedupe:
  - keep `unique (user_id, provider, provider_transaction_id)`
  - add fallback dedupe fingerprint in metadata for manual/provider-missing cases
- `P0-W1-T05` Seed system categories and map parent-child hierarchy in DB (Food & Drink -> Groceries/Restaurant/Coffee, Shopping -> Clothing/Shops).

Definition of done:
- Every event has a traceable source row.
- Repeated sync of same payload never creates duplicate transactions.

---

### W2 `Ingestion Gateway`
Goal: all writes pass through a single normalization and upsert pipeline.

Tasks:
- `P0-W2-T01` Create `src/lib/ledgerIngestion.ts` with one entrypoint:
  - `ingestTransactions({ userId, source, events })`
- `P0-W2-T02` Move existing write paths to gateway:
  - manual add in `TransactionsScreen`
  - recurring paid/unpaid flow
  - external connector sync path
- `P0-W2-T03` Normalize payload fields before DB write:
  - merchant cleanup
  - signed amount handling
  - booked_at fallback logic
  - metadata confidence and inference fields
- `P0-W2-T04` Persist raw input in `source_events` then upsert canonical `transactions`.
- `P0-W2-T05` Add lightweight reconciliation pass:
  - merge same-day near-identical rows
  - preserve manual overrides

Definition of done:
- One ingestion code path for manual, recurring, and connector data.
- Failures are observable and replayable from `source_events`.

---

### W3 `Derived State Engine`
Goal: compute all screen aggregates from ledger, not hardcoded values.

Tasks:
- `P0-W3-T01` Add SQL views (or RPCs) for:
  - monthly spend vs budget
  - category budget utilization
  - recurring paid/left totals
  - dashboard review groups
- `P0-W3-T02` Add `src/lib/derived.ts` wrappers:
  - `loadDashboardSummary`
  - `loadCategorySummary`
  - `loadRecurringSummary`
- `P0-W3-T03` Ensure all values are computed from transactions + budgets + recurring items.
- `P0-W3-T04` Add fallback defaults only when DB has no rows.

Definition of done:
- Categories, Dashboard, and Recurring totals always match transactions.
- No stale static numbers after refresh.

---

### W4 `Cross-Screen Consistency`
Goal: updates in one screen reflect everywhere with smooth transitions.

Tasks:
- `P0-W4-T01` Add centralized app store hook: `src/lib/appStateStore.ts`.
- `P0-W4-T02` Replace local isolated refresh calls with event-driven refresh:
  - `transaction_added`
  - `transaction_updated`
  - `recurring_paid_toggled`
  - `budget_rebalanced`
- `P0-W4-T03` Use optimistic state patch + background reconcile for fast UI.
- `P0-W4-T04` Add throttled refresh to avoid jank during rapid updates.

Definition of done:
- Marking recurring paid updates:
  - Recurring card
  - Transactions list
  - Categories spend bars
  - Dashboard totals
  in one seamless flow.

---

### W5 `Performance and Smoothness`
Goal: remove lag and abrupt updates during list and chart interactions.

Tasks:
- `P0-W5-T01` Virtualize heavy lists and avoid full-screen re-renders.
- `P0-W5-T02` Animate numeric and progress transitions with short easing (150-220ms).
- `P0-W5-T03` Batch state updates with `startTransition` where appropriate.
- `P0-W5-T04` Add memoized selectors for derived aggregates.
- `P0-W5-T05` Add sync indicator states without blocking interaction.

Definition of done:
- Scrolling stays smooth on Pixel 7a.
- Category/progress changes animate softly, not abrupt jumps.

---

### W6 `Observability and QA`
Goal: detect bad sync behavior early and keep data reliable.

Tasks:
- `P0-W6-T01` Add ingestion logs with correlation IDs.
- `P0-W6-T02` Track metrics in `sync_runs`:
  - scanned_count
  - matched_count
  - inserted_count
  - failed_count
  - duration_ms
- `P0-W6-T03` Add QA checklist for consistency across screens.
- `P0-W6-T04` Add test fixtures for recurring -> transaction -> category propagation.

Definition of done:
- We can answer: "why is this transaction here?" with source + ingestion trace.
- Regression checks cover top user flows.

## Priority Order
1. `W1 Ledger Core`
2. `W2 Ingestion Gateway`
3. `W3 Derived State Engine`
4. `W4 Cross-Screen Consistency`
5. `W5 Performance and Smoothness`
6. `W6 Observability and QA`

## First Priority Implementation Pack (Start Now)
This is the exact first cut we should execute immediately.

### Pack A `Core Consistency`
- `A1` Create migration for `source_events` and `sync_runs`.
- `A2` Create `ingestTransactions` service and route manual + recurring writes through it.
- `A3` Build category summary query directly from transactions for current month.
- `A4` Wire Categories screen to DB-derived spend values (remove legacy static mismatch).
- `A5` Add post-write event so Dashboard/Categories/Transactions refresh together.

### Pack A Acceptance Criteria
- Adding a transaction appears in Transactions instantly.
- Categories totals and bars update from same write within one refresh cycle.
- Dashboard budget summary reflects the same change.
- Repeating the same provider event does not duplicate rows.

## Team Execution Rhythm
- Daily: 15-minute sync for blockers and schema/API decisions.
- Every 2 days: device validation pass on Pixel 7a.
- End of each workstream: demo and acceptance checklist signoff.

## Risks and Mitigation
- Risk: connector payload variation causes bad mapping.
  - Mitigation: keep raw payload in `source_events` and add replay utility.
- Risk: UI lag from broad state updates.
  - Mitigation: event-specific updates and selector-based rendering.
- Risk: category drift from weak merchant matching.
  - Mitigation: confidence metadata + manual override persistence.

## Exit Criteria for P0
- One source of truth for financial activity is live.
- All core screens are data-linked and consistent.
- Core write/read flows are smooth and testable.
- Foundation is ready for P1 connector expansion and AI agents.
