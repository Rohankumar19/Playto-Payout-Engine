from django.urls import path

from .views import MerchantDashboardView, MerchantLedgerView, MerchantListView, PayoutDetailView, PayoutListCreateView, SeedView

urlpatterns = [
    path("merchants/", MerchantListView.as_view()),
    path("merchants/<int:merchant_id>/dashboard", MerchantDashboardView.as_view()),
    path("merchants/<int:merchant_id>/ledger", MerchantLedgerView.as_view()),
    path("payouts", PayoutListCreateView.as_view()),
    path("payouts/<int:payout_id>", PayoutDetailView.as_view()),
    path("seed", SeedView.as_view()),
]
