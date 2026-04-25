# EXPLAINER — Playto Payout Engine

## 1. The Ledger

**Balance query (DB aggregation, not a Python sum over all rows in memory).** Implemented in `backend/payouts/services.py` as `merchant_balances_qs`:

```python
agg = LedgerEntry.objects.filter(merchant_id=merchant_id).aggregate(
    credits=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.CREDIT)),
    debits=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.DEBIT)),
    holds=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.HOLD)),
    refunds=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.REFUND)),
)
# credits - debits - (holds - refunds)  =>  available; max(holds-refunds,0) => held
```

**Why credits + debits + holds + refunds?** Real payout systems do not only “debit on send”. They must **reserve** funds while a payout is in flight (`HOLD`), then either **finalize** as a completed payout (`DEBIT` when the hold is effectively consumed) or **release** the reservation (`REFUND` against the hold). That gives a full **append-only audit trail**: every money movement is an immutable row, and “balance” is always explainable from history.

## 2. The Lock

**Exact overdraft / double-spend protection** is in `create_payout` in `backend/payouts/services.py`:

```python
with transaction.atomic():
    merchant = Merchant.objects.select_for_update().get(id=merchant_id)
    idem, created = IdempotencyRecord.objects.select_for_update().get_or_create(...)
    ...
    bank = BankAccount.objects.select_for_update().get(id=bank_account_id, merchant=merchant, is_active=True)
    balances = merchant_balances_qs(merchant.id)
    if balances["available_balance_paise"] < amount_paise:
        ...
```

**Database primitive:** PostgreSQL (production) `SELECT ... FOR UPDATE` — **row-level lock** inside a **single database transaction** (`transaction.atomic()`). That serializes competing payout requests for the same merchant+idempotency state so two threads cannot both pass a balance check and insert conflicting holds.

## 3. Idempotency

**How we know we have seen a key before:** `IdempotencyRecord` has a **unique constraint** on `(merchant, key)` (`backend/payouts/models.py`). The request body is hashed (`request_hash`); the **saved HTTP status + body** are stored on the idempotency record when the request finishes.

**Two requests with the same key, second arrives while the first is still in flight:** both enter `transaction.atomic()`. The first `get_or_create` inserts the idempotency row; the second blocks on `select_for_update()` until the first transaction commits, then sees `state` / `request_hash` and either **replays the stored response** (same hash, completed) or returns a controlled conflict if the first request is still `processing` (in-flight retry semantics).

**Important:** for submission and production, run **true async Celery** (not `CELERY_TASK_ALWAYS_EAGER`) so the “background processor” requirement matches the spec.

## 4. The State Machine

**Where `failed -> completed` (and all illegal moves) is blocked:** `Payout.transition_to` in `backend/payouts/models.py`:

```python
allowed = {
    PayoutStatus.PENDING: {PayoutStatus.PROCESSING},
    PayoutStatus.PROCESSING: {PayoutStatus.COMPLETED, PayoutStatus.FAILED},
    PayoutStatus.COMPLETED: set(),
    PayoutStatus.FAILED: set(),
}
if next_status not in allowed[self.status]:
    raise ValidationError(f"Illegal transition: {self.status} -> {next_status}")
```

So **`failed -> completed` is impossible** because `FAILED` maps to an empty set of next states.

**Atomic failure + refund:** `finalize_failure` updates payout + writes `REFUND` ledger in one `transaction.atomic()` block (`backend/payouts/services.py`).

## 5. The AI Audit (concrete)

**Bad AI pattern I rejected:** “fetch balance in Python from a `Merchant.balance` field, subtract in Python, then `save()`.” That fails under concurrency: two requests can read the same balance and both pass.

**What I shipped instead:** no mutable `balance` field; **hold** rows + **one transaction** with **`select_for_update` on the merchant** before evaluating aggregated ledger balances and inserting the `HOLD` entry. The database lock is the real primitive; Python is not the source of truth for concurrency.

**Second bad pattern:** returning duplicate payouts when clients retry the same `Idempotency-Key` after a network timeout.

**Fix:** DB-backed `IdempotencyRecord` with `(merchant, key)` uniqueness + `select_for_update` on that row + persisting a response snapshot, so the second call returns the **same** success payload and status (see tests asserting identical JSON on replay).
