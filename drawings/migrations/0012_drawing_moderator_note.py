from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("drawings", "0011_drawing_rejection_reason"),
    ]

    operations = [
        migrations.AddField(
            model_name="drawing",
            name="moderator_note",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Видна только модераторам",
                max_length=1000,
                verbose_name="Заметка модератора",
            ),
        ),
    ]
