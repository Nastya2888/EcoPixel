from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone

PHASE_SUBMISSION = "submission"
PHASE_VOTING = "voting"
PHASE_RESULTS = "results"


def _contest_timezone() -> ZoneInfo:
    return ZoneInfo(getattr(settings, "CONTEST_TIMEZONE", "Europe/Moscow"))


def parse_contest_date(date_str: str, *, end_of_day: bool = False) -> datetime:
    year, month, day = (int(part) for part in date_str.strip().split("-"))
    tz = _contest_timezone()
    if end_of_day:
        return datetime(year, month, day, 23, 59, 59, tzinfo=tz)
    return datetime(year, month, day, 0, 0, 0, tzinfo=tz)


def submission_end_at() -> datetime:
    return parse_contest_date(settings.CONTEST_SUBMISSION_END, end_of_day=True)


def results_start_at() -> datetime:
    return parse_contest_date(settings.CONTEST_RESULTS_START, end_of_day=False)


def get_contest_phase(now: datetime | None = None) -> str:
    current = now or timezone.now()
    if current < results_start_at():
        if current <= submission_end_at():
            return PHASE_SUBMISSION
        return PHASE_VOTING
    return PHASE_RESULTS


def is_submission_open(now: datetime | None = None) -> bool:
    current = now or timezone.now()
    return current <= submission_end_at()


def is_voting_open(now: datetime | None = None) -> bool:
    # Likes are always available so participants can support works any time.
    return True


def are_results_published(now: datetime | None = None) -> bool:
    current = now or timezone.now()
    return current >= results_start_at()


def get_contest_status(now: datetime | None = None) -> dict:
    current = now or timezone.now()
    results_published = are_results_published(current)
    submission_end = submission_end_at()
    results_start = results_start_at()
    phase = get_contest_phase(current)

    countdown_target = None if results_published else results_start
    countdown_label_key = "" if results_published else "До объявления победителей"

    return {
        "phase": phase,
        "submission_open": is_submission_open(current),
        "voting_open": True,
        "results_published": results_published,
        "submission_end": submission_end,
        "voting_start": submission_end,
        "results_start": results_start,
        "countdown_target_iso": countdown_target.isoformat() if countdown_target else "",
        "countdown_label_key": countdown_label_key,
    }
