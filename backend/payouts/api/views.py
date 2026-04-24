from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from payouts.models import BankAccount, LedgerEntry, LedgerEntryType, Merchant, Payout
from payouts.serializers import CreatePayoutSerializer, LedgerEntrySerializer, MerchantSerializer, PayoutSerializer
from payouts.services import IdempotencyConflict, InsufficientBalance, create_payout, merchant_balances_qs
from payouts.tasks import process_payout_task


class MerchantListView(APIView):
    def get(self, request):
        return Response(MerchantSerializer(Merchant.objects.all(), many=True).data)


class MerchantDashboardView(APIView):
    def get(self, request, merchant_id: int):
        return Response(merchant_balances_qs(merchant_id))


class MerchantLedgerView(APIView):
    def get(self, request, merchant_id: int):
        rows = LedgerEntry.objects.filter(merchant_id=merchant_id).order_by("-created_at")[:50]
        return Response(LedgerEntrySerializer(rows, many=True).data)


class PayoutListCreateView(APIView):
    def get(self, request):
        merchant_id = request.query_params.get("merchant_id")
        payouts = Payout.objects.all().order_by("-created_at")
        if merchant_id:
            payouts = payouts.filter(merchant_id=merchant_id)
        return Response(PayoutSerializer(payouts, many=True).data)

    def post(self, request):
        idem_key = request.headers.get("Idempotency-Key")
        if not idem_key:
            return Response({"detail": "Idempotency-Key header required"}, status=status.HTTP_400_BAD_REQUEST)
        serializer = CreatePayoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = create_payout(idempotency_key=idem_key, **serializer.validated_data)
        except InsufficientBalance:
            return Response({"detail": "insufficient_balance"}, status=status.HTTP_409_CONFLICT)
        except IdempotencyConflict as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)

        if result.payout:
            process_payout_task.delay(result.payout.id)
            return Response(PayoutSerializer(result.payout).data, status=result.status_code)
        return Response(result.response_body, status=result.status_code)


class PayoutDetailView(APIView):
    def get(self, request, payout_id: int):
        return Response(PayoutSerializer(Payout.objects.get(id=payout_id)).data)


class SeedView(APIView):
    def post(self, request):
        if Merchant.objects.exists():
            return Response({"detail": "already seeded"})
        m1 = Merchant.objects.create(name="Acme Agency", email="acme@example.com")
        m2 = Merchant.objects.create(name="Pixel Freelance", email="pixel@example.com")
        m3 = Merchant.objects.create(name="Global SaaS", email="saas@example.com")
        for merchant in [m1, m2, m3]:
            BankAccount.objects.create(merchant=merchant, account_name=merchant.name, account_number_masked="XXXXXX1234", ifsc="HDFC0001234")
        LedgerEntry.objects.bulk_create(
            [
                LedgerEntry(merchant=m1, entry_type=LedgerEntryType.CREDIT, amount_paise=250000, reference_type="seed", reference_id=1),
                LedgerEntry(merchant=m1, entry_type=LedgerEntryType.CREDIT, amount_paise=120000, reference_type="seed", reference_id=2),
                LedgerEntry(merchant=m2, entry_type=LedgerEntryType.CREDIT, amount_paise=50000, reference_type="seed", reference_id=3),
                LedgerEntry(merchant=m3, entry_type=LedgerEntryType.CREDIT, amount_paise=99000, reference_type="seed", reference_id=4),
            ]
        )
        return Response({"detail": "seeded"}, status=status.HTTP_201_CREATED)
