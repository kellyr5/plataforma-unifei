from django.urls import path
from rest_framework.routers import DefaultRouter

from colaboracao.api.views import (
    AcervoArquivosView,
    ConversaViewSet,
    GrupoTrabalhoViewSet,
    MensagemViewSet,
    SolicitacaoAjudaViewSet,
    TrabalhoViewSet,
)


router = DefaultRouter()
router.register(r'trabalhos', TrabalhoViewSet, basename='trabalho')
router.register(r'grupos', GrupoTrabalhoViewSet, basename='grupo')
router.register(r'conversas', ConversaViewSet, basename='conversa')
router.register(r'mensagens', MensagemViewSet, basename='mensagem')
router.register(r'ajuda', SolicitacaoAjudaViewSet, basename='ajuda')

urlpatterns = [
    # Fora do roteador de proposito: nao e um recurso com criacao, edicao e
    # remocao, e sim uma leitura que atravessa tres modelos. Registra-lo como
    # conjunto de visoes anunciaria operacoes que nao existem.
    path('arquivos/', AcervoArquivosView.as_view(), name='acervo-arquivos'),
    *router.urls,
]
