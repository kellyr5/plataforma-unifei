from rest_framework.routers import DefaultRouter

from forum.api.views import (
    DisciplinaViewSet,
    PostViewSet,
    AlertaConteudoViewSet,
)


router = DefaultRouter()
router.register(r'disciplinas', DisciplinaViewSet, basename='disciplina')
router.register(r'posts', PostViewSet, basename='post')
router.register(r'alertas', AlertaConteudoViewSet, basename='alerta')

urlpatterns = router.urls
