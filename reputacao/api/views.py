from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from forum.models import Disciplina
from reputacao.models import UsuarioDisciplinaReputacao, RankingSemestral
from reputacao.api.serializers import (
    UsuarioDisciplinaReputacaoSerializer,
    RankingDisciplinaSerializer,
    RankingSemestralSerializer,
)
from config.permissions import IsAdminOrSuperuser


class MinhaReputacaoView(APIView):
    """
    GET /api/reputacao/minha/

    Retorna a reputacao do usuario autenticado em todas as disciplinas
    onde ele tem pontuacao registrada.
    """

    def get(self, request):
        reputacoes = UsuarioDisciplinaReputacao.objects.filter(
            usuario=request.user
        ).select_related('disciplina').order_by('-pontos')

        serializer = UsuarioDisciplinaReputacaoSerializer(reputacoes, many=True)
        return Response(serializer.data)


class RankingDisciplinaView(APIView):
    """
    GET /api/reputacao/disciplina/{disciplina_id}/

    Retorna o ranking ao vivo de uma disciplina, ordenado por pontos.
    Aceita ?limite=N para limitar o numero de posicoes (default 50).
    """

    def get(self, request, disciplina_id):
        disciplina = get_object_or_404(Disciplina, id=disciplina_id, deleted_at__isnull=True)

        try:
            limite = int(request.query_params.get('limite', 50))
        except ValueError:
            limite = 50

        reputacoes = UsuarioDisciplinaReputacao.objects.filter(
            disciplina=disciplina
        ).select_related('usuario').order_by('-pontos')[:limite]

        # Adiciona a posicao (1-indexed) a cada registro
        dados = []
        for posicao, rep in enumerate(reputacoes, start=1):
            rep.posicao = posicao
            dados.append(rep)

        serializer = RankingDisciplinaSerializer(dados, many=True)
        return Response({
            'disciplina': {
                'id': str(disciplina.id),
                'codigo': disciplina.codigo,
                'nome': disciplina.nome,
            },
            'ranking': serializer.data,
        })


class RankingSemestralViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta de rankings semestrais historicos.

    - GET /api/reputacao/ranking-semestral/ -- lista (filtros: disciplina, semestre)
    - POST /api/reputacao/ranking-semestral/gerar/ -- gera snapshot (so admin)
    """

    serializer_class = RankingSemestralSerializer

    def get_queryset(self):
        queryset = RankingSemestral.objects.select_related('disciplina', 'usuario')

        disciplina_id = self.request.query_params.get('disciplina')
        semestre = self.request.query_params.get('semestre')

        if disciplina_id:
            queryset = queryset.filter(disciplina_id=disciplina_id)
        if semestre:
            queryset = queryset.filter(semestre=semestre)

        return queryset

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[IsAdminOrSuperuser],
    )
    def gerar(self, request):
        """
        Gera um snapshot do ranking semestral de uma disciplina.

        Body esperado: {"disciplina": "<uuid>", "semestre": "2026.1"}
        Se ja existir ranking para essa disciplina/semestre, e substituido.
        """
        disciplina_id = request.data.get('disciplina')
        semestre = request.data.get('semestre', '').strip()

        if not disciplina_id or not semestre:
            return Response(
                {'detail': 'Os campos "disciplina" e "semestre" sao obrigatorios.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        disciplina = get_object_or_404(Disciplina, id=disciplina_id)

        # Remove ranking anterior do mesmo semestre/disciplina (substituicao)
        RankingSemestral.objects.filter(
            disciplina=disciplina,
            semestre=semestre,
        ).delete()

        reputacoes = UsuarioDisciplinaReputacao.objects.filter(
            disciplina=disciplina
        ).select_related('usuario').order_by('-pontos')

        registros = []
        for posicao, rep in enumerate(reputacoes, start=1):
            registros.append(RankingSemestral(
                disciplina=disciplina,
                semestre=semestre,
                usuario=rep.usuario,
                posicao=posicao,
                pontos=rep.pontos,
                nome_usuario=rep.usuario.nome_completo,
            ))

        RankingSemestral.objects.bulk_create(registros)

        return Response(
            {
                'detail': f'Ranking semestral gerado para {disciplina.codigo} - {semestre}.',
                'total_posicoes': len(registros),
            },
            status=status.HTTP_201_CREATED,
        )
