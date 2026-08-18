from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)


urlpatterns = [
    path('admin/', admin.site.urls),

    # Documentacao da API
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Endpoints da aplicacao
    path('api/auth/', include('autenticacao.api.urls')),
    path('api/forum/', include('forum.api.urls')),
    path('api/notificacoes/', include('notificacoes.api.urls')),
    path('api/auditoria/', include('auditoria.api.urls')),
    path('api/voluntariado/', include('voluntariado.api.urls')),
    path('api/colaboracao/', include('colaboracao.api.urls')),
    path('api/busca/', include('busca.api.urls')),
]

# ===== Interface =====
#
# Em producao, o mesmo processo que responde a API entrega tambem o build do
# React. Qualquer endereco que nao seja /api/, /admin/ ou /media/ devolve o
# index.html, e o roteamento passa a ser resolvido no navegador.
#
# Sem esta rota, atualizar a pagina em /forum ou /perfil produziria 404: o
# servidor procuraria um arquivo com esse nome, que nao existe, porque a rota
# so faz sentido depois que a aplicacao carregou.
if not settings.DEBUG:
    from django.views.generic import TemplateView

    urlpatterns += [
        re_path(
            r'^(?!api/|admin/|media/|static/).*$',
            TemplateView.as_view(template_name='index.html'),
            name='interface',
        ),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)