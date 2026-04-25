import threading
import uuid

import pytest
from rest_framework.test import APIClient

from payouts.models import BankAccount, LedgerEntry, LedgerEntryType, Merchant, Payout, PayoutStatus
from payouts.services import finalize_failure, merchant_balances_qs

pytestmark = pytest.mark.django_db(transaction=True)


def setup_merchant(balance: int = 10000):
    merchant = Merchant.objects.create(name="Test", email=f"{uuid.uuid4()}@test.com")
    bank = BankAccount.objects.create(merchant=merchant, account_name="Test", account_number_masked="XXXX1234", ifsc="HDFC0001234")
    LedgerEntry.objects.create(merchant=merchant, entry_type=LedgerEntryType.CREDIT, amount_paise=balance, reference_type="seed", reference_id=1)
    return merchant, bank


def test_idempotency_same_request_twice_returns_single_payout():
    merchant, bank = setup_merchant()
    key = str(uuid.uuid4())
    client = APIClient()
    payload = {"merchant_id": merchant.id, "amount_paise": 5000, "bank_account_id": bank.id}
    first = client.post("/api/v1/payouts", payload, format="json", HTTP_IDEMPOTENCY_KEY=key)
    second = client.post("/api/v1/payouts", payload, format="json", HTTP_IDEMPOTENCY_KEY=key)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.data == second.data
    assert Payout.objects.filter(merchant=merchant, idempotency_key=key).count() == 1


def test_state_machine_rejects_illegal_transition():
    merchant, bank = setup_merchant()
    payout = Payout.objects.create(merchant=merchant, bank_account=bank, amount_paise=100, status=PayoutStatus.PENDING, idempotency_key="a")
    payout.transition_to(PayoutStatus.PROCESSING)
    with pytest.raises(Exception):
        payout.transition_to(PayoutStatus.PENDING)


def test_refund_integrity_failure_releases_hold_once():
    merchant, bank = setup_merchant()
    payout = Payout.objects.create(merchant=merchant, bank_account=bank, amount_paise=1000, status=PayoutStatus.PROCESSING, idempotency_key="b")
    finalize_failure(payout, "failed_once")
    finalize_failure(payout, "failed_twice")
    assert LedgerEntry.objects.filter(reference_type="payout", reference_id=payout.id, entry_type=LedgerEntryType.REFUND).count() == 1


def test_concurrent_payouts_prevent_double_spend():
    merchant, bank = setup_merchant(balance=10000)
    results = []

    def issue_request():
        client = APIClient()
        response = client.post(
            "/api/v1/payouts",
            {"merchant_id": merchant.id, "amount_paise": 6000, "bank_account_id": bank.id},
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        results.append(response.status_code)

    t1 = threading.Thread(target=issue_request)
    t2 = threading.Thread(target=issue_request)
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    assert sorted(results) == [201, 409]
    assert merchant_balances_qs(merchant.id)["available_balance_paise"] >= 0
