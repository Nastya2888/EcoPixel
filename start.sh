#!/usr/bin/env bash
set -e

python - <<'PY'
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ecopixel.settings")
import django
django.setup()
from django.conf import settings

db = settings.DATABASES["default"]
print(
    f"DB engine: {db.get('ENGINE')} "
    f"host={db.get('HOST', 'local')} "
    f"name={db.get('NAME')}"
)
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput
gunicorn ecopixel.wsgi:application --bind 0.0.0.0:${PORT:-8000}
