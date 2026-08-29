from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from .models import Category, Drawing, Vote


def _day_list(days: int):
    today = timezone.localdate()
    return [today - timedelta(days=offset) for offset in range(days - 1, -1, -1)]


def build_organizer_stats(days: int = 14) -> dict:
    from .views import AGE_CATEGORY_FILTERS

    days = max(7, min(int(days), 60))
    tz = timezone.get_current_timezone()
    window_start = timezone.now() - timedelta(days=days - 1)

    total = Drawing.objects.count()
    published = Drawing.objects.filter(is_approved=True).count()
    pending = total - published
    votes_total = Drawing.objects.aggregate(total=Sum("votes"))["total"] or 0
    vote_events = Vote.objects.count()
    participants = (
        Drawing.objects.exclude(user_id=None)
        .values("user_id")
        .distinct()
        .count()
    )
    authors = Drawing.objects.values("author", "email").distinct().count()

    by_category = []
    for item in AGE_CATEGORY_FILTERS:
        qs = Drawing.objects.filter(age__gte=item["min_age"], age__lte=item["max_age"])
        cat_total = qs.count()
        cat_published = qs.filter(is_approved=True).count()
        cat_votes = qs.aggregate(total=Sum("votes"))["total"] or 0
        by_category.append(
            {
                "slug": item["slug"],
                "name": item["name"],
                "theme": item["theme"],
                "total": cat_total,
                "published": cat_published,
                "pending": cat_total - cat_published,
                "votes": cat_votes,
            }
        )

    day_keys = _day_list(days)
    submissions_map = {
        row["day"]: row["count"]
        for row in (
            Drawing.objects.filter(created_at__gte=window_start)
            .annotate(day=TruncDate("created_at", tzinfo=tz))
            .values("day")
            .annotate(count=Count("id"))
        )
        if row["day"] is not None
    }
    votes_map = {
        row["day"]: row["count"]
        for row in (
            Vote.objects.filter(created_at__gte=window_start)
            .annotate(day=TruncDate("created_at", tzinfo=tz))
            .values("day")
            .annotate(count=Count("id"))
        )
        if row["day"] is not None
    }

    activity = []
    max_activity = 1
    for day in day_keys:
        submissions = submissions_map.get(day, 0)
        votes = votes_map.get(day, 0)
        max_activity = max(max_activity, submissions, votes)
        activity.append(
            {
                "date": day,
                "label": day.strftime("%d.%m"),
                "submissions": submissions,
                "votes": votes,
            }
        )

    for row in activity:
        row["submissions_pct"] = round(100 * row["submissions"] / max_activity) if max_activity else 0
        row["votes_pct"] = round(100 * row["votes"] / max_activity) if max_activity else 0

    place_labels = ("1", "2", "3")
    top_by_category = []
    for item in AGE_CATEGORY_FILTERS:
        leaders = list(
            Drawing.objects.filter(
                is_approved=True,
                age__gte=item["min_age"],
                age__lte=item["max_age"],
            )
            .select_related("category")
            .order_by("-votes", "-created_at")[:3]
        )
        places = []
        for index, work in enumerate(leaders):
            places.append(
                {
                    "place": index + 1,
                    "place_label": place_labels[index],
                    "work": work,
                }
            )
        top_by_category.append(
            {
                "slug": item["slug"],
                "name": item["name"],
                "theme": item["theme"],
                "places": places,
            }
        )

    return {
        "days": days,
        "overview": {
            "total": total,
            "published": published,
            "pending": pending,
            "votes_total": votes_total,
            "vote_events": vote_events,
            "participants": participants,
            "authors": authors,
            "categories": Category.objects.count(),
        },
        "by_category": by_category,
        "activity": activity,
        "top_by_category": top_by_category,
        "window_start": day_keys[0] if day_keys else None,
        "window_end": day_keys[-1] if day_keys else None,
    }
