from django.core.exceptions import ValidationError
from django.db import models


class Merchant(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class BankAccount(models.Model):
    merchant = models.ForeignKey(Merchant, on_delete=models.CASCADE, related_name="bank_accounts")
    account_name = models.CharField(max_length=255)
    account_number_masked = models.CharField(max_length=32)
    ifsc = models.CharField(max_length=16)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class PayoutStatus(models.TextChoices):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Payout(models.Model):
    merchant = models.ForeignKey(Merchant, on_delete=models.CASCADE, related_name="payouts")
    bank_account = models.ForeignKey(BankAccount, on_delete=models.PROTECT, related_name="payouts")
    amount_paise = models.BigIntegerField()
    status = models.CharField(max_length=16, choices=PayoutStatus.choices, default=PayoutStatus.PENDING)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    idempotency_key = models.CharField(max_length=64)
    failure_reason = models.CharField(max_length=255, blank=True, default="")
    hold_released = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["merchant", "idempotency_key"], name="uniq_payout_idem_key")]

    def transition_to(self, next_status: str) -> None:
        allowed = {
            PayoutStatus.PENDING: {PayoutStatus.PROCESSING},
            PayoutStatus.PROCESSING: {PayoutStatus.COMPLETED, PayoutStatus.FAILED},
            PayoutStatus.COMPLETED: set(),
            PayoutStatus.FAILED: set(),
        }
        if next_status not in allowed[self.status]:
            raise ValidationError(f"Illegal transition: {self.status} -> {next_status}")
        self.status = next_status


class LedgerEntryType(models.TextChoices):
    CREDIT = "credit"
    DEBIT = "debit"
    HOLD = "hold"
    REFUND = "refund"


class LedgerEntry(models.Model):
    merchant = models.ForeignKey(Merchant, on_delete=models.CASCADE, related_name="ledger_entries")
    entry_type = models.CharField(max_length=16, choices=LedgerEntryType.choices)
    amount_paise = models.BigIntegerField()
    reference_type = models.CharField(max_length=64)
    reference_id = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)


class IdempotencyRecord(models.Model):
    merchant = models.ForeignKey(Merchant, on_delete=models.CASCADE, related_name="idempotency_records")
    key = models.CharField(max_length=64)
    request_hash = models.CharField(max_length=128)
    response_status_code = models.PositiveSmallIntegerField(default=201)
    response_body = models.JSONField(default=dict)
    state = models.CharField(max_length=16, default="processing")
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["merchant", "key"], name="uniq_idempotency_per_merchant")]
