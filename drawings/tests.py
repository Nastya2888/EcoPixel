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
        self.category = Category.objects.create(name="14–17 лет", slug="age-14-17", theme="14–17 лет")
        image = SimpleUploadedFile(
            "gallery.png",
            (
                b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
                b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
                b"\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!"
                b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
            ),
            content_type="image/png",
        )
        self.approved = Drawing.objects.create(
            user=self.user,
            title="Опубликованная работа",
            author="Автор",
            age=14,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=image,
            is_approved=True,
            votes=1,
        )
        self.pending = Drawing.objects.create(
            user=self.user,
            title="Работа на модерации",
            author="Автор",
            age=14,
            city="Алматы",
            email=self.user.email,
            category=self.category,
            image=SimpleUploadedFile(
                "gallery2.png",
                (
                    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
                    b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
                    b"\x00\x00\nIDATx\x9cc`\x00\x00\x00\x02\x00\x01\xe2!"
                    b"\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
                ),
                content_type="image/png",
            ),
            is_approved=False,
            votes=0,
        )

    def test_gallery_shows_approved_and_pending_drawings(self):
        response = self.client.get(reverse("gallery"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.approved.title)
        self.assertContains(response, self.pending.title)

    def test_unapproved_drawing_vote_is_forbidden(self):
        self.client.login(username=self.user.email, password=self.password)
        response = self.client.post(reverse("vote", args=[self.pending.id]))
        self.assertEqual(response.status_code, 404)
