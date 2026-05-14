"""
Servico do modulo voluntariado.

Centraliza a logica de transicao de inscricao para 'concluida' com
emissao automatica de certificado em PDF, garantindo atomicidade.
"""

import logging
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from weasyprint import HTML

from voluntariado.models import InscricaoVoluntariado, Certificado


logger = logging.getLogger(__name__)


def gerar_pdf_certificado(certificado: Certificado) -> ContentFile:
    """
    Renderiza o template HTML e converte para PDF via weasyprint.

    Retorna um ContentFile pronto para ser atribuido ao FileField
    do model Certificado.
    """
    url_validacao = (
        f'{getattr(settings, "URL_BASE_PUBLICA", "http://localhost:8000")}'
        f'/api/voluntariado/certificados/validar/{certificado.codigo_validacao}/'
    )

    html_string = render_to_string(
        'voluntariado/certificado.html',
        {
            'certificado': certificado,
            'url_validacao': url_validacao,
        },
    )

    pdf_bytes = BytesIO()
    HTML(string=html_string).write_pdf(target=pdf_bytes)
    pdf_bytes.seek(0)

    nome_arquivo = f'certificado_{certificado.codigo_validacao}.pdf'
    return nome_arquivo, ContentFile(pdf_bytes.read())


@transaction.atomic
def concluir_inscricao(
    inscricao: InscricaoVoluntariado,
    horas_realizadas: int,
    avaliacao_organizacao: str = '',
    avaliado_por=None,
) -> Certificado:
    """
    Marca a inscricao como concluida e emite o certificado correspondente.

    Operacao atomica: se a geracao do certificado falhar, o status da
    inscricao tambem nao e alterado (rollback automatico).
    """
    inscricao.status = 'concluida'
    inscricao.horas_realizadas = horas_realizadas
    inscricao.avaliacao_organizacao = avaliacao_organizacao
    if avaliado_por:
        inscricao.avaliado_por = avaliado_por
        inscricao.avaliado_em = timezone.now()
    inscricao.save()

    op = inscricao.oportunidade
    certificado = Certificado.objects.create(
        inscricao=inscricao,
        nome_estudante=inscricao.estudante.nome_completo,
        cpf_estudante=inscricao.estudante.cpf,
        nome_oportunidade=op.titulo,
        nome_organizacao=op.organizacao.nome_completo,
        area_atuacao=op.get_area_display(),
        local=op.local,
        data_inicio=op.data_inicio,
        data_fim=op.data_fim,
        horas_realizadas=horas_realizadas,
    )

    # Gera o PDF e anexa ao certificado
    try:
        nome_arquivo, conteudo = gerar_pdf_certificado(certificado)
        certificado.arquivo_pdf.save(nome_arquivo, conteudo, save=True)
    except Exception as exc:
        # Loga o erro mas nao quebra a operacao
        # O certificado ainda existe no banco e o PDF pode ser regenerado depois
        logger.error(
            f'Falha ao gerar PDF do certificado {certificado.codigo_validacao}: {exc}'
        )

    return certificado
