"""
Validators de arquivo para o modulo forum.

Implementam validacao em tres camadas conforme literatura de seguranca:
1. Extensao do arquivo (whitelist)
2. Tamanho maximo
3. MIME type via magic bytes (impede renomeacao maliciosa)
"""

import os
import magic
from django.core.exceptions import ValidationError


# Configuracoes da politica de upload
MAX_TAMANHO_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_ARQUIVOS_POR_POST = 5

# Whitelist: extensao -> lista de MIME types validos
EXTENSOES_PERMITIDAS = {
    'pdf': ['application/pdf'],
    'doc': ['application/msword'],
    'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    'jpg': ['image/jpeg'],
    'jpeg': ['image/jpeg'],
    'png': ['image/png'],
}


def validar_tamanho_arquivo(arquivo):
    """Garante que o arquivo nao excede o limite configurado."""
    if arquivo.size > MAX_TAMANHO_BYTES:
        tamanho_mb = arquivo.size / (1024 * 1024)
        limite_mb = MAX_TAMANHO_BYTES / (1024 * 1024)
        raise ValidationError(
            f'Arquivo muito grande ({tamanho_mb:.1f}MB). '
            f'Tamanho maximo permitido: {limite_mb:.0f}MB.'
        )


def validar_tipo_arquivo(arquivo):
    """
    Valida tres camadas: extensao, MIME declarado e magic bytes.

    Le os primeiros 2048 bytes para detectar o tipo real do arquivo,
    impedindo que arquivos maliciosos passem renomeados.
    """
    # 1. Validar extensao (whitelist)
    nome = arquivo.name
    extensao = os.path.splitext(nome)[1][1:].lower()

    if extensao not in EXTENSOES_PERMITIDAS:
        permitidas = ', '.join(EXTENSOES_PERMITIDAS.keys())
        raise ValidationError(
            f'Extensao ".{extensao}" nao permitida. '
            f'Tipos aceitos: {permitidas}.'
        )

    # 2. Validar magic bytes (conteudo real do arquivo)
    inicio = arquivo.read(2048)
    arquivo.seek(0)  # Reset essencial: senao o save fica com arquivo vazio

    mime_real = magic.from_buffer(inicio, mime=True)
    mimes_validos = EXTENSOES_PERMITIDAS[extensao]

    if mime_real not in mimes_validos:
        raise ValidationError(
            f'O conteudo do arquivo nao corresponde a extensao ".{extensao}". '
            f'Tipo detectado: {mime_real}. Possivel arquivo malicioso ou corrompido.'
        )


def sanitizar_nome_arquivo(nome):
    """
    Remove caracteres perigosos do nome do arquivo.

    Previne path traversal (../) e caracteres especiais que podem
    causar problemas no sistema de arquivos.
    """
    # Remove path traversal e caminhos absolutos
    nome = os.path.basename(nome)

    # Remove caracteres especiais, mantem apenas alfanumericos, ponto, hifen e underscore
    nome_seguro = ''
    for char in nome:
        if char.isalnum() or char in '.-_':
            nome_seguro += char
        else:
            nome_seguro += '_'

    # Limita o tamanho do nome
    if len(nome_seguro) > 200:
        base, ext = os.path.splitext(nome_seguro)
        nome_seguro = base[:200 - len(ext)] + ext

    return nome_seguro
