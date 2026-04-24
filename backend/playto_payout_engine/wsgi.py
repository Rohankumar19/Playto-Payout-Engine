import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "playto_payout_engine.settings")
application = get_wsgi_application()
