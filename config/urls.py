from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('autenticacao.api.urls')),
    path('api/forum/', include('forum.api.urls')),
]

# Servir arquivos de media em desenvolvimento (em producao, usar nginx/storage)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)