from collections import OrderedDict
from datetime import datetime, timedelta

import yfinance as yf
from django.utils import timezone

from .models import PriceCache


class PriceCacheUnavailable(Exception):
    pass


PRICE_RANGE_CONFIG = {
    "1M": {"period": "1mo", "ttl": timedelta(hours=6), "sampling": "daily"},
    "3M": {"period": "3mo", "ttl": timedelta(hours=6), "sampling": "daily"},
    "6M": {"period": "6mo", "ttl": timedelta(hours=6), "sampling": "daily"},
    "1Y": {"period": "1y", "ttl": timedelta(hours=6), "sampling": "trading-day"},
    "5Y": {"period": "5y", "ttl": timedelta(hours=24), "sampling": "weekly"},
    "MAX": {"period": "max", "ttl": timedelta(hours=24), "sampling": "monthly"},
}


def get_price_range_config(range_key):
    try:
        return PRICE_RANGE_CONFIG[range_key]
    except KeyError as exc:
        valid = ", ".join(PRICE_RANGE_CONFIG.keys())
        raise ValueError(f"Invalid price range '{range_key}'. Valid values: {valid}.") from exc


def serialize_history(history_frame):
    points = []
    for idx, row in history_frame.iterrows():
        adjusted_close = row.get("Adj Close", row.get("Close"))
        points.append(
            {
                "date": idx.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "adjusted_close": round(float(adjusted_close), 2),
                "volume": int(row["Volume"]),
            }
        )
    return points


def downsample_price_points(points, sampling):
    if sampling in {"daily", "trading-day"}:
        return points

    buckets = OrderedDict()
    for point in points:
        date_value = datetime.fromisoformat(point["date"])
        if sampling == "weekly":
            iso = date_value.isocalendar()
            key = (iso.year, iso.week)
        elif sampling == "monthly":
            key = (date_value.year, date_value.month)
        else:
            key = point["date"]
        buckets[key] = point

    return list(buckets.values())


def refresh_price_cache(company, range_key):
    config = get_price_range_config(range_key)
    stock = yf.Ticker(company.ticker)
    history = stock.history(period=config["period"], auto_adjust=False)

    if history.empty:
        points = []
    else:
        points = downsample_price_points(serialize_history(history), config["sampling"])

    cache, _ = PriceCache.objects.update_or_create(
        company=company,
        range_key=range_key,
        defaults={
            "sampling_granularity": config["sampling"],
            "data_json": points,
            "is_stale": False,
            "source_updated_at": timezone.now(),
        },
    )
    return cache


def is_price_cache_fresh(cache, range_key, now=None):
    if cache is None or cache.cached_at is None:
        return False

    now = now or timezone.now()
    ttl = get_price_range_config(range_key)["ttl"]
    return not cache.is_stale and cache.cached_at >= now - ttl


def build_price_payload(company, cache, range_key, stale=False, message=None):
    return {
        "ticker": company.ticker,
        "range": range_key,
        "sampling_granularity": cache.sampling_granularity if cache else get_price_range_config(range_key)["sampling"],
        "data": cache.data_json if cache else [],
        "stale": stale,
        "fetched_at": cache.source_updated_at.isoformat() if cache and cache.source_updated_at else None,
        "quote_updated_at": company.quote_updated_at.isoformat() if company.quote_updated_at else None,
        "message": message,
    }


def get_or_refresh_price_cache(company, range_key):
    range_key = range_key.upper()
    get_price_range_config(range_key)
    cache = PriceCache.objects.filter(company=company, range_key=range_key).first()

    if is_price_cache_fresh(cache, range_key):
        return build_price_payload(company, cache, range_key, stale=False)

    try:
        cache = refresh_price_cache(company, range_key)
    except Exception as exc:
        if cache and cache.data_json:
            PriceCache.objects.filter(pk=cache.pk).update(is_stale=True)
            cache.is_stale = True
            return build_price_payload(company, cache, range_key, stale=True)
        raise PriceCacheUnavailable(str(exc)) from exc

    if not cache.data_json:
        return build_price_payload(company, cache, range_key, stale=False, message="No price history available")

    return build_price_payload(company, cache, range_key, stale=False)
