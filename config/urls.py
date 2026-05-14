from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('autenticacao.api.urls')),
    path('api/forum/', include('forum.api.urls')),
    path('api/notificacoes/', include('notificacoes.api.urls')),
    path('api/auditoria/', include('auditoria.api.urls')),
    path('api/voluntariado/', include('voluntariado.api.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)