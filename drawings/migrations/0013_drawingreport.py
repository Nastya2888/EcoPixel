from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("drawings", "0012_drawing_moderator_note"),
    ]

    operations = [
        migrations.CreateModel(
            name="DrawingReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("comment", models.TextField(max_length=500, verbose_name="Комментарий")),
                ("is_resolved", models.BooleanField(default=False, verbose_name="Обработана")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создано")),
                (
                    "drawing",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reports",
                        to="drawings.drawing",
                        verbose_name="Работа",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="drawing_reports",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Пользователь",
                    ),
                ),
            ],
            options={
                "verbose_name": "Жалоба",
                "verbose_name_plural": "Жалобы",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="drawingreport",
            constraint=models.UniqueConstraint(
                fields=("drawing", "user"),
                name="unique_report_per_drawing_user",
            ),
        ),
    ]
