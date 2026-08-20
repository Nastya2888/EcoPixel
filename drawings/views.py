from django.http import Http404, JsonResponse
from django.db.models import Count, Sum
from django.core.paginator import Paginator
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.utils.http import url_has_allowed_host_and_scheme
from django.shortcuts import get_list_or_404, get_object_or_404, redirect, render
from django.views.decorators.http import require_GET, require_POST

from .models import Category, Drawing, Vote
from .utils import send_notification


AGE_CATEGORY_FILTERS = (
    {"slug": "age-6-9", "name": "6–9 лет", "min_age": 6, "max_age": 9},
    {"slug": "age-10-13", "name": "10–13 лет", "min_age": 10, "max_age": 13},
    {"slug": "age-14-17", "name": "14–17 лет", "min_age": 14, "max_age": 17},
)


@require_GET
def index(request):
    categories = Category.objects.annotate(drawing_count=Count("submissions")).order_by("name")[:3]
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
            "categories": categories,
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
    drawings = Drawing.objects.select_related("category").all()
    selected_age_category = category_by_slug.get(current_slug)
    if selected_age_category:
        drawings = drawings.filter(
            age__gte=selected_age_category["min_age"],
            age__lte=selected_age_category["max_age"],
        )

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
            "page_obj": page_obj,
            "voted_ids": voted_ids,
        },
    )


@require_GET
def work_detail(request, pk):
    work = get_object_or_404(Drawing, pk=pk)
    has_voted = False
    if request.user.is_authenticated:
        has_voted = Vote.objects.filter(drawing=work, user=request.user).exists()
    og_image_url = request.build_absolute_uri(work.image.url) if work.image else ""
    return render(
        request,
        "drawings/work_detail.html",
        {"work": work, "has_voted": has_voted, "og_image_url": og_image_url},
    )


@require_GET
def rules(request):
    return render(request, "drawings/rules.html")


@require_GET
def results(request):
    categories = get_list_or_404(Category)
    winners = []
    for category in categories:
        winner = (
            Drawing.objects.filter(category=category, is_approved=True)
            .order_by("-votes", "-created_at")
            .first()
        )
        winners.append({"category": category, "winner": winner})
    return render(request, "drawings/results.html", {"winners": winners})


@require_GET
def certificate(request, pk):
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
    categories = Category.objects.all()
    return render(request, "drawings/draw.html", {"categories": categories})


@require_POST
def submit_drawing(request):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"success": False, "error": "Войдите или зарегистрируйтесь, чтобы отправить работу."},
            status=403,
        )

    image = request.FILES.get("image")
    title = request.POST.get("title", "").strip()
    author_name = request.POST.get("author_name", "").strip()
    age_raw = request.POST.get("age", "").strip()
    city = request.POST.get("city", "").strip()
    email = request.POST.get("email", "").strip()
    consent = request.POST.get("consent")
    category_slug_from_form = request.POST.get("category_slug", "").strip()

    if image is None:
        return JsonResponse({"success": False, "error": "Файл изображения не передан."}, status=400)

    if image.content_type != "image/png":
        return JsonResponse({"success": False, "error": "Допускаются только PNG изображения."}, status=400)

    if not all([title, author_name, age_raw, city]):
        return JsonResponse({"success": False, "error": "Заполните все поля формы."}, status=400)

    if consent not in {"on", "true", "1"}:
        return JsonResponse(
            {"success": False, "error": "Требуется согласие на обработку персональных данных."},
            status=400,
        )

    try:
        age = int(age_raw)
    except (TypeError, ValueError):
        return JsonResponse({"success": False, "error": "Возраст указан неверно."}, status=400)

    if age < 6 or age > 17:
        return JsonResponse({"success": False, "error": "Возраст должен быть от 6 до 17 лет."}, status=400)

    if request.user.is_authenticated:
        email = request.user.email or email
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"success": False, "error": "Укажите корректный email."}, status=400)

    category_name, category_slug = _get_category_for_age(age)
    if category_slug_from_form and category_slug_from_form != category_slug:
        return JsonResponse(
            {"success": False, "error": "Возраст не соответствует выбранной категории."},
            status=400,
        )

    category, _ = Category.objects.get_or_create(
        slug=category_slug,
        defaults={"name": category_name, "theme": category_name},
    )
    if category.name != category_name:
        category.name = category_name
        category.save(update_fields=["name"])

    drawing = Drawing.objects.create(
        user=request.user,
        title=title,
        author=author_name,
        age=age,
        city=city,
        email=email,
        category=category,
        image=image,
        is_approved=False,
        votes=0,
    )
    send_notification(drawing, "submitted", request=request)

    return JsonResponse({"success": True, "id": drawing.id})


@require_POST
def vote(request, pk):
    if not request.user.is_authenticated:
        return JsonResponse(
            {"success": False, "error": "Войдите, чтобы голосовать."},
            status=401,
        )

    drawing = get_object_or_404(Drawing, pk=pk, is_approved=True)

    if Vote.objects.filter(drawing=drawing, user=request.user).exists():
        return JsonResponse(
            {"success": False, "error": "Вы уже голосовали за эту работу"},
            status=403,
        )

    drawing.votes += 1
    drawing.save(update_fields=["votes"])
    Vote.objects.create(drawing=drawing, user=request.user)
    return JsonResponse({"success": True, "votes": drawing.votes})


def register(request):
    if request.user.is_authenticated:
        return redirect("profile")

    if request.method == "POST":
        email = request.POST.get("email", "").strip().lower()
        password = request.POST.get("password", "")
        password2 = request.POST.get("password2", "")

        if not email or not password or not password2:
            return render(request, "drawings/register.html", {"error": "Заполните все поля."})

        if password != password2:
            return render(request, "drawings/register.html", {"error": "Пароли не совпадают."})

        if User.objects.filter(username=email).exists():
            return render(
                request,
                "drawings/register.html",
                {"error": "Email уже зарегистрирован."},
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
            {"error": "Неверный email или пароль."},
        )
    return render(request, "drawings/login.html")


def user_logout(request):
    logout(request)
    return redirect("index")


@login_required
def profile(request):
    drawings = Drawing.objects.filter(user=request.user).order_by("-created_at")
    winner_ids = set()
    for category in Category.objects.all():
        winner = (
            Drawing.objects.filter(category=category, is_approved=True)
            .order_by("-votes", "-created_at")
            .first()
        )
        if winner:
            winner_ids.add(winner.id)

    return render(
        request,
        "drawings/profile.html",
        {"drawings": drawings, "winner_ids": winner_ids},
    )


def _get_category_for_age(age):
    for category in AGE_CATEGORY_FILTERS:
        if category["min_age"] <= age <= category["max_age"]:
            return category["name"], category["slug"]

    # Safety fallback, though age is validated earlier.
    return "14–17 лет", "age-14-17"
