# EcoPixel deployment checklist

## 1) Prepare environment variables

Copy `.env.example` to `.env` and set real values:

- `DJANGO_DEBUG=False`
- `DJANGO_SECRET_KEY` (long random string)
- `DJANGO_ALLOWED_HOSTS` (domain names)
- `DJANGO_CSRF_TRUSTED_ORIGINS` (https URLs for domains)
- `DATABASE_URL` (PostgreSQL connection string)

For Railway, set database variable as a reference:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}`

## 2) Install dependencies

```bash
pip install -r requirements.txt
```

## 3) Apply migrations and collect static files

```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

## 4) Validate production configuration

```bash
python manage.py check --deploy
python manage.py test
```

## 5) Start app server (example)

```bash
gunicorn ecopixel.wsgi:application --bind 0.0.0.0:8000
```

## Notes

- Serve media files (`/media/`) through your web server (Nginx/Caddy), not Django.
- Terminate HTTPS at reverse proxy and pass `X-Forwarded-Proto`.
- Keep `.env` private and never commit secrets.
