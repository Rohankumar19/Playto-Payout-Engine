# Explainer

## 1. Ledger
Balance query used:
```python
agg = LedgerEntry.objects.filter(merchant_id=merchant_id).aggregate(
    credits=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.CREDIT)),
    debits=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.DEBIT)),
    holds=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.HOLD)),
    refunds=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.REFUND)),
)
```
Ledger gives immutable audit trail and deterministic recomputation of available/held balance.

## 2. Lock
Overdraft prevention code:
```python
with transaction.atomic():
    merchant = Merchant.objects.select_for_update().get(id=merchant_id)
```
Primitive used: PostgreSQL row-level lock via `SELECT ... FOR UPDATE`.

## 3. Idempotency
- Duplicate detection uses `IdempotencyRecord` with unique `(merchant, key)`.
- Simultaneous duplicates are serialized by `select_for_update()` on that row.
- Same key + same payload returns original stored response.
- Same key + different payload returns conflict.

## 4. State Machine
Illegal transitions are blocked in `Payout.transition_to()`, where only these are allowed:
- `pending -> processing`
- `processing -> completed`
- `processing -> failed`

## 5. AI Audit
Example bad generated code pattern:
- “Check available balance in Python and then create payout in separate write.”
Correction:
- wrapped payout creation + hold ledger write inside one DB transaction under row lock so concurrent requests cannot double spend.
