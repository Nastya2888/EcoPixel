from pathlib import Path
from uuid import uuid4
from html import escape
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import json

from django.http import Http404, HttpResponse, JsonResponse
from django.db import transaction
from django.db.models import Q, Sum
from django.core.paginator import Paginator
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_GET, require_POST

from .models import Category, Drawing, Vote
from .contest import are_results_published, is_submission_open, is_voting_open
from .translations import EN, current_language_code, translate
from .utils import send_notification


def _can_view_moderation_content(request) -> bool:
    return bool(request.user.is_authenticated and request.user.is_staff)


def _normalize_search_query(raw_value: str, max_length: int = 80) -> str:
    return (raw_value or "").strip()[:max_length]


def _apply_author_city_search(queryset, search_query: str):
    if not search_query:
        return queryset
    return queryset.filter(
        Q(title__icontains=search_query)
        | Q(author__icontains=search_query)
        | Q(city__icontains=search_query)
    )


def _is_own_drawing(drawing, user) -> bool:
    return bool(user.is_authenticated and drawing.user_id == user.id)


def _can_view_drawing(request, drawing) -> bool:
    if drawing.is_approved:
        return True
    if _can_view_moderation_content(request):
        return True
    return _is_own_drawing(drawing, request.user)


def _safe_redirect_url(request, fallback_name="profile"):
    candidate = (request.POST.get("next") or request.GET.get("next") or "").strip()
    if candidate and url_has_allowed_host_and_scheme(
        candidate,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        return candidate
    return reverse(fallback_name)


def _redirect_with_status(url, moderation_status):
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["moderation"] = moderation_status
    return redirect(
        urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    )


def _build_stored_image_name(original_name: str) -> str:
    safe_name = Path(original_name or "drawing.png").name
    ext = Path(safe_name).suffix.lower() or ".png"
    return f"drawing-{uuid4().hex}{ext}"


def _missing_image_svg(title: str) -> str:
    safe_title = escape(title or "Работа")
    return f"""
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F0FDF4"/>
      <stop offset="100%" stop-color="#E4EFE8"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#g)"/>
  <rect x="48" y="48" width="544" height="544" rx="28" fill="#FFFFFF" stroke="#DCE8E0" stroke-width="6"/>
  <g transform="translate(320 250)">
    <rect x="-64" y="-64" width="128" height="128" rx="18" fill="#EFF8F2" stroke="#2ECC71" stroke-width="8"/>
    <path d="M-34 30l24-26 20 18 20-22 24 30" fill="none" stroke="#1B4332" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="-18" cy="-18" r="10" fill="#2ECC71"/>
  </g>
  <text x="320" y="410" text-anchor="middle" fill="#1B4332" font-size="30" font-family="Arial, sans-serif" font-weight="700">
    Изображение недоступно
  </text>
  <text x="320" y="450" text-anchor="middle" fill="#5C7166" font-size="22" font-family="Arial, sans-serif">
    {safe_title}
  </text>
</svg>
""".strip()


AGE_CATEGORY_FILTERS = (
    {
        "slug": "age-6-9",
        "name": "6–9 лет",
        "min_age": 6,
        "max_age": 9,
        "theme": "Мой чистый дом",
        "description": "Сортировка мусора, кормление птиц, экономия воды и света.",
    },
    {
        "slug": "age-10-13",
        "name": "10–13 лет",
        "min_age": 10,
        "max_age": 13,
        "theme": "Сохраним леса",
        "description": "Посадка деревьев, защита природы, субботники и помощь животным.",
    },
    {
        "slug": "age-14-17",
        "name": "14–17 лет",
        "min_age": 14,
        "max_age": 17,
        "theme": "Эко-город будущего",
        "description": "Эко-технологии, солнечные батареи, электротранспорт и переработка.",
    },
    {
        "slug": "age-18-25",
        "name": "18–25 лет",
        "min_age": 18,
        "max_age": 25,
        "theme": "Эко-инициативы сообщества",
        "description": "Волонтерские проекты, экопросвещение и устойчивые решения для города.",
    },
)


def _get_category_winners():
    categories = Category.objects.all()
    winners = []
    for category in categories:
        winner = (
            Drawing.objects.filter(category=category, is_approved=True)
            .order_by("-votes", "-created_at")
            .first()
        )
        winners.append({"category": category, "winner": winner})
    return winners


@require_GET
def index(request):
    home_categories = []
    for category in AGE_CATEGORY_FILTERS:
        drawing_count = Drawing.objects.filter(
            age__gte=category["min_age"],
            age__lte=category["max_age"],
        ).count()
        home_categories.append({**category, "drawing_count": drawing_count})

    latest_drawings = Drawing.objects.filter(is_approved=True).order_by("-created_at")[:6]
    stats = {
        "participants_total": Drawing.objects.count(),
        "approved_total": Drawing.objects.filter(is_approved=True).count(),
        "votes_total": Drawing.objects.aggregate(total=Sum("votes"))["total"] or 0,
    }
    return render(
        request,
        "drawings/index.html",
        {
            "home_categories": home_categories,
            "latest_drawings": latest_drawings,
            "stats": stats,
        },
    )


@require_GET
def gallery(request):
    age_categories = list(AGE_CATEGORY_FILTERS)
    category_by_slug = {item["slug"]: item for item in age_categories}
    current_slug = request.GET.get("category", "").strip()
    sort_mode = request.GET.get("sort", "popular").strip()
    search_query = _normalize_search_query(request.GET.get("q", ""))
    drawings = Drawing.objects.select_related("category").all()
    if not _can_view_moderation_content(request):
        drawings = drawings.filter(is_approved=True)
    selected_age_category = category_by_slug.get(current_slug)
    if selected_age_category:
        drawings = drawings.filter(
            age__gte=selected_age_category["min_age"],
            age__lte=selected_age_category["max_age"],
        )
    drawings = _apply_author_city_search(drawings, search_query)

    if sort_mode == "new":
        drawings = drawings.order_by("-created_at")
    else:
        sort_mode = "popular"
        drawings = drawings.order_by("-votes", "-created_at")

    paginator = Paginator(drawings, 12)
    page_obj = paginator.get_page(request.GET.get("page"))
    voted_ids = []
    if request.user.is_authenticated:
        voted_ids = list(
            Vote.objects.filter(user=request.user).values_list("drawing_id", flat=True)
        )

    return render(
        request,
        "drawings/gallery.html",
        {
            "age_categories": age_categories,
            "selected_age_category": selected_age_category,
            "sort_mode": sort_mode,
            "search_query": search_query,
            "page_obj": page_obj,
            "voted_ids": voted_ids,
            "voting_open": is_voting_open(),
            "results_published": are_results_published(),
        },
    )


@require_GET
def work_detail(request, pk):
    work = get_object_or_404(Drawing, pk=pk)
    if not _can_view_drawing(request, work):
        raise Http404("Работа недоступна.")
    has_voted = False
    is_own_work = False
    if request.user.is_authenticated:
        has_voted = Vote.objects.filter(drawing=work, user=request.user).exists()
        is_own_work = _is_own_drawing(work, request.user)
    og_image_url = request.build_absolute_uri(reverse("drawing_image", args=[work.pk]))
    return render(
        request,
        "drawings/work_detail.html",
        {
            "work": work,
            "has_voted": has_voted,
            "is_own_work": is_own_work,
            "is_moderator": _can_view_moderation_content(request),
            "og_image_url": og_image_url,
            "voting_open": is_voting_open(),
            "results_published": are_results_published(),
        },
    )


@require_GET
def drawing_image(request, pk):
    drawing = get_object_or_404(Drawing, pk=pk)
    if not _can_view_drawing(request, drawing):
        raise Http404("Изображение недоступно.")

    if drawing.image and drawing.image.name and default_storage.exists(drawing.image.name):
        with drawing.image.open("rb") as img_file:
            return HttpResponse(
                img_file.read(),
                content_type=drawing.image_blob_content_type or "image/png",
            )

    if drawing.image_blob:
        return HttpResponse(
            bytes(drawing.image_blob),
            content_type=drawing.image_blob_content_type or "image/png",
        )

    return HttpResponse(
        _missing_image_svg(drawing.title),
        content_type="image/svg+xml",
    )


@require_GET
def rules(request):
    return render(request, "drawings/rules.html")


@require_GET
def guide(request):
    return render(request, "drawings/guide.html")


@require_GET
def results(request):
    results_published = are_results_published()
    winners = _get_category_winners() if results_published else []
    return render(
        request,
        "drawings/results.html",
        {
            "winners": winners,
            "results_published": results_published,
        },
    )


@require_GET
def certificate(request, pk):
    if not are_results_published():
        raise Http404("Сертификаты будут доступны после объявления итогов.")

    drawing = get_object_or_404(Drawing, pk=pk)
    winner = (
        Drawing.objects.filter(category=drawing.category, is_approved=True)
        .order_by("-votes", "-created_at")
        .first()
    )
    if winner is None or winner.pk != drawing.pk:
        raise Http404("Сертификат доступен только для победителей категории.")

    return render(request, "drawings/certificate.html", {"drawing": drawing})


@require_GET
def draw(request):
    categories = AGE_CATEGORY_FILTERS
    draw_i18n = EN if current_language_code() == "en" else {}
    return render(
        request,
        "drawings/draw.html",
        {
            "categories": categories,
            "draw_i18n_json": json.dumps(draw_i18n, ensure_ascii=False),
            "contest_submission_open": is_submission_open(),
        },
    )


@require_POST
def submit_drawing(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {
                "success": False,
                "error": translate("Войдите или зарегистрируйтесь, чтобы отправить работу."),
            },
            status=403,
        )

    if not is_submission_open():
        return JsonResponse(
            {
                "success": False,
                "error": translate("Приём работ завершён. Голосование начнётся после окончания приёма."),
            },
            status=403,
        )

    image = request.FILES.get("image")
    title = request.POST.get("title", "").strip()
    description = request.POST.get("description", "").strip()
    author_name = request.POST.get("author_name", "").strip()
    age_raw = request.POST.get("age", "").strip()
    city = request.POST.get("city", "").strip()
    email = request.POST.get("email", "").strip()
    consent = request.POST.get("consent")
    category_slug_from_form = request.POST.get("category_slug", "").strip()

    if image is None:
        return JsonResponse(
            {"success": False, "error": translate("Файл изображения не передан.")},
            status=400,
        )

    if image.content_type != "image/png":
        return JsonResponse(
            {"success": False, "error": translate("Допускаются только PNG изображения.")},
            status=400,
        )

    image_bytes = image.read()
    if not image_bytes:
        return JsonResponse(
            {"success": False, "error": translate("Пустой файл изображения.")},
            status=400,
        )

    if len(description) > 500:
        return JsonResponse(
            {"success": False, "error": translate("Описание не должно быть длиннее 500 символов.")},
            status=400,
        )

    if not all([title, author_name, age_raw, city]):
        return JsonResponse(
            {"success": False, "error": translate("Заполните все поля формы.")},
            status=400,
        )

    if consent not in {"on", "true", "1"}:
        return JsonResponse(
            {
                "success": False,
                "error": translate("Требуется согласие на обработку персональных данных."),
            },
            status=400,
        )

    try:
        age = int(age_raw)
    except (TypeError, ValueError):
        return JsonResponse(
            {"success": False, "error": translate("Возраст указан неверно.")},
            status=400,
        )

    if age < 6 or age > 25:
        return JsonResponse(
            {"success": False, "error": translate("Возраст должен быть от 6 до 25 лет.")},
            status=400,
        )

    if request.user.is_authenticated:
        email = request.user.email or email
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse(
            {"success": False, "error": translate("Укажите корректный email.")},
            status=400,
        )

    category_name, category_slug = _get_category_for_age(age)
    if category_slug_from_form and category_slug_from_form != category_slug:
        return JsonResponse(
            {"success": False, "error": translate("Возраст не соответствует выбранной категории.")},
            status=400,
        )

    category, _ = Category.objects.get_or_create(
        slug=category_slug,
        defaults={"name": category_name, "theme": category_name},
    )
    if category.name != category_name:
        category.name = category_name
        category.save(update_fields=["name"])

    stored_name = _build_stored_image_name(image.name)

    drawing = Drawing.objects.create(
        user=request.user,
        title=title,
        description=description,
        author=author_name,
        age=age,
        city=city,
        email=email,
        category=category,
        image=ContentFile(image_bytes, name=stored_name),
        image_blob=image_bytes,
        image_blob_content_type=image.content_type or "image/png",
        is_approved=False,
        votes=0,
    )
    send_notification(drawing, "submitted", request=request)

    return JsonResponse({"success": True, "id": drawing.id})


@login_required
@require_POST
def restore_drawing_image(request, pk):
    drawing = get_object_or_404(Drawing, pk=pk, user=request.user)
    image = request.FILES.get("image")
    if image is None:
        return redirect(f"{reverse('profile')}?restore=missing_file")
    if image.content_type != "image/png":
        return redirect(f"{reverse('profile')}?restore=invalid_type")

    image_bytes = image.read()
    if not image_bytes:
        return redirect(f"{reverse('profile')}?restore=empty_file")

    previous_name = drawing.image.name if drawing.image else ""
    drawing.image.save(_build_stored_image_name(image.name), ContentFile(image_bytes), save=False)
    drawing.image_blob = image_bytes
    drawing.image_blob_content_type = image.content_type or "image/png"
    drawing.save(update_fields=["image", "image_blob", "image_blob_content_type"])

    if (
        previous_name
        and previous_name != drawing.image.name
        and default_storage.exists(previous_name)
    ):
        default_storage.delete(previous_name)

    return redirect(f"{reverse('profile')}?restore=ok")


@require_POST
@transaction.atomic
def vote(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"success": False, "error": translate("Войдите, чтобы голосовать.")},
            status=401,
        )

    drawing = get_object_or_404(Drawing, pk=pk, is_approved=True)

    if _is_own_drawing(drawing, request.user):
        return JsonResponse(
            {"success": False, "error": translate("Нельзя голосовать за свою работу.")},
            status=403,
        )

    existing_vote = Vote.objects.filter(drawing=drawing, user=request.user).first()

    if existing_vote:
        existing_vote.delete()
        drawing.votes = max(0, drawing.votes - 1)
        drawing.save(update_fields=["votes"])
        return JsonResponse({"success": True, "votes": drawing.votes, "voted": False})

    Vote.objects.create(drawing=drawing, user=request.user)
    drawing.votes += 1
    drawing.save(update_fields=["votes"])
    return JsonResponse({"success": True, "votes": drawing.votes, "voted": True})


def register(request):
    if request.user.is_authenticated:
        return redirect("profile")

    if request.method == "POST":
        email = request.POST.get("email", "").strip().lower()
        password = request.POST.get("password", "")
        password2 = request.POST.get("password2", "")

        if not email or not password or not password2:
            return render(request, "drawings/register.html", {"error": translate("Заполните все поля.")})

        if password != password2:
            return render(request, "drawings/register.html", {"error": translate("Пароли не совпадают.")})

        if User.objects.filter(username=email).exists():
            return render(
                request,
                "drawings/register.html",
                {"error": translate("Email уже зарегистрирован.")},
            )

        user = User.objects.create_user(username=email, email=email, password=password)
        login(request, user)
        return redirect("profile")

    return render(request, "drawings/register.html")


def user_login(request):
    if request.user.is_authenticated:
        return redirect("profile")

    if request.method == "POST":
        email = request.POST.get("email", "").strip().lower()
        password = request.POST.get("password", "")
        user = authenticate(request, username=email, password=password)
        if user:
            login(request, user)
            next_url = request.GET.get("next")
            if next_url and url_has_allowed_host_and_scheme(
                next_url,
                allowed_hosts={request.get_host()},
                require_https=request.is_secure(),
            ):
                return redirect(next_url)
            return redirect("profile")
        return render(
            request,
            "drawings/login.html",
            {"error": translate("Неверный email или пароль.")},
        )
    return render(request, "drawings/login.html")


def user_logout(request):
    logout(request)
    return redirect("index")


@login_required
def organizer_stats(request):
    if not _can_view_moderation_content(request):
        raise Http404("Статистика доступна только организаторам.")

    days_raw = request.GET.get("days", "14").strip()
    try:
        days = int(days_raw)
    except (TypeError, ValueError):
        days = 14

    from .organizer_stats import build_organizer_stats

    stats = build_organizer_stats(days=days)
    return render(
        request,
        "drawings/organizer_stats.html",
        {
            "is_moderator": True,
            "organizer": stats,
        },
    )


@login_required
def profile(request):
    drawings = list(
        Drawing.objects.filter(user=request.user)
        .select_related("category")
        .order_by("-created_at")
    )
    missing_image_ids = set()
    for drawing in drawings:
        has_file = bool(
            drawing.image and drawing.image.name and default_storage.exists(drawing.image.name)
        )
        has_blob = bool(drawing.image_blob)
        if not has_file and not has_blob:
            missing_image_ids.add(drawing.id)

    published_count = sum(1 for drawing in drawings if drawing.is_approved)
    rejected_count = sum(1 for drawing in drawings if drawing.is_rejected and not drawing.is_approved)
    pending_count = len(drawings) - published_count - rejected_count
    votes_total = sum(drawing.votes for drawing in drawings)

    is_moderator = _can_view_moderation_content(request)
    moderation_filter = request.GET.get("mod", "pending").strip()
    if moderation_filter not in {"pending", "rejected", "published", "all"}:
        moderation_filter = "pending"

    moderation_stats = None
    moderation_page = None
    if is_moderator:
        moderation_qs = Drawing.objects.select_related("category", "user").order_by("-created_at")
        moderation_stats = {
            "pending": Drawing.objects.filter(is_approved=False, is_rejected=False).count(),
            "rejected": Drawing.objects.filter(is_rejected=True, is_approved=False).count(),
            "published": Drawing.objects.filter(is_approved=True).count(),
            "total": Drawing.objects.count(),
        }
        if moderation_filter == "pending":
            moderation_qs = moderation_qs.filter(is_approved=False, is_rejected=False)
        elif moderation_filter == "rejected":
            moderation_qs = moderation_qs.filter(is_rejected=True, is_approved=False)
        elif moderation_filter == "published":
            moderation_qs = moderation_qs.filter(is_approved=True)
        moderation_page = Paginator(moderation_qs, 12).get_page(request.GET.get("page"))

    return render(
        request,
        "drawings/profile.html",
        {
            "drawings": drawings,
            "missing_image_ids": missing_image_ids,
            "restore_status": request.GET.get("restore", ""),
            "moderation_status": request.GET.get("moderation", ""),
            "is_moderator": is_moderator,
            "moderation_filter": moderation_filter,
            "moderation_stats": moderation_stats,
            "moderation_page": moderation_page,
            "stats": {
                "total": len(drawings),
                "published": published_count,
                "pending": pending_count,
                "rejected": rejected_count,
                "votes": votes_total,
            },
        },
    )


@login_required
@require_POST
def moderate_drawing(request, pk):
    if not _can_view_moderation_content(request):
        raise Http404("Модерация недоступна.")

    drawing = get_object_or_404(Drawing.objects.select_related("category"), pk=pk)
    action = request.POST.get("action", "").strip()
    next_url = _safe_redirect_url(request)
    rejection_reason = request.POST.get("rejection_reason", "").strip()

    if action == "approve":
        was_approved = drawing.is_approved
        drawing.is_approved = True
        drawing.is_rejected = False
        drawing.rejection_reason = ""
        drawing.save(update_fields=["is_approved", "is_rejected", "rejection_reason"])
        if not was_approved:
            send_notification(drawing, "approved", request=request)
        return _redirect_with_status(next_url, "approved")

    if action == "reject":
        if not rejection_reason:
            return _redirect_with_status(next_url, "reject_reason_required")
        if len(rejection_reason) > 500:
            return _redirect_with_status(next_url, "reject_reason_too_long")
        drawing.is_approved = False
        drawing.is_rejected = True
        drawing.rejection_reason = rejection_reason
        drawing.save(update_fields=["is_approved", "is_rejected", "rejection_reason"])
        send_notification(drawing, "rejected", request=request)
        return _redirect_with_status(next_url, "rejected")

    if action == "unpublish":
        if drawing.is_approved:
            drawing.is_approved = False
            drawing.is_rejected = False
            drawing.rejection_reason = ""
            drawing.save(update_fields=["is_approved", "is_rejected", "rejection_reason"])
        return _redirect_with_status(next_url, "unpublished")

    if action == "delete":
        drawing.delete()
        # After delete, don't return to the work page.
        if f"/work/{pk}/" in next_url:
            next_url = reverse("profile") + "?mod=pending"
        return _redirect_with_status(next_url, "deleted")

    return redirect(next_url)


def _get_category_for_age(age):
    for category in AGE_CATEGORY_FILTERS:
        if category["min_age"] <= age <= category["max_age"]:
            return category["name"], category["slug"]

    # Safety fallback, though age is validated earlier.
    return "18–25 лет", "age-18-25"
