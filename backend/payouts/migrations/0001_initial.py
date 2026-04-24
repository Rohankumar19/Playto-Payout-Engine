from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Merchant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="BankAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("account_name", models.CharField(max_length=255)),
                ("account_number_masked", models.CharField(max_length=32)),
                ("ifsc", models.CharField(max_length=16)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("merchant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="bank_accounts", to="payouts.merchant")),
            ],
        ),
        migrations.CreateModel(
            name="LedgerEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("entry_type", models.CharField(choices=[("credit", "credit"), ("debit", "debit"), ("hold", "hold"), ("refund", "refund")], max_length=16)),
                ("amount_paise", models.BigIntegerField()),
                ("reference_type", models.CharField(max_length=64)),
                ("reference_id", models.BigIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("merchant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ledger_entries", to="payouts.merchant")),
            ],
        ),
        migrations.CreateModel(
            name="IdempotencyRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(max_length=64)),
                ("request_hash", models.CharField(max_length=128)),
                ("response_status_code", models.PositiveSmallIntegerField(default=201)),
                ("response_body", models.JSONField(default=dict)),
                ("state", models.CharField(default="processing", max_length=16)),
                ("expires_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("merchant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="idempotency_records", to="payouts.merchant")),
            ],
        ),
        migrations.CreateModel(
            name="Payout",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount_paise", models.BigIntegerField()),
                ("status", models.CharField(choices=[("pending", "pending"), ("processing", "processing"), ("completed", "completed"), ("failed", "failed")], default="pending", max_length=16)),
                ("attempt_count", models.PositiveSmallIntegerField(default=0)),
                ("idempotency_key", models.CharField(max_length=64)),
                ("failure_reason", models.CharField(blank=True, default="", max_length=255)),
                ("hold_released", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("bank_account", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payouts", to="payouts.bankaccount")),
                ("merchant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payouts", to="payouts.merchant")),
            ],
        ),
        migrations.AddConstraint(model_name="idempotencyrecord", constraint=models.UniqueConstraint(fields=("merchant", "key"), name="uniq_idempotency_per_merchant")),
        migrations.AddConstraint(model_name="payout", constraint=models.UniqueConstraint(fields=("merchant", "idempotency_key"), name="uniq_payout_idem_key")),
    ]
