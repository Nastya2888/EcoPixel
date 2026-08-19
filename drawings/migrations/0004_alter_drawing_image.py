from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0003_category_theme_and_drawing_updates"),
    ]

    operations = [
        migrations.AlterField(
            model_name="drawing",
            name="image",
            field=models.FileField(upload_to="drawings/%Y/%m", verbose_name="Рисунок PNG"),
        ),
    ]
