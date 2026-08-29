from django.conf import settings
from django.core.mail import send_mail
from django.urls import reverse


def send_notification(drawing, event_type, request=None):
    if not drawing.email:
        return

    if request is not None:
        work_url = request.build_absolute_uri(reverse("work_detail", kwargs={"pk": drawing.pk}))
    else:
        work_url = f"http://127.0.0.1:8000{reverse('work_detail', kwargs={'pk': drawing.pk})}"

    if event_type == "submitted":
        subject = "ЭкоПиксель: работа принята"
        message = (
            f"Ваша работа принята! Номер работы: #{drawing.pk}.\n"
            f"Ссылка: {work_url}"
        )
    elif event_type == "approved":
        subject = "ЭкоПиксель: работа опубликована"
        message = (
            "Ваша работа опубликована в галерее! "
            f"Голосуйте за неё: {work_url}"
        )
    elif event_type == "rejected":
        reason = (drawing.rejection_reason or "").strip() or "Не указана"
        subject = "ЭкоПиксель: работа отклонена"
        message = (
            f"Ваша работа «{drawing.title}» (#{drawing.pk}) не прошла модерацию.\n"
            f"Причина: {reason}\n\n"
            f"Вы можете посмотреть работу здесь: {work_url}\n"
            "Если хотите, создайте новый рисунок и отправьте его снова."
        )
    else:
        return

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[drawing.email],
        fail_silently=True,
    )
