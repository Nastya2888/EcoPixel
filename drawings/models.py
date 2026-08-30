from django.core.validators import MaxValueValidator, MinValueValidator
from django.contrib.auth.models import User
from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)
    theme = models.CharField(max_length=120, blank=True, default="")
    slug = models.SlugField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Категория"
        verbose_name_plural = "Категории"

    def __str__(self) -> str:
        return self.name


class Drawing(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="drawings",
        null=True,
        blank=True,
        verbose_name="Пользователь",
    )
    title = models.CharField("Название", max_length=120, blank=True, default="Без названия")
    description = models.TextField("Описание", max_length=500, blank=True, default="")
    author = models.CharField("Автор", max_length=80)
    age = models.PositiveSmallIntegerField(
        "Возраст",
        validators=[MinValueValidator(1), MaxValueValidator(120)],
    )
    city = models.CharField("Город", max_length=80)
    email = models.EmailField("Email")
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="submissions",
        verbose_name="Категория",
    )
    image = models.FileField("Рисунок PNG", upload_to="drawings/%Y/%m")
    image_blob = models.BinaryField("PNG данные", null=True, blank=True, editable=False)
    image_blob_content_type = models.CharField("MIME", max_length=100, blank=True, default="image/png")
    is_approved = models.BooleanField("Одобрено", default=False)
    is_rejected = models.BooleanField("Отклонено", default=False)
    rejection_reason = models.TextField("Причина отклонения", max_length=500, blank=True, default="")
    moderator_note = models.TextField(
        "Заметка модератора",
        max_length=1000,
        blank=True,
        default="",
        help_text="Видна только модераторам",
    )
    votes = models.PositiveIntegerField("Голоса", default=0)
    created_at = models.DateTimeField("Создано", auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Работа"
        verbose_name_plural = "Работы"

    def __str__(self) -> str:
        return f"{self.title} - {self.author}"

    @property
    def author_name(self):
        return self.author


class Vote(models.Model):
    drawing = models.ForeignKey(
        Drawing,
        on_delete=models.CASCADE,
        related_name="vote_entries",
        verbose_name="Работа",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="votes",
        null=True,
        blank=True,
        verbose_name="Пользователь",
    )
    created_at = models.DateTimeField("Создано", auto_now_add=True)

    class Meta:
        verbose_name = "Голос"
        verbose_name_plural = "Голоса"
        constraints = [
            models.UniqueConstraint(
                fields=["drawing", "user"],
                name="unique_vote_per_drawing_user",
            )
        ]

    def __str__(self) -> str:
        return f"{self.drawing_id} - {self.user_id}"


class DrawingReport(models.Model):
    drawing = models.ForeignKey(
        Drawing,
        on_delete=models.CASCADE,
        related_name="reports",
        verbose_name="Работа",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="drawing_reports",
        verbose_name="Пользователь",
    )
    comment = models.TextField("Комментарий", max_length=500)
    is_resolved = models.BooleanField("Обработана", default=False)
    created_at = models.DateTimeField("Создано", auto_now_add=True)

    class Meta:
        verbose_name = "Жалоба"
        verbose_name_plural = "Жалобы"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["drawing", "user"],
                name="unique_report_per_drawing_user",
            )
        ]

    def __str__(self) -> str:
        return f"Жалоба #{self.pk} на работу {self.drawing_id}"
