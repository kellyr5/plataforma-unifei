from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from autenticacao.api.views import (
    RegistroView,
    AtivacaoView,
    ReenvioCodigoView,
)


urlpatterns = [
    # Registro e ativacao
    path('register/', RegistroView.as_view(), name='register'),
    path('ativar/', AtivacaoView.as_view(), name='ativar'),
    path('reenviar-codigo/', ReenvioCodigoView.as_view(), name='reenviar_codigo'),

    # Login JWT
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('verify/', TokenVerifyView.as_view(), name='token_verify'),
]
