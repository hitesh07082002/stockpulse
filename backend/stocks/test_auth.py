from urllib.parse import parse_qs, urlsplit

import pytest
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from stocks.auth_services import link_or_create_google_user


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_register_sets_auth_cookies_and_session(api_client):
    response = api_client.post(
        "/api/auth/register/",
        {"email": "oracle@example.com", "password": "StockPulse123!", "name": "Oracle User"},
        format="json",
    )

    assert response.status_code == 201
    payload = response.json()

    assert payload["is_authenticated"] is True
    assert payload["user"]["email"] == "oracle@example.com"
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies

    session_response = api_client.get("/api/auth/session/")
    assert session_response.status_code == 200
    assert session_response.json()["is_authenticated"] is True


@pytest.mark.django_db
def test_login_refresh_and_logout_flow(api_client):
    User = get_user_model()
    user = User.objects.create_user(
        username="oracle-user",
        email="oracle@example.com",
        password="StockPulse123!",
        first_name="Oracle",
        last_name="User",
    )

    login_response = api_client.post(
        "/api/auth/login/",
        {"email": "oracle@example.com", "password": "StockPulse123!"},
        format="json",
    )
    assert login_response.status_code == 200
    assert login_response.json()["user"]["email"] == user.email

    api_client.cookies.pop("access_token", None)
    refresh_response = api_client.post("/api/auth/refresh/", {}, format="json")
    assert refresh_response.status_code == 200
    assert refresh_response.json()["is_authenticated"] is True
    assert "access_token" in refresh_response.cookies

    logout_response = api_client.post("/api/auth/logout/", {}, format="json")
    assert logout_response.status_code == 200

    session_response = api_client.get("/api/auth/session/")
    assert session_response.status_code == 200
    assert session_response.json()["is_authenticated"] is False


@pytest.mark.django_db
def test_login_rejects_invalid_password(api_client):
    User = get_user_model()
    User.objects.create_user(
        username="oracle-user",
        email="oracle@example.com",
        password="StockPulse123!",
    )

    response = api_client.post(
        "/api/auth/login/",
        {"email": "oracle@example.com", "password": "wrong-password"},
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["error"] == "Invalid email or password."


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_google_callback_creates_new_user_and_sets_cookies(api_client, monkeypatch):
    start_response = api_client.get(
        "/api/auth/google/start/",
        {"next": "/stock/AAPL", "origin": "http://localhost:5173"},
    )
    assert start_response.status_code == 302
    state = parse_qs(urlsplit(start_response["Location"]).query)["state"][0]

    monkeypatch.setattr(
        "stocks.auth_views.exchange_google_code_for_tokens",
        lambda code: {"access_token": "google-access-token"},
    )
    monkeypatch.setattr(
        "stocks.auth_views.fetch_google_profile",
        lambda access_token: {
            "sub": "google-new-user",
            "email": "new-google-user@example.com",
            "email_verified": True,
            "name": "New Google User",
        },
    )

    response = api_client.get(
        "/api/auth/google/callback/",
        {"code": "test-code", "state": state},
    )

    assert response.status_code == 302
    assert response["Location"].startswith("http://localhost:5173/stock/AAPL")
    assert "auth=google-success" in response["Location"]
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies

    User = get_user_model()
    user = User.objects.get(email="new-google-user@example.com")
    assert user.first_name == "New"
    assert SocialAccount.objects.get(user=user, provider="google").uid == "google-new-user"
    email_address = EmailAddress.objects.get(user=user, email="new-google-user@example.com")
    assert email_address.verified is True


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_google_callback_auto_links_existing_email(api_client, monkeypatch):
    User = get_user_model()
    existing_user = User.objects.create_user(
        username="existing-user",
        email="existing@example.com",
        password="StockPulse123!",
        first_name="Existing",
    )

    start_response = api_client.get(
        "/api/auth/google/start/",
        {"next": "/stock/MSFT", "origin": "http://localhost:5173"},
    )
    state = parse_qs(urlsplit(start_response["Location"]).query)["state"][0]

    monkeypatch.setattr(
        "stocks.auth_views.exchange_google_code_for_tokens",
        lambda code: {"access_token": "google-access-token"},
    )
    monkeypatch.setattr(
        "stocks.auth_views.fetch_google_profile",
        lambda access_token: {
            "sub": "google-existing-user",
            "email": "existing@example.com",
            "email_verified": True,
            "name": "Existing User",
        },
    )

    response = api_client.get(
        "/api/auth/google/callback/",
        {"code": "test-code", "state": state},
    )

    assert response.status_code == 302
    assert SocialAccount.objects.get(provider="google", uid="google-existing-user").user_id == existing_user.id
    assert get_user_model().objects.filter(email="existing@example.com").count() == 1


@pytest.mark.django_db
def test_google_profile_auto_links_verified_email_without_duplicate_user():
    User = get_user_model()
    existing_user = User.objects.create_user(
        username="existing-user",
        email="existing@example.com",
        password="StockPulse123!",
    )

    user, created = link_or_create_google_user(
        {
            "sub": "google-existing-user",
            "email": "existing@example.com",
            "email_verified": True,
            "name": "Existing User",
        }
    )

    assert created is False
    assert user.id == existing_user.id
    assert SocialAccount.objects.get(provider="google", uid="google-existing-user").user_id == existing_user.id
    assert get_user_model().objects.filter(email="existing@example.com").count() == 1
