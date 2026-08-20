from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from .models import Category, Drawing, Vote


class AuthFlowTests(TestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.user = User.objects.create_user(
            username="kid@example.com",
            email="kid@example.com",
            password=self.password,
        )
        self.category = Category.objects.create(name="6–9 лет", slug="age-6-9", theme="6–9 лет")

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
            (
                b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
                b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
                b"\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!"
                b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
            ),
            content_type="image/png",
        )

        response = self.client.post(
            reverse("submit_drawing"),
            {
                "image": png,
                "title": "Дом у леса",
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
        self.assertTrue(bool(drawing.image_blob))


class HomePageTests(TestCase):
    def test_homepage_always_shows_all_age_topic_cards_without_gallery_links(self):
        response = self.client.get(reverse("index"))
        self.assertEqual(response.status_code, 200)

        self.assertContains(response, "6–9 лет")
        self.assertContains(response, "10–13 лет")
        self.assertContains(response, "14–17 лет")
        self.assertContains(response, "Мой чистый дом")
        self.assertContains(response, "Сохраним леса")
        self.assertContains(response, "Эко-город будущего")

        self.assertNotContains(response, "?category=age-6-9")
        self.assertNotContains(response, "?category=age-10-13")
        self.assertNotContains(response, "?category=age-14-17")


class VotingTests(TestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.user = User.objects.create_user(
            username="vote@example.com",
            email="vote@example.com",
            password=self.password,
        )
        self.category = Category.objects.create(name="10–13 лет", slug="age-10-13", theme="10–13 лет")
        self.drawing = Drawing.objects.create(
            user=self.user,
            title="Тест",
            author="Тест",
            age=10,
            city="Астана",
            email=self.user.email,
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

    def test_user_cannot_vote_twice(self):
        self.client.login(username=self.user.email, password=self.password)
        first = self.client.post(reverse("vote", args=[self.drawing.id]))
        second = self.client.post(reverse("vote", args=[self.drawing.id]))

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 403)
        self.assertEqual(Vote.objects.filter(drawing=self.drawing, user=self.user).count(), 1)


class GalleryTests(TestCase):
    def setUp(self):
        self.password = "StrongPass123!"
        self.user = User.objects.create_user(
            username="gallery@example.com",
            email="gallery@example.com",
            password=self.password,
        )
        self.category_6_9 = Category.objects.create(name="6–9 лет", slug="age-6-9", theme="6–9 лет")
        self.category_10_13 = Category.objects.create(name="10–13 лет", slug="age-10-13", theme="10–13 лет")
        self.category_14_17 = Category.objects.create(name="14–17 лет", slug="age-14-17", theme="14–17 лет")

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

    def test_gallery_shows_approved_and_pending_drawings(self):
        response = self.client.get(reverse("gallery"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.young_work.title)
        self.assertContains(response, self.middle_pending_work.title)
        self.assertContains(response, self.teen_work.title)

    def test_gallery_has_all_age_filters(self):
        response = self.client.get(reverse("gallery"))
        self.assertContains(response, "6–9 лет")
        self.assertContains(response, "10–13 лет")
        self.assertContains(response, "14–17 лет")

    def test_gallery_filters_by_middle_age_group(self):
        response = self.client.get(reverse("gallery"), {"category": "age-10-13"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.middle_pending_work.title)
        self.assertNotContains(response, self.young_work.title)
        self.assertNotContains(response, self.teen_work.title)

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
