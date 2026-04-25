from django.core.management.base import BaseCommand
from payouts.models import BankAccount, LedgerEntry, LedgerEntryType, Merchant

class Command(BaseCommand):
    help = 'Seeds the database with initial merchants and balances'

    def handle(self, *args, **kwargs):
        if Merchant.objects.exists():
            self.stdout.write(self.style.WARNING('Database already seeded. Skipping.'))
            return

        m1 = Merchant.objects.create(name="Acme Agency", email="acme@example.com")
        m2 = Merchant.objects.create(name="Pixel Freelance", email="pixel@example.com")
        m3 = Merchant.objects.create(name="Global SaaS", email="saas@example.com")
        
        for merchant in [m1, m2, m3]:
            BankAccount.objects.create(merchant=merchant, account_name=merchant.name, account_number_masked="XXXXXX1234", ifsc="HDFC0001234")
        
        LedgerEntry.objects.bulk_create([
            LedgerEntry(merchant=m1, entry_type=LedgerEntryType.CREDIT, amount_paise=250000, reference_type="seed", reference_id=1),
            LedgerEntry(merchant=m1, entry_type=LedgerEntryType.CREDIT, amount_paise=120000, reference_type="seed", reference_id=2),
            LedgerEntry(merchant=m2, entry_type=LedgerEntryType.CREDIT, amount_paise=50000, reference_type="seed", reference_id=3),
            LedgerEntry(merchant=m3, entry_type=LedgerEntryType.CREDIT, amount_paise=99000, reference_type="seed", reference_id=4),
        ])
        
        self.stdout.write(self.style.SUCCESS('Successfully seeded database with 3 merchants and initial credits.'))
