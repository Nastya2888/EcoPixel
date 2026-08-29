from .contest import get_contest_status
from .translations import translate


def contest_status(request):
    status = get_contest_status()
    label_key = status.get("countdown_label_key") or ""
    status["countdown_label"] = translate(label_key) if label_key else ""
    return {"contest": status}
