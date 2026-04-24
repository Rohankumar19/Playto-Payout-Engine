import hashlib
import json
import random
from dataclasses import dataclass

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from .models import (
    BankAccount,
    IdempotencyRecord,
    LedgerEntry,
    LedgerEntryType,
    Merchant,
    Payout,
    PayoutStatus,
)


class InsufficientBalance(Exception):
    pass


class IdempotencyConflict(Exception):
    pass


@dataclass
class PayoutRequestResult:
    payout: Payout | None
    created: bool
    status_code: int
    response_body: dict


def request_hash(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def merchant_balances_qs(merchant_id: int) -> dict:
    agg = LedgerEntry.objects.filter(merchant_id=merchant_id).aggregate(
        credits=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.CREDIT)),
        debits=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.DEBIT)),
        holds=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.HOLD)),
        refunds=Sum("amount_paise", filter=Q(entry_type=LedgerEntryType.REFUND)),
    )
    credits = agg["credits"] or 0
    debits = agg["debits"] or 0
    holds = agg["holds"] or 0
    refunds = agg["refunds"] or 0
    held = max(holds - refunds, 0)
    return {
        "available_balance_paise": credits - debits - held,
        "held_balance_paise": held,
        "total_credited_paise": credits,
        "total_paid_out_paise": debits,
    }


def create_payout(*, merchant_id: int, amount_paise: int, bank_account_id: int, idempotency_key: str) -> PayoutRequestResult:
    payload = {"merchant_id": merchant_id, "amount_paise": amount_paise, "bank_account_id": bank_account_id}
    p_hash = request_hash(payload)
    with transaction.atomic():
        merchant = Merchant.objects.select_for_update().get(id=merchant_id)
        idem, created = IdempotencyRecord.objects.select_for_update().get_or_create(
            merchant=merchant,
            key=idempotency_key,
            defaults={"request_hash": p_hash, "state": "processing", "expires_at": timezone.now() + timezone.timedelta(hours=24)},
        )
        if not created:
            if idem.expires_at < timezone.now():
                idem.request_hash = p_hash
                idem.state = "processing"
                idem.response_body = {}
                idem.expires_at = timezone.now() + timezone.timedelta(hours=24)
                idem.save(update_fields=["request_hash", "state", "response_body", "expires_at"])
            elif idem.request_hash != p_hash:
                raise IdempotencyConflict("Idempotency-Key reused with different payload")
            elif idem.state == "completed":
                payout_id = idem.response_body.get("payout_id")
                if payout_id:
                    return PayoutRequestResult(
                        payout=Payout.objects.get(id=payout_id),
                        created=False,
                        status_code=idem.response_status_code,
                        response_body=idem.response_body,
                    )
                return PayoutRequestResult(
                    payout=None,
                    created=False,
                    status_code=idem.response_status_code,
                    response_body=idem.response_body,
                )
            else:
                raise IdempotencyConflict("Request with same Idempotency-Key is in progress")

        bank = BankAccount.objects.select_for_update().get(id=bank_account_id, merchant=merchant, is_active=True)
        balances = merchant_balances_qs(merchant.id)
        if balances["available_balance_paise"] < amount_paise:
            idem.state = "completed"
            idem.response_status_code = 409
            idem.response_body = {"detail": "insufficient_balance"}
            idem.save(update_fields=["state", "response_status_code", "response_body"])
            raise InsufficientBalance()

        payout = Payout.objects.create(
            merchant=merchant,
            bank_account=bank,
            amount_paise=amount_paise,
            status=PayoutStatus.PENDING,
            idempotency_key=idempotency_key,
        )
        LedgerEntry.objects.create(
            merchant=merchant,
            entry_type=LedgerEntryType.HOLD,
            amount_paise=amount_paise,
            reference_type="payout",
            reference_id=payout.id,
        )
        idem.state = "completed"
        idem.response_status_code = 201
        idem.response_body = {"payout_id": payout.id}
        idem.save(update_fields=["state", "response_status_code", "response_body"])
        return PayoutRequestResult(payout=payout, created=True, status_code=201, response_body={"payout_id": payout.id})


def finalize_success(payout: Payout) -> None:
    with transaction.atomic():
        payout = Payout.objects.select_for_update().get(id=payout.id)
        if payout.status == PayoutStatus.COMPLETED:
            return
        payout.transition_to(PayoutStatus.COMPLETED)
        payout.save(update_fields=["status", "updated_at"])
        LedgerEntry.objects.create(merchant=payout.merchant, entry_type=LedgerEntryType.DEBIT, amount_paise=payout.amount_paise, reference_type="payout", reference_id=payout.id)


def finalize_failure(payout: Payout, reason: str) -> None:
    with transaction.atomic():
        payout = Payout.objects.select_for_update().get(id=payout.id)
        if payout.status == PayoutStatus.FAILED or payout.hold_released:
            return
        payout.transition_to(PayoutStatus.FAILED)
        payout.failure_reason = reason
        payout.hold_released = True
        payout.save(update_fields=["status", "failure_reason", "hold_released", "updated_at"])
        LedgerEntry.objects.create(merchant=payout.merchant, entry_type=LedgerEntryType.REFUND, amount_paise=payout.amount_paise, reference_type="payout", reference_id=payout.id)


def simulate_outcome() -> str:
    n = random.random()
    if n < 0.7:
        return "success"
    if n < 0.9:
        return "failed"
    return "stuck"
