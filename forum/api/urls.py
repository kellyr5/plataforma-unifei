from django.urls import path
from rest_framework.routers import DefaultRouter

from forum.api.views import (
    CursoViewSet,
    DisciplinaViewSet,
    PostViewSet,
    AlertaConteudoViewSet,
    PermissaoDisciplinaViewSet,
    ArquivoViewSet,
    MeuAndamentoView,
)


router = DefaultRouter()
router.register(r'cursos', CursoViewSet, basename='curso')
router.register(r'disciplinas', DisciplinaViewSet, basename='disciplina')
router.register(r'posts', PostViewSet, basename='post')
router.register(r'alertas', AlertaConteudoViewSet, basename='alerta')
router.register(r'permissoes', PermissaoDisciplinaViewSet, basename='permissao')
router.register(r'arquivos', ArquivoViewSet, basename='arquivo')

urlpatterns = [
    path('andamento/', MeuAndamentoView.as_view(), name='meu-andamento'),
]

urlpatterns += router.urls
