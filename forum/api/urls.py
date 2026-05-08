from rest_framework.routers import DefaultRouter

from forum.api.views import DisciplinaViewSet, PostViewSet


router = DefaultRouter()
router.register(r'disciplinas', DisciplinaViewSet, basename='disciplina')
router.register(r'posts', PostViewSet, basename='post')

urlpatterns = router.urls
