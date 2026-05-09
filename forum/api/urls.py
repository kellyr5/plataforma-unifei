from rest_framework.routers import DefaultRouter

from forum.api.views import (
    DisciplinaViewSet,
    PostViewSet,
    AlertaConteudoViewSet,
    PermissaoDisciplinaViewSet,
)


router = DefaultRouter()
router.register(r'disciplinas', DisciplinaViewSet, basename='disciplina')
router.register(r'posts', PostViewSet, basename='post')
router.register(r'alertas', AlertaConteudoViewSet, basename='alerta')
router.register(r'permissoes', PermissaoDisciplinaViewSet, basename='permissao')

urlpatterns = router.urls
