from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenVerifyView,
)

from autenticacao.api.views import (
    MeView,
    RegistroView,
    AtivacaoView,
    ReenvioCodigoView,
    LogoutView,
    RefreshView,
    BuscaUsuarioView,
    PreCadastroView,
)


urlpatterns = [
    # Registro e ativacao
    path('register/', RegistroView.as_view(), name='register'),
    path('ativar/', AtivacaoView.as_view(), name='ativar'),
    path('reenviar-codigo/', ReenvioCodigoView.as_view(), name='reenviar_codigo'),

    # Login JWT
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', RefreshView.as_view(), name='token_refresh'),
    path('verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),

    # Coordenacao
    path('usuarios/', BuscaUsuarioView.as_view(), name='busca-usuario'),
    path('pre-cadastro/', PreCadastroView.as_view(), name='pre-cadastro'),
]
