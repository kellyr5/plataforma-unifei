from django.urls import path
from rest_framework.routers import DefaultRouter

from reputacao.api.views import (
    MinhaReputacaoView,
    RankingDisciplinaView,
    RankingSemestralViewSet,
)


router = DefaultRouter()
router.register(r'ranking-semestral', RankingSemestralViewSet, basename='ranking-semestral')

urlpatterns = [
    path('minha/', MinhaReputacaoView.as_view(), name='minha-reputacao'),
    path('disciplina/<uuid:disciplina_id>/', RankingDisciplinaView.as_view(), name='ranking-disciplina'),
]

urlpatterns += router.urls
