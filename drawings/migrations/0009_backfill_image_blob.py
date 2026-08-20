from django.db import migrations


def backfill_image_blob(apps, schema_editor):
    Drawing = apps.get_model("drawings", "Drawing")
    from django.core.files.storage import default_storage

    queryset = Drawing.objects.filter(image_blob__isnull=True).exclude(image="")
    for drawing in queryset.iterator():
        image_name = getattr(drawing.image, "name", "")
        if not image_name:
            continue
        if not default_storage.exists(image_name):
            continue
        with default_storage.open(image_name, "rb") as image_file:
            image_bytes = image_file.read()
        if not image_bytes:
            continue
        drawing.image_blob = image_bytes
        if not drawing.image_blob_content_type:
            drawing.image_blob_content_type = "image/png"
        drawing.save(update_fields=["image_blob", "image_blob_content_type"])


class Migration(migrations.Migration):
    dependencies = [
        ("drawings", "0008_drawing_image_blob"),
    ]

    operations = [
        migrations.RunPython(backfill_image_blob, migrations.RunPython.noop),
    ]
