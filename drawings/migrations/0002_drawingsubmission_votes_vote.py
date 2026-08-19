from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="drawingsubmission",
            name="votes",
            field=models.PositiveIntegerField(default=0, verbose_name="Голоса"),
        ),
        migrations.CreateModel(
            name="Vote",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ip_address", models.GenericIPAddressField(verbose_name="IP адрес")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создано")),
                (
                    "drawing",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vote_entries",
                        to="drawings.drawingsubmission",
                        verbose_name="Работа",
                    ),
                ),
            ],
            options={
                "verbose_name": "Голос",
                "verbose_name_plural": "Голоса",
            },
        ),
        migrations.AddConstraint(
            model_name="vote",
            constraint=models.UniqueConstraint(
                fields=("drawing", "ip_address"),
                name="unique_vote_per_drawing_ip",
            ),
        ),
    ]
