"""API da busca no forum."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from busca import services
from busca.api.serializers import ResultadoBuscaSerializer, montar_resultado


class BuscaForumView(APIView):
    """
    Procura publicacoes no forum das disciplinas de quem consulta.

    GET /api/busca/?q=texto&disciplina=<uuid>&limite=20

    A resposta traz o modo que respondeu:

        semantica  comparacao por significado, com relevancia por resultado
        textual    correspondencia dos termos digitados
        vazia      nenhum termo informado
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter('q', str, description='Texto procurado'),
            OpenApiParameter('disciplina', str, description='Restringe a uma disciplina'),
            OpenApiParameter('limite', int, description='Maximo de resultados (ate 50)'),
        ],
        responses={200: ResultadoBuscaSerializer(many=True)},
    )
    def get(self, request):
        consulta = request.query_params.get('q', '')
        disciplina = request.query_params.get('disciplina') or None

        try:
            limite = min(int(request.query_params.get('limite', 20)), 50)
        except ValueError:
            limite = 20

        resultados, modo = services.buscar(
            usuario=request.user,
            consulta=consulta,
            disciplina=disciplina,
            limite=limite,
        )

        return Response({
            'modo': modo,
            'total': len(resultados),
            'resultados': [
                montar_resultado(post, distancia) for post, distancia in resultados
            ],
        })
