from django.contrib import admin

from .models import Category, Drawing, Vote
from .utils import send_notification


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "theme", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Drawing)
class DrawingAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "author",
        "user",
        "age",
        "city",
        "category",
        "votes",
        "is_approved",
        "is_rejected",
        "created_at",
    )
    list_filter = ("category", "is_approved", "is_rejected", "created_at")
    search_fields = ("title", "author", "city", "email", "description", "rejection_reason")

    def save_model(self, request, obj, form, change):
        was_approved = False
        was_rejected = False
        if change:
            previous = Drawing.objects.filter(pk=obj.pk).values("is_approved", "is_rejected").first()
            was_approved = bool(previous and previous["is_approved"])
            was_rejected = bool(previous and previous["is_rejected"])

        if obj.is_approved:
            obj.is_rejected = False
            obj.rejection_reason = ""

        super().save_model(request, obj, form, change)

        if obj.is_approved and not was_approved:
            send_notification(obj, "approved", request=request)
        elif obj.is_rejected and not was_rejected and not obj.is_approved:
            send_notification(obj, "rejected", request=request)


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = ("drawing", "user", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "drawing__title")
