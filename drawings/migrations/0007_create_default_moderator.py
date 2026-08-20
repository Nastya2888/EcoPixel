from django.db import migrations


MODERATOR_USERNAME = "moderator@ecopixel.ru"
MODERATOR_EMAIL = "moderator@ecopixel.ru"
MODERATOR_PASSWORD_HASH = (
    "pbkdf2_sha256$1500000$xsIVpsEk6p6BBNhuuAZGOW$"
    "kQv8YXlbgYCZZnZlH3Rx/0Yqd2aEXODkXwXKAEW/jbE="
)


def create_or_update_moderator(apps, schema_editor):
    User = apps.get_model("auth", "User")
    user, _ = User.objects.get_or_create(
        username=MODERATOR_USERNAME,
        defaults={
            "email": MODERATOR_EMAIL,
            "password": MODERATOR_PASSWORD_HASH,
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
        },
    )

    update_fields = []
    if user.email != MODERATOR_EMAIL:
        user.email = MODERATOR_EMAIL
        update_fields.append("email")
    if user.password != MODERATOR_PASSWORD_HASH:
        user.password = MODERATOR_PASSWORD_HASH
        update_fields.append("password")
    if not user.is_staff:
        user.is_staff = True
        update_fields.append("is_staff")
    if not user.is_superuser:
        user.is_superuser = True
        update_fields.append("is_superuser")
    if not user.is_active:
        user.is_active = True
        update_fields.append("is_active")

    if update_fields:
        user.save(update_fields=update_fields)


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0006_user_accounts"),
    ]

    operations = [
        migrations.RunPython(create_or_update_moderator, migrations.RunPython.noop),
    ]
