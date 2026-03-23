import json
from datetime import date
from decimal import Decimal

import pytest
from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from stocks.ai_context import build_structured_context
from stocks.ai_providers import (
    AnthropicProvider,
    GeminiProvider,
    ProviderEvent,
    ProviderUsage,
    _extract_gemini_text_delta,
    _extract_gemini_usage,
)
from stocks.copilot import CopilotRequestError, current_ai_day, reconcile_budget, reserve_budget
from stocks.models import AIBudgetDay, AIUsageCounter, Company, FinancialFact, MetricSnapshot


class FakeProvider:
    name = "gemini"

    def ensure_configured(self):
        return None

    def estimate_reservation_usd(self, _text):
        return Decimal("0.2500")

    def calculate_actual_cost_usd(self, usage):
        if usage is None:
            return Decimal("0.0000")
        return Decimal("0.0500")

    def stream_response(self, *, system_prompt, conversation):
        assert "STRUCTURED_CONTEXT_JSON" in system_prompt
        assert conversation[-1]["role"] == "user"
        yield ProviderEvent(type="text", text="Revenue improved")
        yield ProviderEvent(type="usage", usage=ProviderUsage(input_tokens=120, output_tokens=40))


@pytest.fixture
def api_client():
    cache.clear()
    return APIClient()


@pytest.fixture
def company():
    company = Company.objects.create(
        cik="0000789019",
        ticker="MSFT",
        name="Microsoft Corporation",
        sector="Technology",
        industry="Software",
        current_price=Decimal("415.67"),
        market_cap=3_100_000_000_000,
        shares_outstanding=7_430_000_000,
        quote_updated_at=timezone.now(),
        facts_updated_at=timezone.now(),
    )

    MetricSnapshot.objects.create(
        company=company,
        pe_ratio=Decimal("28.40"),
        dividend_yield=Decimal("0.0085"),
        revenue_growth_yoy=Decimal("0.1200"),
        operating_margin=Decimal("0.4400"),
        net_margin=Decimal("0.3600"),
        free_cash_flow=Decimal("100000000000"),
    )

    for fiscal_year, revenue, net_income in (
        (2021, 168088000000, 61271000000),
        (2022, 198270000000, 72738000000),
        (2023, 211915000000, 72361000000),
        (2024, 245122000000, 88136000000),
    ):
        FinancialFact.objects.create(
            company=company,
            metric_key="revenue",
            period_type="annual",
            fiscal_year=fiscal_year,
            value=Decimal(str(revenue)),
            period_end=date(fiscal_year, 6, 30),
            filed_date=date(fiscal_year, 8, 1),
            source_form="10-K",
        )
        FinancialFact.objects.create(
            company=company,
            metric_key="net_income",
            period_type="annual",
            fiscal_year=fiscal_year,
            value=Decimal(str(net_income)),
            period_end=date(fiscal_year, 6, 30),
            filed_date=date(fiscal_year, 8, 1),
            source_form="10-K",
        )

    quarter_seed = (
        (2024, 1, 61858000000, 21939000000),
        (2024, 2, 64727000000, 22036000000),
        (2024, 3, 65600000000, 24667000000),
        (2024, 4, 62900000000, 21500000000),
    )
    for fiscal_year, quarter, revenue, net_income in quarter_seed:
        FinancialFact.objects.create(
            company=company,
            metric_key="revenue",
            period_type="quarterly",
            fiscal_year=fiscal_year,
            fiscal_quarter=quarter,
            value=Decimal(str(revenue)),
            period_end=date(2024, quarter * 3, 28),
            filed_date=date(2024, quarter * 3, 30),
            source_form="10-Q",
        )
        FinancialFact.objects.create(
            company=company,
            metric_key="net_income",
            period_type="quarterly",
            fiscal_year=fiscal_year,
            fiscal_quarter=quarter,
            value=Decimal(str(net_income)),
            period_end=date(2024, quarter * 3, 28),
            filed_date=date(2024, quarter * 3, 30),
            source_form="10-Q",
        )

    return company


def collect_stream(response):
    return "".join(
        chunk.decode("utf-8") if isinstance(chunk, bytes) else chunk
        for chunk in response.streaming_content
    )


@pytest.mark.django_db
def test_build_structured_context_has_stable_sections(company):
    context = build_structured_context(company)

    assert set(context.keys()) == {
        "identity",
        "freshness",
        "snapshot",
        "annual_series",
        "quarterly_series",
        "coverage",
    }
    assert context["identity"]["ticker"] == "MSFT"
    assert context["annual_series"][-1]["fiscal_year"] == 2024
    assert context["quarterly_series"][-1]["fiscal_quarter"] == 4
    assert context["coverage"]["annual_period_count"] == 4
    assert context["coverage"]["quarterly_period_count"] == 4


def test_gemini_chunk_normalization_extracts_delta_and_usage():
    payload_one = {
        "candidates": [{"content": {"parts": [{"text": "Revenue"}]}}],
        "usageMetadata": {"promptTokenCount": 20, "candidatesTokenCount": 5},
    }
    payload_two = {
        "candidates": [{"content": {"parts": [{"text": "Revenue improved"}]}}],
        "usageMetadata": {"promptTokenCount": 20, "candidatesTokenCount": 8},
    }

    delta_one, accumulated = _extract_gemini_text_delta(payload_one, "")
    delta_two, accumulated = _extract_gemini_text_delta(payload_two, accumulated)
    usage = _extract_gemini_usage(payload_two)

    assert delta_one == "Revenue"
    assert delta_two == " improved"
    assert accumulated == "Revenue improved"
    assert usage.input_tokens == 20
    assert usage.output_tokens == 8


def test_gemini_provider_disables_thinking_for_grounded_copilot(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 200

        def iter_lines(self, decode_unicode=True):
            yield 'data: {"candidates":[{"content":{"parts":[{"text":"Stable answer"}]}}]}'
            yield 'data: {"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":4}}'

    def fake_post(url, json=None, stream=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        captured["stream"] = stream
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr("stocks.ai_providers.requests.post", fake_post)

    with override_settings(
        AI_PROVIDER="gemini",
        GEMINI_API_KEY="test-key",
        GEMINI_MODEL="gemini-2.5-flash",
        GEMINI_THINKING_BUDGET=0,
    ):
        events = list(
            GeminiProvider().stream_response(
                system_prompt="system",
                conversation=[{"role": "user", "content": "hello"}],
            )
        )

    assert captured["stream"] is True
    assert captured["timeout"] == (5, settings.AI_PROVIDER_TIMEOUT_SECONDS)
    assert captured["json"]["generationConfig"]["thinkingConfig"]["thinkingBudget"] == 0
    assert [event.type for event in events] == ["text", "usage"]
    assert events[0].text == "Stable answer"
    assert events[1].usage == ProviderUsage(input_tokens=12, output_tokens=4)


def test_anthropic_provider_normalizes_text_and_usage(monkeypatch):
    class FakeFinalMessage:
        class usage:
            input_tokens = 12
            output_tokens = 7

    class FakeStream:
        text_stream = ["Alpha", " Beta"]

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get_final_message(self):
            return FakeFinalMessage()

    class FakeClient:
        class messages:
            @staticmethod
            def stream(**_kwargs):
                return FakeStream()

    import anthropic

    monkeypatch.setattr(anthropic, "Anthropic", lambda api_key: FakeClient())

    with override_settings(ANTHROPIC_API_KEY="test-key"):
        events = list(
            AnthropicProvider().stream_response(
                system_prompt="system",
                conversation=[{"role": "user", "content": "hello"}],
            )
        )

    assert [event.type for event in events] == ["text", "text", "usage"]
    assert events[0].text == "Alpha"
    assert events[1].text == " Beta"
    assert events[2].usage == ProviderUsage(input_tokens=12, output_tokens=7)


@pytest.mark.django_db
def test_budget_reserve_and_reconcile_updates_daily_state():
    reservation = reserve_budget(Decimal("0.4000"))
    reconcile_budget(reservation, Decimal("0.1750"))

    budget_day = AIBudgetDay.objects.get(day=current_ai_day())
    assert budget_day.reserved_cost_usd == Decimal("0.0000")
    assert budget_day.actual_cost_usd == Decimal("0.1750")
    assert budget_day.request_count == 1


@pytest.mark.django_db
@override_settings(AI_DAILY_BUDGET_USD=Decimal("1.00"))
def test_budget_reserve_blocks_when_cap_is_exhausted():
    reserve_budget(Decimal("0.8000"))

    with pytest.raises(CopilotRequestError) as exc_info:
        reserve_budget(Decimal("0.3000"))

    assert exc_info.value.code == "budget_exhausted"


@pytest.mark.django_db
def test_copilot_endpoint_streams_meta_text_done_and_sets_anon_cookie(api_client, company, monkeypatch):
    monkeypatch.setattr("stocks.copilot.get_ai_provider", lambda: FakeProvider())

    response = api_client.post(
        f"/api/companies/{company.ticker}/copilot/",
        {
            "message": "Why did revenue improve?",
            "history": [
                {"role": "user", "content": "Summarize the business."},
                {"role": "assistant", "content": "It sells software and cloud services."},
            ],
        },
        format="json",
    )

    stream_text = collect_stream(response)

    assert response.status_code == 200
    assert settings.AI_ANON_COOKIE in response.cookies
    assert '"type": "meta"' in stream_text
    assert '"type": "text"' in stream_text
    assert '"type": "done"' in stream_text
    assert '"remaining_quota": 9' in stream_text

    usage_counter = AIUsageCounter.objects.get(day=current_ai_day())
    budget_day = AIBudgetDay.objects.get(day=current_ai_day())
    assert usage_counter.request_count == 1
    assert budget_day.actual_cost_usd == Decimal("0.0500")


@pytest.mark.django_db
@override_settings(AI_DAILY_LIMIT_ANONYMOUS=1)
def test_copilot_endpoint_enforces_anonymous_daily_quota(api_client, company, monkeypatch):
    monkeypatch.setattr("stocks.copilot.get_ai_provider", lambda: FakeProvider())

    first = api_client.post(
        f"/api/companies/{company.ticker}/copilot/",
        {"message": "First prompt"},
        format="json",
    )
    collect_stream(first)

    second = api_client.post(
        f"/api/companies/{company.ticker}/copilot/",
        {"message": "Second prompt"},
        format="json",
    )

    assert second.status_code == 429
    payload = second.json()
    assert payload["code"] == "daily_limit_reached"
    assert payload["needs_auth_upgrade"] is True


@pytest.mark.django_db
@override_settings(AI_BURST_LIMIT_PER_MINUTE=1)
def test_copilot_endpoint_enforces_burst_limit(api_client, company, monkeypatch):
    monkeypatch.setattr("stocks.copilot.get_ai_provider", lambda: FakeProvider())

    first = api_client.post(
        f"/api/companies/{company.ticker}/copilot/",
        {"message": "First prompt"},
        format="json",
    )
    collect_stream(first)

    second = api_client.post(
        f"/api/companies/{company.ticker}/copilot/",
        {"message": "Second prompt"},
        format="json",
    )

    assert second.status_code == 429
    assert second.json()["code"] == "burst_limit_reached"


@pytest.mark.django_db
def test_copilot_endpoint_rejects_invalid_json(api_client, company):
    response = api_client.generic(
        "POST",
        f"/api/companies/{company.ticker}/copilot/",
        "{",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_json"


@pytest.mark.django_db
def test_copilot_endpoint_rejects_unknown_ticker(api_client, monkeypatch):
    monkeypatch.setattr("stocks.copilot.get_ai_provider", lambda: FakeProvider())

    response = api_client.post(
        "/api/companies/ZZZZ/copilot/",
        {"message": "Hello"},
        format="json",
    )

    assert response.status_code == 404
    assert response.json()["code"] == "unknown_ticker"


@pytest.mark.django_db
def test_copilot_endpoint_rejects_history_above_bound(api_client, company, monkeypatch):
    monkeypatch.setattr("stocks.copilot.get_ai_provider", lambda: FakeProvider())

    response = api_client.post(
        f"/api/companies/{company.ticker}/copilot/",
        {
            "message": "Hello",
            "history": [{"role": "user", "content": f"Question {index}"} for index in range(13)],
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"


@pytest.mark.django_db
@override_settings(AI_PROVIDER="gemini", GEMINI_API_KEY="")
def test_copilot_endpoint_reports_provider_unavailable(api_client, company):
    response = api_client.post(
        f"/api/companies/{company.ticker}/copilot/",
        {"message": "Hello"},
        format="json",
    )

    assert response.status_code == 503
    assert response.json()["code"] == "provider_unavailable"
