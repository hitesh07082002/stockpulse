from stocks.pricing import downsample_price_points


def test_downsample_price_points_preserves_daily_and_trading_day_data():
    points = [
        {"date": "2026-03-01", "adjusted_close": 100.0},
        {"date": "2026-03-02", "adjusted_close": 101.0},
    ]

    assert downsample_price_points(points, "daily") == points
    assert downsample_price_points(points, "trading-day") == points


def test_downsample_price_points_keeps_last_point_per_week():
    points = [
        {"date": "2026-03-02", "adjusted_close": 100.0},
        {"date": "2026-03-03", "adjusted_close": 101.0},
        {"date": "2026-03-10", "adjusted_close": 110.0},
        {"date": "2026-03-11", "adjusted_close": 111.0},
    ]

    result = downsample_price_points(points, "weekly")

    assert result == [
        {"date": "2026-03-03", "adjusted_close": 101.0},
        {"date": "2026-03-11", "adjusted_close": 111.0},
    ]


def test_downsample_price_points_keeps_last_point_per_month():
    points = [
        {"date": "2026-01-05", "adjusted_close": 90.0},
        {"date": "2026-01-29", "adjusted_close": 95.0},
        {"date": "2026-02-10", "adjusted_close": 98.0},
        {"date": "2026-02-28", "adjusted_close": 102.0},
    ]

    result = downsample_price_points(points, "monthly")

    assert result == [
        {"date": "2026-01-29", "adjusted_close": 95.0},
        {"date": "2026-02-28", "adjusted_close": 102.0},
    ]
