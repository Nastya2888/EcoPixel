from django.urls import path

from . import views


urlpatterns = [
    path("", views.index, name="index"),
    path("register/", views.register, name="register"),
    path("login/", views.user_login, name="login"),
    path("logout/", views.user_logout, name="logout"),
    path("profile/", views.profile, name="profile"),
    path("profile/restore-image/<int:pk>/", views.restore_drawing_image, name="restore_drawing_image"),
    path("gallery/", views.gallery, name="gallery"),
    path("drawing-image/<int:pk>/", views.drawing_image, name="drawing_image"),
    path("work/<int:pk>/", views.work_detail, name="work_detail"),
    path("rules/", views.rules, name="rules"),
    path("results/", views.results, name="results"),
    path("draw/", views.draw, name="draw"),
    path("draw/submit/", views.submit_drawing, name="submit_drawing"),
    path("vote/<int:pk>/", views.vote, name="vote"),
    path("certificate/<int:pk>/", views.certificate, name="certificate"),
]
