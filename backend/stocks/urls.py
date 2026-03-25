from django.urls import path
from . import auth_views, views

urlpatterns = [
    path('health/', views.health_view, name='health'),
    path('auth/session/', auth_views.session_view, name='auth-session'),
    path('auth/register/', auth_views.register_view, name='auth-register'),
    path('auth/login/', auth_views.login_view, name='auth-login'),
    path('auth/email-verification/resend/', auth_views.email_verification_resend_view, name='auth-email-verification-resend'),
    path('auth/email-verification/confirm/', auth_views.email_verification_confirm_view, name='auth-email-verification-confirm'),
    path('auth/password-reset/request/', auth_views.password_reset_request_view, name='auth-password-reset-request'),
    path('auth/password-reset/confirm/', auth_views.password_reset_confirm_view, name='auth-password-reset-confirm'),
    path('auth/refresh/', auth_views.refresh_view, name='auth-refresh'),
    path('auth/logout/', auth_views.logout_view, name='auth-logout'),
    path('auth/google/start/', auth_views.google_start_view, name='auth-google-start'),
    path('auth/google/callback/', auth_views.google_callback_view, name='auth-google-callback'),
    path('auth/google/mock-consent/', auth_views.google_mock_consent_view, name='auth-google-mock-consent'),
    path('companies/', views.CompanyListView.as_view(), name='company-list'),
    path('companies/<str:ticker>/', views.CompanyDetailView.as_view(), name='company-detail'),
    path('companies/<str:ticker>/financials/', views.financials_view, name='company-financials'),
    path('companies/<str:ticker>/prices/', views.prices_view, name='company-prices'),
    path('companies/<str:ticker>/valuation-inputs/', views.valuation_inputs_view, name='company-valuation-inputs'),
    path('companies/<str:ticker>/copilot/', views.chat_view, name='company-copilot'),
    path('screener/', views.ScreenerView.as_view(), name='screener'),
]
