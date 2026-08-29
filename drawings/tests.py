from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from .contest import PHASE_RESULTS, PHASE_SUBMISSION, PHASE_VOTING, get_contest_phase
from .models import Category, Drawing, Vote


CONTEST_SUBMISSION_OPEN = {
    "CONTEST_SUBMISSION_END": "2099-12-31",
    "CONTEST_RESULTS_START": "2099-12-31",
}

CONTEST_VOTING_OPEN = {
    "CONTEST_SUBMISSION_END": "2020-01-01",
    "CONTEST_RESULTS_START": "2099-12-31",
}

CONTEST_RESULTS_PUBLISHED = {
    "CONTEST_SUBMISSION_END": "2020-01-01",
    "CONTEST_RESULTS_START": "2020-01-01",
}


@override_settings(**CONTEST_SUBMISSION_OPEN)
class AuthFlowTests(TestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.user = User.objects.create_user(
            username="kid@example.com",
            email="kid@example.com",
            password=self.password,
        )
        self.category = Category.objects.create(name="6–9 лет", slug="age-6-9", theme="6–9 лет")
        self.png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
            b"\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!"
            b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
        )

    def test_profile_requires_authentication(self):
        response = self.client.get(reverse("profile"))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response.url)

    def test_login_blocks_external_redirect(self):
        response = self.client.post(
            f"{reverse('login')}?next=https://evil.example/phish",
            {"email": self.user.email, "password": self.password},
        )
        self.assertRedirects(response, reverse("profile"))

    def test_submit_drawing_requires_authentication(self):
        response = self.client.post(reverse("submit_drawing"), {})
        self.assertEqual(response.status_code, 403)
        self.assertJSONEqual(
            response.content,
            {"success": False, "error": "Войдите или зарегистрируйтесь, чтобы отправить работу."},
        )

    def test_authenticated_submit_creates_drawing(self):
        self.client.login(username=self.user.email, password=self.password)
        png = SimpleUploadedFile(
            "test.png",
            self.png,
            content_type="image/png",
        )

        response = self.client.post(
            reverse("submit_drawing"),
            {
                "image": png,
                "title": "Дом у леса",
                "description": "Рисунок про заботу о лесе и чистый воздух.",
                "author_name": "Аня",
                "age": "9",
                "city": "Алматы",
                "email": self.user.email,
                "consent": "on",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Drawing.objects.filter(user=self.user).count(), 1)
        drawing = Drawing.objects.get(user=self.user)
        self.assertEqual(drawing.description, "Рисунок про заботу о лесе и чистый воздух.")
        self.assertTrue(bool(drawing.image_blob))

    def test_submit_accepts_new_18_25_category(self):
        self.client.login(username=self.user.email, password=self.password)
        png = SimpleUploadedFile("test-adult.png", self.png, content_type="image/png")

        response = self.client.post(
            reverse("submit_drawing"),
            {
                "image": png,
                "title": "Эко-проект района",
                "author_name": "Аня",
                "age": "20",
                "city": "Алматы",
                "email": self.user.email,
                "consent": "on",
                "category_slug": "age-18-25",
            },
        )

        self.assertEqual(response.status_code, 200)
        drawing = Drawing.objects.latest("id")
        self.assertEqual(drawing.age, 20)
        self.assertEqual(drawing.category.slug, "age-18-25")

    def test_owner_can_restore_missing_image_from_profile(self):
        self.client.login(username=self.user.email, password=self.password)
        drawing = Drawing.objects.create(
            user=self.user,
            title="Нужно восстановить",
            author="Аня",
            age=9,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("old.png", self.png, content_type="image/png"),
            image_blob=None,
            image_blob_content_type="image/png",
            is_approved=True,
            votes=1,
        )
        if drawing.image and drawing.image.name:
            drawing.image.storage.delete(drawing.image.name)
        drawing.image_blob = None
        drawing.save(update_fields=["image_blob"])

        response = self.client.post(
            reverse("restore_drawing_image", args=[drawing.id]),
            {"image": SimpleUploadedFile("new.png", self.png, content_type="image/png")},
        )
        self.assertRedirects(response, f"{reverse('profile')}?restore=ok")

        drawing.refresh_from_db()
        self.assertTrue(bool(drawing.image_blob))
        image_response = self.client.get(reverse("drawing_image", args=[drawing.id]))
        self.assertEqual(image_response.status_code, 200)
        self.assertEqual(image_response["Content-Type"], "image/png")

    def test_user_cannot_restore_someone_elses_image(self):
        owner = User.objects.create_user(
            username="owner@example.com",
            email="owner@example.com",
            password=self.password,
        )
        drawing = Drawing.objects.create(
            user=owner,
            title="Чужая работа",
            author="Другой",
            age=9,
            city="Алматы",
            email=owner.email,
            category=self.category,
            image=SimpleUploadedFile("other.png", self.png, content_type="image/png"),
            is_approved=True,
            votes=0,
        )
        self.client.login(username=self.user.email, password=self.password)
        response = self.client.post(
            reverse("restore_drawing_image", args=[drawing.id]),
            {"image": SimpleUploadedFile("new.png", self.png, content_type="image/png")},
        )
        self.assertEqual(response.status_code, 404)

    def test_profile_shows_status_for_regular_user(self):
        drawing = Drawing.objects.create(
            user=self.user,
            title="Профиль со статусом",
            author="Аня",
            age=9,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("profile-ok.png", self.png, content_type="image/png"),
            is_approved=True,
            votes=0,
        )
        self.client.login(username=self.user.email, password=self.password)
        response = self.client.get(reverse("profile"))
        self.assertContains(response, drawing.title)
        self.assertContains(response, "В галерее")
        self.assertContains(response, "Всего работ")

    def test_profile_shows_pending_drawings_for_owner(self):
        approved = Drawing.objects.create(
            user=self.user,
            title="Опубликованная",
            author="Аня",
            age=9,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("profile-approved.png", self.png, content_type="image/png"),
            is_approved=True,
            votes=1,
        )
        pending = Drawing.objects.create(
            user=self.user,
            title="На модерации",
            author="Аня",
            age=9,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("profile-pending.png", self.png, content_type="image/png"),
            is_approved=False,
            votes=0,
        )
        self.client.login(username=self.user.email, password=self.password)
        response = self.client.get(reverse("profile"))
        self.assertContains(response, approved.title)
        self.assertContains(response, pending.title)
        self.assertContains(response, "На модерации")
        self.assertEqual(response.context["stats"]["total"], 2)
        self.assertEqual(response.context["stats"]["published"], 1)
        self.assertEqual(response.context["stats"]["pending"], 1)
        self.assertEqual(response.context["stats"]["votes"], 1)

    def test_owner_can_open_own_pending_work_detail(self):
        pending = Drawing.objects.create(
            user=self.user,
            title="Моя на проверке",
            author="Аня",
            age=9,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("own-pending.png", self.png, content_type="image/png"),
            is_approved=False,
            votes=0,
        )
        self.client.login(username=self.user.email, password=self.password)
        response = self.client.get(reverse("work_detail", args=[pending.id]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, pending.title)
        self.assertContains(response, "Работа на модерации")

    def test_owner_can_open_own_pending_work_image(self):
        pending = Drawing.objects.create(
            user=self.user,
            title="Моя картинка на проверке",
            author="Аня",
            age=9,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("own-pending-img.png", self.png, content_type="image/png"),
            is_approved=False,
            votes=0,
        )
        self.client.login(username=self.user.email, password=self.password)
        response = self.client.get(reverse("drawing_image", args=[pending.id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")


class HomePageTests(TestCase):
    def test_homepage_always_shows_all_age_topic_cards_without_gallery_links(self):
        response = self.client.get(reverse("index"))
        self.assertEqual(response.status_code, 200)

        self.assertContains(response, "6–9 лет")
        self.assertContains(response, "10–13 лет")
        self.assertContains(response, "14–17 лет")
        self.assertContains(response, "18–25 лет")
        self.assertContains(response, "Мой чистый дом")
        self.assertContains(response, "Сохраним леса")
        self.assertContains(response, "Эко-город будущего")
        self.assertContains(response, "Эко-инициативы сообщества")

        self.assertNotContains(response, "?category=age-6-9")
        self.assertNotContains(response, "?category=age-10-13")
        self.assertNotContains(response, "?category=age-14-17")
        self.assertNotContains(response, "?category=age-18-25")


@override_settings(**CONTEST_VOTING_OPEN)
class VotingTests(TestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.owner = User.objects.create_user(
            username="owner@example.com",
            email="owner@example.com",
            password=self.password,
        )
        self.voter = User.objects.create_user(
            username="vote@example.com",
            email="vote@example.com",
            password=self.password,
        )
        self.category = Category.objects.create(name="10–13 лет", slug="age-10-13", theme="10–13 лет")
        self.drawing = Drawing.objects.create(
            user=self.owner,
            title="Тест",
            author="Тест",
            age=10,
            city="Астана",
            email=self.owner.email,
            category=self.category,
            image=SimpleUploadedFile(
                "drawing.png",
                (
                    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
                    b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
                    b"\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!"
                    b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
                ),
                content_type="image/png",
            ),
            is_approved=True,
            votes=0,
        )

    def test_vote_requires_authentication(self):
        response = self.client.post(reverse("vote", args=[self.drawing.id]))
        self.assertEqual(response.status_code, 401)

    def test_user_cannot_vote_for_own_drawing(self):
        self.client.login(username=self.owner.email, password=self.password)
        response = self.client.post(reverse("vote", args=[self.drawing.id]))

        self.assertEqual(response.status_code, 403)
        self.assertJSONEqual(
            response.content,
            {"success": False, "error": "Нельзя голосовать за свою работу."},
        )
        self.assertEqual(Vote.objects.filter(drawing=self.drawing).count(), 0)
        self.drawing.refresh_from_db()
        self.assertEqual(self.drawing.votes, 0)

    def test_user_can_toggle_vote_off(self):
        self.client.login(username=self.voter.email, password=self.password)
        first = self.client.post(reverse("vote", args=[self.drawing.id]))
        second = self.client.post(reverse("vote", args=[self.drawing.id]))

        self.assertEqual(first.status_code, 200)
        self.assertJSONEqual(first.content, {"success": True, "votes": 1, "voted": True})
        self.assertEqual(second.status_code, 200)
        self.assertJSONEqual(second.content, {"success": True, "votes": 0, "voted": False})
        self.assertEqual(Vote.objects.filter(drawing=self.drawing, user=self.voter).count(), 0)
        self.drawing.refresh_from_db()
        self.assertEqual(self.drawing.votes, 0)


@override_settings(**CONTEST_VOTING_OPEN)
class GalleryTests(TestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.user = User.objects.create_user(
            username="gallery@example.com",
            email="gallery@example.com",
            password=self.password,
        )
        self.admin_user = User.objects.create_user(
            username="admin@example.com",
            email="admin@example.com",
            password=self.password,
            is_staff=True,
        )
        self.category_6_9 = Category.objects.create(name="6–9 лет", slug="age-6-9", theme="6–9 лет")
        self.category_10_13 = Category.objects.create(name="10–13 лет", slug="age-10-13", theme="10–13 лет")
        self.category_14_17 = Category.objects.create(name="14–17 лет", slug="age-14-17", theme="14–17 лет")
        self.category_18_25 = Category.objects.create(name="18–25 лет", slug="age-18-25", theme="18–25 лет")

        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
            b"\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!"
            b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
        )

        self.young_work = Drawing.objects.create(
            user=self.user,
            title="Младшая категория",
            author="Автор",
            age=8,
            city="Алматы",
            email=self.user.email,
            category=self.category_6_9,
            image=SimpleUploadedFile("gallery-young.png", png, content_type="image/png"),
            is_approved=True,
            votes=2,
        )
        self.middle_pending_work = Drawing.objects.create(
            user=self.user,
            title="Средняя категория",
            author="Автор",
            age=11,
            city="Алматы",
            email=self.user.email,
            category=self.category_10_13,
            image=SimpleUploadedFile("gallery-middle.png", png, content_type="image/png"),
            is_approved=False,
            votes=0,
        )
        self.teen_work = Drawing.objects.create(
            user=self.user,
            title="Старшая категория",
            author="Автор",
            age=15,
            city="Алматы",
            email=self.user.email,
            category=self.category_14_17,
            image=SimpleUploadedFile("gallery-teen.png", png, content_type="image/png"),
            is_approved=True,
            votes=1,
        )
        self.adult_work = Drawing.objects.create(
            user=self.user,
            title="Молодежная категория",
            author="Автор",
            age=20,
            city="Алматы",
            email=self.user.email,
            category=self.category_18_25,
            image=SimpleUploadedFile("gallery-adult.png", png, content_type="image/png"),
            is_approved=True,
            votes=3,
        )

    def test_gallery_hides_pending_drawings_for_regular_users(self):
        response = self.client.get(reverse("gallery"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.young_work.title)
        self.assertNotContains(response, self.middle_pending_work.title)
        self.assertContains(response, self.teen_work.title)
        self.assertContains(response, self.adult_work.title)
        self.assertNotContains(response, "Статус:")

    def test_gallery_has_all_age_filters(self):
        response = self.client.get(reverse("gallery"))
        self.assertContains(response, "6–9 лет")
        self.assertContains(response, "10–13 лет")
        self.assertContains(response, "14–17 лет")
        self.assertContains(response, "18–25 лет")

    def test_gallery_filters_by_middle_age_group(self):
        response = self.client.get(reverse("gallery"), {"category": "age-10-13"})
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, self.middle_pending_work.title)
        self.assertContains(response, "Работы не найдены.")
        self.assertNotContains(response, self.young_work.title)
        self.assertNotContains(response, self.teen_work.title)
        self.assertNotContains(response, self.adult_work.title)

    def test_gallery_filters_by_18_25_group(self):
        response = self.client.get(reverse("gallery"), {"category": "age-18-25"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.adult_work.title)
        self.assertNotContains(response, self.young_work.title)
        self.assertNotContains(response, self.middle_pending_work.title)
        self.assertNotContains(response, self.teen_work.title)

    def test_admin_sees_pending_drawings_and_status(self):
        self.client.login(username=self.admin_user.email, password=self.password)
        response = self.client.get(reverse("gallery"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.middle_pending_work.title)
        self.assertContains(response, "Статус: На модерации")

    def test_pending_work_detail_is_hidden_from_regular_users(self):
        response = self.client.get(reverse("work_detail", args=[self.middle_pending_work.id]))
        self.assertEqual(response.status_code, 404)

    def test_admin_can_open_pending_work_detail(self):
        self.client.login(username=self.admin_user.email, password=self.password)
        response = self.client.get(reverse("work_detail", args=[self.middle_pending_work.id]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.middle_pending_work.title)

    def test_pending_work_image_is_hidden_from_regular_users(self):
        response = self.client.get(reverse("drawing_image", args=[self.middle_pending_work.id]))
        self.assertEqual(response.status_code, 404)

    def test_admin_can_open_pending_work_image(self):
        self.client.login(username=self.admin_user.email, password=self.password)
        response = self.client.get(reverse("drawing_image", args=[self.middle_pending_work.id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")

    def test_unapproved_drawing_vote_is_forbidden(self):
        self.client.login(username=self.user.email, password=self.password)
        response = self.client.post(reverse("vote", args=[self.middle_pending_work.id]))
        self.assertEqual(response.status_code, 404)


class DrawingImageFallbackTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="image@example.com",
            email="image@example.com",
            password="StrongPass123!",
        )
        self.category = Category.objects.create(name="6–9 лет", slug="age-6-9", theme="6–9 лет")
        self.png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
            b"\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!"
            b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
        )

    def test_drawing_image_uses_blob_when_file_missing(self):
        drawing = Drawing.objects.create(
            user=self.user,
            title="Blob fallback",
            author="Автор",
            age=8,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("fallback.png", self.png, content_type="image/png"),
            image_blob=self.png,
            image_blob_content_type="image/png",
            is_approved=True,
            votes=0,
        )
        if drawing.image and drawing.image.name:
            drawing.image.storage.delete(drawing.image.name)

        response = self.client.get(reverse("drawing_image", args=[drawing.id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertEqual(response.content, self.png)

    def test_drawing_image_returns_svg_placeholder_when_everything_missing(self):
        drawing = Drawing.objects.create(
            user=self.user,
            title="Потерянная работа",
            author="Автор",
            age=8,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("missing.png", self.png, content_type="image/png"),
            image_blob=None,
            image_blob_content_type="image/png",
            is_approved=True,
            votes=0,
        )
        if drawing.image and drawing.image.name:
            drawing.image.storage.delete(drawing.image.name)
        drawing.image_blob = None
        drawing.save(update_fields=["image_blob"])

        response = self.client.get(reverse("drawing_image", args=[drawing.id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/svg+xml")
        self.assertIn("Изображение недоступно", response.content.decode("utf-8"))


class ModeratorPanelTests(TestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.user = User.objects.create_user(
            username="author@example.com",
            email="author@example.com",
            password=self.password,
        )
        self.moderator = User.objects.create_user(
            username="mod@example.com",
            email="mod@example.com",
            password=self.password,
            is_staff=True,
        )
        self.category = Category.objects.create(name="6–9 лет", slug="age-6-9", theme="6–9 лет")
        self.png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
            b"\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!"
            b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        self.pending = Drawing.objects.create(
            user=self.user,
            title="Ждёт проверки",
            author="Автор",
            age=8,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("pending-mod.png", self.png, content_type="image/png"),
            is_approved=False,
            votes=0,
        )
        self.published = Drawing.objects.create(
            user=self.user,
            title="Уже в галерее",
            author="Автор",
            age=8,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("published-mod.png", self.png, content_type="image/png"),
            is_approved=True,
            votes=2,
        )

    def test_regular_user_cannot_moderate(self):
        self.client.login(username=self.user.email, password=self.password)
        response = self.client.post(
            reverse("moderate_drawing", args=[self.pending.id]),
            {"action": "approve", "next": reverse("profile")},
        )
        self.assertEqual(response.status_code, 404)
        self.pending.refresh_from_db()
        self.assertFalse(self.pending.is_approved)

    def test_moderator_profile_shows_pending_queue(self):
        self.client.login(username=self.moderator.email, password=self.password)
        response = self.client.get(reverse("profile"), {"mod": "pending"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Кабинет модератора")
        self.assertContains(response, self.pending.title)
        self.assertNotContains(response, self.published.title)
        self.assertEqual(response.context["moderation_stats"]["pending"], 1)

    def test_moderator_can_approve_drawing(self):
        self.client.login(username=self.moderator.email, password=self.password)
        response = self.client.post(
            reverse("moderate_drawing", args=[self.pending.id]),
            {"action": "approve", "next": reverse("profile") + "?mod=pending"},
        )
        self.assertEqual(response.status_code, 302)
        self.pending.refresh_from_db()
        self.assertTrue(self.pending.is_approved)

    def test_moderator_can_unpublish_drawing(self):
        self.client.login(username=self.moderator.email, password=self.password)
        response = self.client.post(
            reverse("moderate_drawing", args=[self.published.id]),
            {"action": "unpublish", "next": reverse("profile") + "?mod=published"},
        )
        self.assertEqual(response.status_code, 302)
        self.published.refresh_from_db()
        self.assertFalse(self.published.is_approved)

    def test_moderator_can_delete_drawing(self):
        self.client.login(username=self.moderator.email, password=self.password)
        response = self.client.post(
            reverse("moderate_drawing", args=[self.pending.id]),
            {"action": "delete", "next": reverse("profile") + "?mod=pending"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Drawing.objects.filter(pk=self.pending.id).exists())

    def test_work_detail_shows_moderation_controls_for_staff(self):
        self.client.login(username=self.moderator.email, password=self.password)
        response = self.client.get(reverse("work_detail", args=[self.pending.id]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Опубликовать")
        self.assertContains(response, "Удалить")

    def test_organizer_stats_requires_staff(self):
        user = User.objects.create_user(
            username="kid-stats@example.com",
            email="kid-stats@example.com",
            password=self.password,
        )
        self.client.login(username=user.email, password=self.password)
        response = self.client.get(reverse("organizer_stats"))
        self.assertEqual(response.status_code, 404)

    def test_organizer_stats_page_for_moderator(self):
        voter = User.objects.create_user(
            username="voter-stats@example.com",
            email="voter-stats@example.com",
            password=self.password,
        )
        Vote.objects.create(drawing=self.published, user=voter)

        self.client.login(username=self.moderator.email, password=self.password)
        response = self.client.get(reverse("organizer_stats"), {"days": "14"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Статистика конкурса")
        self.assertContains(response, "Работы по категориям")
        self.assertContains(response, "Активность по дням")
        organizer = response.context["organizer"]
        self.assertEqual(organizer["overview"]["total"], 2)
        self.assertEqual(organizer["overview"]["published"], 1)
        self.assertEqual(organizer["overview"]["pending"], 1)
        self.assertEqual(organizer["overview"]["votes_total"], 2)
        self.assertEqual(len(organizer["by_category"]), 4)
        self.assertEqual(len(organizer["activity"]), 14)
        young = next(row for row in organizer["by_category"] if row["slug"] == "age-6-9")
        self.assertEqual(young["total"], 2)
        self.assertEqual(young["votes"], 2)


@override_settings(**CONTEST_SUBMISSION_OPEN)
class ContestPhaseTests(TestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.user = User.objects.create_user(
            username="phase@example.com",
            email="phase@example.com",
            password=self.password,
        )
        self.category = Category.objects.create(name="6–9 лет", slug="age-6-9", theme="6–9 лет")
        self.png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
            b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
            b"\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!"
            b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
        )

    def test_default_settings_use_submission_phase_before_september(self):
        from datetime import datetime
        from zoneinfo import ZoneInfo

        august = datetime(2026, 8, 29, 12, 0, 0, tzinfo=ZoneInfo("Europe/Moscow"))
        with override_settings(
            CONTEST_SUBMISSION_END="2026-09-07",
            CONTEST_RESULTS_START="2026-09-15",
        ):
            self.assertEqual(get_contest_phase(august), PHASE_SUBMISSION)
            september_voting = datetime(2026, 9, 10, 12, 0, 0, tzinfo=ZoneInfo("Europe/Moscow"))
            self.assertEqual(get_contest_phase(september_voting), PHASE_VOTING)
            september_results = datetime(2026, 9, 15, 12, 0, 0, tzinfo=ZoneInfo("Europe/Moscow"))
            self.assertEqual(get_contest_phase(september_results), PHASE_RESULTS)

    def test_vote_allowed_during_submission_phase(self):
        drawing = Drawing.objects.create(
            user=self.user,
            title="Тест",
            author="Тест",
            age=8,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("phase.png", self.png, content_type="image/png"),
            is_approved=True,
            votes=0,
        )
        voter = User.objects.create_user(
            username="phase-voter@example.com",
            email="phase-voter@example.com",
            password=self.password,
        )
        with override_settings(**CONTEST_SUBMISSION_OPEN):
            self.client.login(username=voter.email, password=self.password)
            response = self.client.post(reverse("vote", args=[drawing.id]))
            self.assertEqual(response.status_code, 200)
            self.assertJSONEqual(response.content, {"success": True, "votes": 1, "voted": True})

    @override_settings(**CONTEST_VOTING_OPEN)
    def test_results_hidden_before_publication_date(self):
        response = self.client.get(reverse("results"))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.context["results_published"])
        self.assertContains(response, "15 сентября")

    @override_settings(**CONTEST_RESULTS_PUBLISHED)
    def test_results_show_winners_after_publication(self):
        winner = Drawing.objects.create(
            user=self.user,
            title="Победитель",
            author="Аня",
            age=8,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile("winner.png", self.png, content_type="image/png"),
            is_approved=True,
            votes=5,
        )
        response = self.client.get(reverse("results"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context["results_published"])
        self.assertContains(response, winner.title)

    @override_settings(**CONTEST_SUBMISSION_OPEN)
    def test_submit_blocked_after_submission_phase(self):
        with override_settings(**CONTEST_VOTING_OPEN):
            self.client.login(username=self.user.email, password=self.password)
            response = self.client.post(
                reverse("submit_drawing"),
                {
                    "image": SimpleUploadedFile("late.png", self.png, content_type="image/png"),
                    "title": "Поздняя работа",
                    "author_name": "Аня",
                    "age": "8",
                    "city": "Алматы",
                    "email": self.user.email,
                    "consent": "on",
                },
            )
            self.assertEqual(response.status_code, 403)
            self.assertIn("завершён", response.json()["error"])
            self.assertEqual(Drawing.objects.filter(user=self.user).count(), 0)
