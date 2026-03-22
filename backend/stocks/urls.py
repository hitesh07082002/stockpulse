from django.urls import path
from . import views

urlpatterns = [
    path('companies/', views.CompanyListView.as_view(), name='company-list'),
    path('companies/<str:ticker>/', views.CompanyDetailView.as_view(), name='company-detail'),
    path('companies/<str:ticker>/financials/', views.financials_view, name='company-financials'),
    path('companies/<str:ticker>/prices/', views.prices_view, name='company-prices'),
    path('companies/<str:ticker>/dcf-inputs/', views.dcf_inputs_view, name='company-dcf-inputs'),
    path('companies/<str:ticker>/chat/', views.chat_view, name='company-chat'),
    path('screener/', views.ScreenerView.as_view(), name='screener'),
]
