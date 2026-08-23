from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0009_backfill_image_blob"),
    ]

    operations = [
        migrations.AddField(
            model_name="drawing",
            name="description",
            field=models.TextField(blank=True, default="", max_length=500, verbose_name="Описание"),
        ),
    ]
