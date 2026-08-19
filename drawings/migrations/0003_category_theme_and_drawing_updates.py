from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0002_drawingsubmission_votes_vote"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="theme",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.RenameModel(
            old_name="DrawingSubmission",
            new_name="Drawing",
        ),
        migrations.RenameField(
            model_name="drawing",
            old_name="name",
            new_name="author",
        ),
        migrations.AddField(
            model_name="drawing",
            name="is_approved",
            field=models.BooleanField(default=False, verbose_name="Одобрено"),
        ),
        migrations.AddField(
            model_name="drawing",
            name="title",
            field=models.CharField(blank=True, default="Без названия", max_length=120, verbose_name="Название"),
        ),
    ]
