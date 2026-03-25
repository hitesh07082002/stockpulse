from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from stocks.models import AIUsageCounter, Company, FinancialFact, IngestionRun, MetricSnapshot, PriceCache, RawSecPayload


@pytest.fixture
def admin_client():
    User = get_user_model()
    user = User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="StockPulse123!",
    )
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def admin_company():
    return Company.objects.create(
        cik="0000789019",
        ticker="MSFT",
        name="Microsoft Corporation",
        exchange="NASDAQ",
        sector="Technology",
        industry="Software",
        current_price=Decimal("415.67"),
        market_cap=3_100_000_000_000,
        shares_outstanding=7_430_000_000,
        quote_updated_at=timezone.now(),
        facts_updated_at=timezone.now(),
    )


@pytest.fixture
def admin_objects(admin_company):
    FinancialFact.objects.create(
        company=admin_company,
        metric_key="revenue",
        period_type="annual",
        fiscal_year=2024,
        value=Decimal("245122000000"),
        period_end=date(2024, 6, 30),
        filed_date=date(2024, 8, 1),
        source_form="10-K",
    )
    MetricSnapshot.objects.create(
        company=admin_company,
        pe_ratio=Decimal("28.40"),
        net_margin=Decimal("0.3600"),
        roe=Decimal("0.3200"),
        debt_to_equity=Decimal("0.4500"),
    )
    IngestionRun.objects.create(
        company=admin_company,
        source=IngestionRun.SOURCE_SEC,
        status=IngestionRun.STATUS_SUCCESS,
        details_json={"records": 12},
        completed_at=timezone.now(),
    )
    PriceCache.objects.create(
        company=admin_company,
        range_key="1Y",
        sampling_granularity="daily",
        data_json=[],
        is_stale=False,
        source_updated_at=timezone.now(),
    )
    RawSecPayload.objects.create(
        company=admin_company,
        source=RawSecPayload.SOURCE_COMPANYFACTS,
        status=RawSecPayload.STATUS_SUCCESS,
        payload_json={"facts": {}},
    )
    AIUsageCounter.objects.create(
        usage_key_hash="anon-hash",
        day=date(2026, 3, 25),
        request_count=3,
    )
    return admin_company


@pytest.mark.django_db
def test_admin_login_redirects_for_anonymous_user():
    client = Client()

    response = client.get("/admin/")

    assert response.status_code == 302
    assert response["Location"].startswith("/admin/login/")


@pytest.mark.django_db
def test_admin_index_loads_for_superuser(admin_client, admin_objects):
    response = admin_client.get("/admin/")

    assert response.status_code == 200
    html = response.content.decode()
    assert "StockPulse Admin" in html
    assert "Companies" in html
    assert "Ai usage counters" in html


@pytest.mark.django_db
@pytest.mark.parametrize(
    "url_name",
    [
        "admin:stocks_company_changelist",
        "admin:stocks_financialfact_changelist",
        "admin:stocks_metricsnapshot_changelist",
        "admin:stocks_ingestionrun_changelist",
        "admin:stocks_pricecache_changelist",
        "admin:stocks_rawsecpayload_changelist",
        "admin:stocks_aiusagecounter_changelist",
    ],
)
def test_registered_admin_changelists_render(admin_client, admin_objects, url_name):
    response = admin_client.get(reverse(url_name))

    assert response.status_code == 200
