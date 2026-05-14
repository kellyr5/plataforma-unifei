from rest_framework.routers import DefaultRouter

from voluntariado.api.views import (
    OportunidadeViewSet,
    InscricaoVoluntariadoViewSet,
    CertificadoViewSet,
)


router = DefaultRouter()
router.register(r'oportunidades', OportunidadeViewSet, basename='oportunidade')
router.register(r'inscricoes', InscricaoVoluntariadoViewSet, basename='inscricao')
router.register(r'certificados', CertificadoViewSet, basename='certificado')

urlpatterns = router.urls
