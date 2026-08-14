from rest_framework.routers import DefaultRouter

from colaboracao.api.views import (
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

urlpatterns = router.urls
