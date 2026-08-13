"""
Diagnostico da pagina inicial do professor e do monitor.

Uso:
    python manage.py shell < docs/diagnostico.py

Confere o vinculo no banco e exercita o endpoint, para separar tres cenarios:
falta de vinculo, erro na consulta, ou erro na serializacao.
"""

import traceback

from rest_framework.test import APIClient

from autenticacao.models import Usuario
from forum.models import PermissaoDisciplina

for cpf, quem in [('10000000002', 'PROFESSOR'), ('10000000003', 'MONITORA')]:
    pessoa = Usuario.objects.filter(cpf=cpf).first()

    print(f'\n{"=" * 60}')
    print(f'{quem}: {pessoa}')
    print('=' * 60)

    if pessoa is None:
        print('NAO EXISTE. Rode: python manage.py criar_perfis_demo')
        continue

    vinculos = PermissaoDisciplina.objects.filter(
        usuario=pessoa, ativo=True,
    ).select_related('disciplina')

    print(f'\nVinculos ativos: {vinculos.count()}')
    for vinculo in vinculos:
        print(
            f'  {vinculo.papel:<10} {vinculo.disciplina.codigo:<8} '
            f'periodo={vinculo.disciplina.periodo_sugerido} '
            f'semestre={vinculo.disciplina.semestre}'
        )

    cliente = APIClient()
    cliente.force_authenticate(user=pessoa)

    for rota in ['/api/forum/minhas-disciplinas/',
                 '/api/forum/minhas-disciplinas/?papel=monitor',
                 '/api/auth/me/']:
        print(f'\n--- GET {rota} ---')
        try:
            resposta = cliente.get(rota)
            print(f'status: {resposta.status_code}')

            dados = resposta.data
            if 'me' in rota:
                print(
                    f"e_professor={dados.get('e_professor')} "
                    f"e_monitor={dados.get('e_monitor')} "
                    f"e_coordenacao={dados.get('e_coordenacao')} "
                    f"rotulo={dados.get('rotulo_perfil')}"
                )
            else:
                print(f"resumo: {dados.get('resumo')}")
                for item in dados.get('disciplinas', []):
                    print(
                        f"  {item['codigo']:<8} papel={item['meu_papel']:<10} "
                        f"duvidas={item['total_topicos']} "
                        f"sem_resposta={item['sem_resposta']} "
                        f"matriculados={item['matriculados']}"
                    )
        except Exception:
            print('EXCECAO:')
            traceback.print_exc()
