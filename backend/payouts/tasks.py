from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .models import Payout, PayoutStatus
from .services import finalize_failure, finalize_success, simulate_outcome


@shared_task
def process_payout_task(payout_id: int) -> None:
    with transaction.atomic():
        payout = Payout.objects.select_for_update().get(id=payout_id)
        if payout.status not in {PayoutStatus.PENDING, PayoutStatus.PROCESSING}:
            return
        if payout.status == PayoutStatus.PENDING:
            payout.transition_to(PayoutStatus.PROCESSING)
            payout.save(update_fields=["status", "updated_at"])

    payout = Payout.objects.get(id=payout_id)
    outcome = simulate_outcome()
    if outcome == "success":
        finalize_success(payout)
    elif outcome == "failed":
        finalize_failure(payout, "processor_failed")


@shared_task
def retry_stuck_payouts_task() -> None:
    cutoff = timezone.now() - timezone.timedelta(seconds=30)
    for payout in Payout.objects.filter(status=PayoutStatus.PROCESSING, updated_at__lt=cutoff):
        with transaction.atomic():
            locked = Payout.objects.select_for_update().get(id=payout.id)
            if locked.status != PayoutStatus.PROCESSING:
                continue
            if locked.attempt_count >= 3:
                finalize_failure(locked, "max_retries_exceeded")
                continue
            retry_number = locked.attempt_count + 1
            delay_seconds = 30 * (2 ** (retry_number - 1))
            locked.attempt_count = retry_number
            locked.save(update_fields=["attempt_count", "updated_at"])
        process_payout_task.apply_async(args=[payout.id], countdown=delay_seconds)
