from rest_framework.routers import DefaultRouter

from forum.api.views import DisciplinaViewSet


router = DefaultRouter()
router.register(r'disciplinas', DisciplinaViewSet, basename='disciplina')

urlpatterns = router.urls
