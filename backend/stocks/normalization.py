from datetime import date

from .metric_registry import (
    get_metric_definition_or_none,
    tag_priority,
    unit_matches_family,
)
from .xbrl_mapping import ANNUAL_FORMS


def _parse_iso_date(value):
    if not value:
        return None
    return date.fromisoformat(value)


def _duration_days(entry):
    start = _parse_iso_date(entry.get("start"))
    end = _parse_iso_date(entry.get("end"))
    if not start or not end:
        return None
    return (end - start).days + 1


def _is_amended(form_type):
    return form_type.endswith("/A") or form_type.endswith("-A")


def _entry_metric_key(entry):
    return entry.get("metric_key") or entry.get("metric")


def _canonical_metric_key(entries, metric_key=None):
    if metric_key:
        return metric_key
    for entry in entries:
        candidate = _entry_metric_key(entry)
        if candidate:
            return candidate
    return None


def _allowed_unit_family(metric_key, allowed_unit):
    metric = get_metric_definition_or_none(metric_key)
    if metric:
        return metric.allowed_unit_family
    return allowed_unit


def select_annual_fact(entries, allowed_unit="USD", metric_key=None):
    metric_key = _canonical_metric_key(entries, metric_key=metric_key)
    allowed_unit_family = _allowed_unit_family(metric_key, allowed_unit)
    candidates = []

    for entry in entries:
        entry_metric_key = _entry_metric_key(entry)
        if metric_key and entry_metric_key and entry_metric_key != metric_key:
            continue

        if not unit_matches_family(entry.get("unit"), allowed_unit_family):
            continue
        if entry.get("segment"):
            continue

        form_type = entry.get("form", "")
        if form_type not in ANNUAL_FORMS:
            continue

        duration_days = _duration_days(entry)
        if duration_days is None or not 330 <= duration_days <= 370:
            continue

        filed_at = _parse_iso_date(entry.get("filed"))
        filed_ordinal = filed_at.toordinal() if filed_at else 0
        candidates.append(
            (
                (
                    abs(duration_days - 365),
                    -filed_ordinal,
                    tag_priority(metric_key, entry.get("tag", "")),
                    entry.get("tag", ""),
                    entry.get("form", ""),
                    entry.get("end", ""),
                    entry.get("start", ""),
                ),
                entry,
            )
        )

    if not candidates:
        return None

    _, selected = min(candidates, key=lambda candidate: candidate[0])
    resolved_metric_key = metric_key or _entry_metric_key(selected)
    return {
        **selected,
        "metric": resolved_metric_key,
        "metric_key": resolved_metric_key,
        "source_tag": selected.get("tag", ""),
        "source_form": selected.get("form", ""),
        "is_amended": _is_amended(selected.get("form", "")),
        "selection_reason": "selected_annual_fact",
    }


def derive_quarter_from_ytd(previous_ytd, current_ytd):
    if not previous_ytd or not current_ytd:
        return None

    metric_key = _entry_metric_key(current_ytd) or _entry_metric_key(previous_ytd)
    if not metric_key or metric_key != _entry_metric_key(previous_ytd):
        return None

    metric = get_metric_definition_or_none(metric_key)
    allowed_unit_family = metric.allowed_unit_family if metric else current_ytd.get("unit")

    if not unit_matches_family(previous_ytd.get("unit"), allowed_unit_family):
        return None
    if not unit_matches_family(current_ytd.get("unit"), allowed_unit_family):
        return None

    if previous_ytd.get("fiscal_year") != current_ytd.get("fiscal_year"):
        return None

    current_quarter = current_ytd.get("fiscal_quarter")
    if current_quarter not in (2, 3):
        return None

    previous_value = previous_ytd.get("val")
    current_value = current_ytd.get("val")
    if previous_value is None or current_value is None:
        return None

    return {
        "metric": metric_key,
        "metric_key": metric_key,
        "fiscal_year": current_ytd.get("fiscal_year"),
        "fiscal_quarter": current_quarter,
        "value": current_value - previous_value,
        "unit": current_ytd.get("unit"),
        "source_tag": current_ytd.get("tag", ""),
        "source_form": current_ytd.get("form", ""),
        "is_derived": True,
        "selection_reason": "derived_from_ytd",
    }
