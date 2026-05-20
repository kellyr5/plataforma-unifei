from rest_framework.routers import DefaultRouter

from notificacoes.api.views import NotificacaoViewSet


router = DefaultRouter()
router.register(r'', NotificacaoViewSet, basename='notificacao')

urlpatterns = router.urls
