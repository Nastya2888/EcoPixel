from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0007_create_default_moderator"),
    ]

    operations = [
        migrations.AddField(
            model_name="drawing",
            name="image_blob",
            field=models.BinaryField(blank=True, editable=False, null=True, verbose_name="PNG данные"),
        ),
        migrations.AddField(
            model_name="drawing",
            name="image_blob_content_type",
            field=models.CharField(blank=True, default="image/png", max_length=100, verbose_name="MIME"),
        ),
    ]
