from django.apps import AppConfig


class ColaboracaoConfig(AppConfig):
    """
    Trabalhos em grupo, conversas e pedidos de ajuda.

    Fica separado do forum de proposito: o forum e publico para a turma e
    permanente, enquanto a conversa de grupo e privada aos participantes e
    encerra com a disciplina. Sao regras de visibilidade opostas, e junta-las
    no mesmo app faria cada consulta carregar a excecao da outra.
    """

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'colaboracao'
    verbose_name = 'Colaboracao'
