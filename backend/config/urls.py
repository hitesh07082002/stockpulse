from pathlib import Path

from django.contrib import admin
from django.conf import settings
from django.http import FileResponse, Http404
from django.urls import include, path, re_path


def spa_view(request):
    requested_path = request.path.lstrip('/')
    if Path(requested_path).suffix:
        raise Http404("Static asset not found")

    index_path = Path(settings.SPA_BUILD_DIR) / 'index.html'
    if not index_path.exists():
        raise Http404("SPA build not found")

    return FileResponse(index_path.open('rb'))

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('stocks.urls')),
    re_path(r'^(?!api/).*$' , spa_view, name='spa'),
]
