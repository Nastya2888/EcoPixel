from django import forms

from .models import Drawing


class DrawingSubmissionForm(forms.ModelForm):
    class Meta:
        model = Drawing
        fields = ["author", "age", "city", "email", "category"]
