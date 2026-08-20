"""
Gera a planilha de requisitos funcionais e nao funcionais.

O levantamento parte do codigo implantado, e nao do planejamento do TCC1. A
diferenca entre os dois esta registrada na aba de divergencias, que e material
para a secao de resultados: nem toda mudanca de escopo e perda, e uma parte
delas foi decisao de projeto com justificativa.

Formato herdado das planilhas do TCC1, para que as tres sejam comparaveis.

Uso:
    python docs/gerar-requisitos.py
"""

from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

PASTA = Path('docs')
DESTINO_RF = PASTA / 'Requisitos_Funcionais_Plataforma_UNIFEI.xlsx'
DESTINO_RNF = PASTA / 'Requisitos_Não_Funcionais_Plataforma_UNIFEI.xlsx'

AZUL = '003364'
OLIVA = 'AEBD09'
CINZA_CLARO = 'F2F3F5'

FONTE = 'Arial'


# ---------------------------------------------------------------------------
# Requisitos funcionais
#
# Codigo, Requisito, Categoria, Descricao funcional, Descricao tecnica,
# Ator, Prioridade
# ---------------------------------------------------------------------------

FUNCIONAIS = [
    # --- Autenticacao ---
    ('RF-AUT-001', 'Autenticar por CPF', 'Autenticação',
     'Usuário entra na plataforma informando CPF e senha.',
     'POST /api/auth/login/. TokenObtainPairView do SimpleJWT com serializador '
     'próprio que aceita CPF no lugar de nome de usuário. O frontend remove '
     'pontuação antes de enviar. Retorna par de tokens: acesso de curta duração '
     'e renovação de longa. Recusa conta não ativada.',
     'Todos', 'CRÍTICA'),

    ('RF-AUT-002', 'Verificar vínculo institucional', 'Autenticação',
     'Sistema confirma que o CPF pertence a alguém da comunidade da UNIFEI '
     'antes de permitir o cadastro.',
     'POST /api/auth/pre-cadastro/. Consulta a base de vínculos previamente '
     'importada. Sem correspondência, o cadastro não prossegue — é o que '
     'sustenta a promessa de acesso restrito exibida na tela de entrada.',
     'Sistema', 'CRÍTICA'),

    ('RF-AUT-003', 'Ativar conta por código', 'Autenticação',
     'No primeiro acesso, a pessoa recebe um código por e-mail e o informa '
     'para ativar a conta e definir a senha.',
     'POST /api/auth/ativar/. Código de uso único com validade limitada, '
     'gravado com marcação de expiração. Ativa usuario.ativo e grava a senha '
     'com o hasher padrão do Django.',
     'Todos', 'ESSENCIAL'),

    ('RF-AUT-004', 'Reenviar código de ativação', 'Autenticação',
     'A pessoa solicita novo código quando o anterior expira ou não chega.',
     'POST /api/auth/reenviar-codigo/. Invalida o código anterior antes de '
     'emitir o novo, para que dois códigos válidos nunca coexistam.',
     'Todos', 'IMPORTANTE'),

    ('RF-AUT-005', 'Renovar token de acesso', 'Autenticação',
     'A sessão se mantém sem que a pessoa precise entrar de novo a cada '
     'expiração.',
     'POST /api/auth/refresh/. Rotaciona o token de renovação e registra o '
     'anterior na lista de negação em Redis. O frontend substitui os dois '
     'tokens: guardar o antigo derrubaria a sessão na renovação seguinte.',
     'Sistema', 'CRÍTICA'),

    ('RF-AUT-006', 'Encerrar sessão', 'Autenticação',
     'Usuário encerra a sessão e o token deixa de valer imediatamente.',
     'POST /api/auth/logout/. Insere o token de renovação na lista de negação. '
     'Sem isso, um token vazado continuaria válido até expirar naturalmente.',
     'Todos', 'ESSENCIAL'),

    ('RF-AUT-007', 'Consultar o próprio perfil', 'Autenticação',
     'Usuário vê seus dados, papéis e vínculos com disciplinas.',
     'GET /api/auth/me/. Devolve nome, curso, período atual derivado dos '
     'vínculos, papéis globais e a lista de disciplinas com o papel em cada '
     'uma. O período é o maior entre os vínculos, e não a média.',
     'Todos', 'ESSENCIAL'),

    ('RF-AUT-008', 'Editar o próprio perfil', 'Autenticação',
     'Usuário altera foto, biografia, gênero e data de nascimento.',
     'PATCH /api/auth/me/. Lista explícita de campos editáveis. Nome, CPF, '
     'matrícula e vínculos são da organização e não se alteram por aqui — '
     'permitir isso quebraria a correspondência com o registro institucional.',
     'Todos', 'IMPORTANTE'),

    ('RF-AUT-009', 'Localizar usuários', 'Autenticação',
     'Busca de pessoas por nome para atribuir papéis e montar grupos.',
     'GET /api/auth/usuarios/. Restrita a quem tem permissão de gestão na '
     'disciplina.',
     'Professor/Coordenação', 'IMPORTANTE'),

    ('RF-AUT-010', 'Exibir números públicos', 'Autenticação',
     'A tela de entrada mostra a quantidade de estudantes, tópicos e '
     'certificados, antes de qualquer autenticação.',
     'GET /api/auth/estatisticas/. Endpoint público com contagens agregadas, '
     'sem identificar ninguém. Substituiu valores fixos escritos no código: '
     'número inventado em tela institucional é problema de credibilidade.',
     'Visitante', 'DESEJÁVEL'),

    ('RF-AUT-011', 'Cadastrar participantes em lote', 'Autenticação',
     'A coordenação cadastra várias pessoas de uma vez, indicando o perfil de '
     'cada uma.',
     'Comando cadastrar_participantes, lendo CSV com CPF, e-mail, nome, perfil '
     'e disciplinas. A opção de conferência valida o arquivo inteiro antes de '
     'gravar qualquer linha. Não define senha: a conta nasce inativa e passa '
     'pelo primeiro acesso.',
     'Coordenação', 'IMPORTANTE'),

    # --- Forum ---
    ('RF-FOR-001', 'Listar disciplinas do vínculo', 'Fórum',
     'Usuário vê as disciplinas em que está matriculado ou que leciona.',
     'GET /api/forum/disciplinas/. Filtra por vínculo ativo. A coordenação '
     'enxerga o conjunto do curso, porque acompanha sem participar.',
     'Todos', 'ESSENCIAL'),

    ('RF-FOR-002', 'Publicar dúvida na disciplina', 'Fórum',
     'Usuário publica uma dúvida vinculada a uma disciplina específica.',
     'POST /api/forum/posts/. Exige vínculo com a disciplina. Aceita anexos, '
     'validados por tipo real e tamanho. É o vínculo entre a dúvida e a '
     'matéria que distingue a plataforma de um grupo de mensagens.',
     'Aluno/Monitor/Professor', 'CRÍTICA'),

    ('RF-FOR-003', 'Responder publicação', 'Fórum',
     'Usuário responde a uma dúvida publicada.',
     'POST /api/forum/posts/ com post_pai preenchido. Notifica o autor da '
     'dúvida.',
     'Aluno/Monitor/Professor', 'CRÍTICA'),

    ('RF-FOR-004', 'Consultar respostas', 'Fórum',
     'Visualização das respostas de uma dúvida, com a melhor destacada.',
     'GET /api/forum/posts/{id}/respostas/. Ordena colocando a melhor resposta '
     'primeiro e o restante por data.',
     'Todos', 'ESSENCIAL'),

    ('RF-FOR-005', 'Editar publicação própria', 'Fórum',
     'Autor corrige o que publicou.',
     'PUT /api/forum/posts/{id}/. Verifica autoria.',
     'Autor', 'IMPORTANTE'),

    ('RF-FOR-006', 'Remover publicação', 'Fórum',
     'Autor ou moderação remove uma publicação sem destruir o histórico.',
     'DELETE /api/forum/posts/{id}/. Exclusão lógica por deleted_at. O registro '
     'permanece para auditoria e para manter a integridade das respostas que '
     'dependiam dele.',
     'Autor/Moderação', 'IMPORTANTE'),

    ('RF-FOR-007', 'Registrar visualização', 'Fórum',
     'Sistema conta quantas vezes uma dúvida foi aberta.',
     'POST /api/forum/posts/{id}/visualizar/. Alimenta o painel de coordenação, '
     'que usa a razão entre visualizações e respostas para identificar dúvida '
     'muito vista e pouco respondida.',
     'Sistema', 'IMPORTANTE'),

    ('RF-FOR-008', 'Votar em resposta', 'Fórum',
     'Usuário indica que uma resposta ajudou.',
     'POST e DELETE /api/forum/posts/{id}/votar/. Restrição de unicidade por '
     'par usuário e publicação. O autor não vota na própria resposta.',
     'Aluno/Monitor/Professor', 'IMPORTANTE'),

    ('RF-FOR-009', 'Reagir a resposta', 'Fórum',
     'Reação rápida a uma resposta, sem escrever.',
     'POST e DELETE /api/forum/posts/{id}/reagir-persiste/. Válida apenas em '
     'respostas, não em dúvidas.',
     'Aluno/Monitor/Professor', 'DESEJÁVEL'),

    ('RF-FOR-010', 'Marcar melhor resposta', 'Fórum',
     'Autor da dúvida ou quem conduz a turma marca a resposta que resolveu.',
     'POST e DELETE /api/forum/posts/{id}/marcar-melhor/. Única por dúvida. É a '
     'única forma de reconhecimento que sobrou no projeto, e serve a quem '
     'consulta o tópico depois.',
     'Autor/Professor/Monitor', 'ESSENCIAL'),

    ('RF-FOR-011', 'Anexar arquivo à publicação', 'Fórum',
     'Usuário anexa documento ou imagem à dúvida ou resposta.',
     'POST /api/forum/arquivos/. Verifica o tipo real pela assinatura do '
     'arquivo, e não pela extensão, com python-magic. Limite de tamanho e lista '
     'de tipos aceitos aplicados no servidor.',
     'Aluno/Monitor/Professor', 'IMPORTANTE'),

    ('RF-FOR-012', 'Denunciar conteúdo', 'Fórum',
     'Usuário sinaliza conteúdo inadequado para análise da moderação.',
     'POST /api/forum/posts/{id}/denunciar/. Cria alerta com motivo e notifica '
     'quem modera a disciplina.',
     'Todos', 'ESSENCIAL'),

    ('RF-FOR-013', 'Assumir análise de denúncia', 'Fórum',
     'Moderador assume a denúncia, evitando análise duplicada.',
     'POST /api/forum/alertas/{id}/assumir/. Registra o responsável e muda a '
     'situação para em análise.',
     'Moderação', 'IMPORTANTE'),

    ('RF-FOR-014', 'Resolver denúncia', 'Fórum',
     'Moderador conclui a análise registrando a decisão.',
     'POST /api/forum/alertas/{id}/resolver/. Guarda a decisão e a '
     'justificativa, e notifica quem denunciou.',
     'Moderação', 'ESSENCIAL'),

    ('RF-FOR-015', 'Restringir publicação', 'Fórum',
     'Quem conduz a turma retira uma publicação de circulação por decisão '
     'pedagógica, informando o motivo.',
     'POST e DELETE /api/forum/posts/{id}/restringir/. Motivo obrigatório e '
     'comunicado ao autor. O autor continua vendo a própria publicação; os '
     'colegas, não. Distinta da denúncia: não pressupõe infração, e serve ao '
     'caso da resposta que entrega o exercício pronto.',
     'Professor/Monitor', 'ESSENCIAL'),

    ('RF-FOR-016', 'Gerir vínculos com disciplina', 'Fórum',
     'Professor ou coordenação atribui papéis de aluno, monitor e professor.',
     'API de permissões, com restrição de um papel por pessoa e disciplina, '
     'garantida no banco.',
     'Professor/Coordenação', 'ESSENCIAL'),

    ('RF-FOR-017', 'Promover aluno a monitor', 'Fórum',
     'Professor eleva um aluno da turma à condição de monitor.',
     'Troca o papel do vínculo existente. O monitor continua sendo estudante: '
     'mantém tudo que tinha e ganha a fila de monitoria.',
     'Professor', 'IMPORTANTE'),

    ('RF-FOR-018', 'Acompanhar percurso por disciplina', 'Fórum',
     'Usuário vê quantas dúvidas publicou, quantas respondeu e quantas '
     'respostas ajudaram, separado por matéria.',
     'GET /api/forum/andamento/. Agrega por disciplina.',
     'Aluno/Monitor', 'IMPORTANTE'),

    ('RF-FOR-019', 'Buscar no fórum', 'Fórum',
     'Usuário descreve a dúvida com as próprias palavras e encontra discussões '
     'relacionadas, mesmo sem acertar os termos exatos.',
     'GET /api/busca/. Dois modos. Semântico: compara vetores de 384 dimensões '
     'por distância de cosseno em pgvector, com modelo multilíngue. Textual: '
     'correspondência de termos. A resposta informa qual modo foi usado, e a '
     'queda para o textual é automática quando o modelo não está disponível.',
     'Todos', 'IMPORTANTE'),

    ('RF-FOR-020', 'Listar cursos cadastrados', 'Fórum',
     'A plataforma reconhece mais de um curso, cada um com sua matriz.',
     'GET /api/forum/cursos/. O modelo separa curso de disciplina para que a '
     'plataforma não fique presa a um único curso.',
     'Coordenação', 'IMPORTANTE'),

    ('RF-FOR-021', 'Filtrar e ordenar publicações', 'Fórum',
     'Usuário restringe a lista por disciplina e por situação, e escolhe a '
     'ordem.',
     'Parâmetros de consulta em GET /api/forum/posts/. Combináveis entre si e '
     'com a paginação.',
     'Todos', 'IMPORTANTE'),

    ('RF-FOR-022', 'Consultar anexos de uma publicação', 'Fórum',
     'Usuário vê e baixa os arquivos anexados a uma dúvida.',
     'GET /api/forum/posts/{id}/arquivos/.',
     'Todos', 'IMPORTANTE'),

    # --- Colaboracao ---
    ('RF-COL-001', 'Propor trabalho em grupo', 'Colaboração',
     'Professor cria um trabalho definindo quantidade de grupos, tamanho '
     'máximo, prazo e forma de montagem.',
     'POST /api/colaboracao/trabalhos/. Exige que a pessoa lecione a '
     'disciplina — a coordenação não passa nesta verificação, porque '
     'supervisionar não é participar da turma.',
     'Professor/Monitor', 'CRÍTICA'),

    ('RF-COL-002', 'Anexar material ao enunciado', 'Colaboração',
     'Professor anexa a especificação, a base de dados e o esqueleto de código '
     'ao próprio trabalho.',
     'POST /api/colaboracao/trabalhos/{id}/anexar/ e remoção correspondente. '
     'Lista de tipos aceitos e limite de tamanho no servidor. Fica no trabalho, '
     'e não no grupo: é material da turma inteira. Sem este espaço, o professor '
     'distribuiria por outro canal e o enunciado ficaria separado dos arquivos.',
     'Professor/Monitor', 'ESSENCIAL'),

    ('RF-COL-003', 'Criar grupos vazios', 'Colaboração',
     'Sistema gera os grupos previstos para que os alunos escolham onde entrar.',
     'POST /api/colaboracao/trabalhos/{id}/criar-grupos/. Cria a conversa '
     'privada de cada grupo junto.',
     'Professor/Monitor', 'ESSENCIAL'),

    ('RF-COL-004', 'Sortear a composição dos grupos', 'Colaboração',
     'Distribuição aleatória dos matriculados entre os grupos.',
     'POST /api/colaboracao/trabalhos/{id}/sortear/. Respeita o tamanho máximo '
     'e sincroniza os participantes das conversas.',
     'Professor/Monitor', 'IMPORTANTE'),

    ('RF-COL-005', 'Entrar em grupo', 'Colaboração',
     'Aluno escolhe o grupo de que quer participar.',
     'POST /api/colaboracao/grupos/{id}/entrar/. Recusa se o grupo estiver '
     'cheio ou se a pessoa já estiver em outro grupo do mesmo trabalho. Insere '
     'na conversa do grupo.',
     'Aluno', 'ESSENCIAL'),

    ('RF-COL-006', 'Sair de grupo', 'Colaboração',
     'Aluno deixa o grupo, com confirmação antes.',
     'POST /api/colaboracao/grupos/{id}/sair/. Remove da conversa e atualiza a '
     'contagem de participantes.',
     'Aluno', 'IMPORTANTE'),

    ('RF-COL-007', 'Definir responsável pelo grupo', 'Colaboração',
     'O grupo indica quem responde por ele.',
     'POST /api/colaboracao/grupos/{id}/definir-lider/.',
     'Aluno/Professor', 'DESEJÁVEL'),

    ('RF-COL-008', 'Conversar em tempo real no grupo', 'Colaboração',
     'Os integrantes trocam mensagens, imagens, documentos e áudio no espaço '
     'privado do grupo.',
     'GET e POST /api/colaboracao/conversas/{id}/mensagens/, com entrega '
     'imediata por WebSocket via Django Channels. A conversa é privada aos '
     'integrantes, inclusive em relação ao professor. É a decisão que sustenta '
     'o módulo: sem privacidade, os grupos migram para aplicativos externos e o '
     'material se perde no fim do semestre.',
     'Aluno', 'CRÍTICA'),

    ('RF-COL-009', 'Excluir mensagem enviada', 'Colaboração',
     'Autor apaga uma mensagem dentro de um prazo curto após o envio.',
     'DELETE /api/colaboracao/mensagens/{id}/. Janela de três minutos, '
     'verificação de autoria e exclusão lógica. Recusa se a mensagem já tiver '
     'originado um pedido de ajuda, para não apagar o que já foi encaminhado a '
     'terceiros. Anuncia a exclusão aos demais pelo WebSocket.',
     'Autor', 'IMPORTANTE'),

    ('RF-COL-010', 'Registrar leitura da conversa', 'Colaboração',
     'O contador de mensagens não lidas zera quando a pessoa abre a conversa.',
     'POST /api/colaboracao/conversas/{id}/marcar-lida/. O marcador fica no '
     'participante, e não na mensagem: guardar um registro por mensagem e por '
     'pessoa inviabilizaria qualquer conversa ativa.',
     'Aluno', 'IMPORTANTE'),

    ('RF-COL-011', 'Encaminhar dúvida do grupo', 'Colaboração',
     'O grupo marca uma mensagem e a encaminha a quem conduz a turma, com uma '
     'descrição do problema.',
     'POST /api/colaboracao/conversas/{id}/pedir-ajuda/. O destino é decidido '
     'pelo sistema: monitoria quando a disciplina tem monitor, professor quando '
     'não tem. Só a mensagem marcada e a descrição atravessam — a conversa em '
     'volta continua invisível.',
     'Aluno', 'ESSENCIAL'),

    ('RF-COL-012', 'Assumir pedido de ajuda', 'Colaboração',
     'Monitor ou professor assume o atendimento.',
     'POST /api/colaboracao/ajuda/{id}/assumir/. Evita que dois atendam o mesmo '
     'pedido.',
     'Monitor/Professor', 'IMPORTANTE'),

    ('RF-COL-013', 'Responder pedido de ajuda', 'Colaboração',
     'Quem assumiu responde e a resposta chega ao grupo.',
     'POST /api/colaboracao/ajuda/{id}/responder/. Registra a resposta e '
     'notifica os integrantes.',
     'Monitor/Professor', 'ESSENCIAL'),

    ('RF-COL-014', 'Reunir arquivos por disciplina', 'Colaboração',
     'Usuário encontra num lugar só todo o material que passou por ele, '
     'separado por matéria.',
     'GET /api/colaboracao/arquivos/. Reúne três origens: anexo de conversa, '
     'material de trabalho e anexo de publicação. Sem modelo novo e sem cópia: '
     'a consulta lê o que já está gravado, mantendo o recorte de permissão de '
     'cada origem. Anexo de conversa só aparece para quem participa dela.',
     'Aluno/Monitor/Professor', 'IMPORTANTE'),

    ('RF-COL-015', 'Consultar trabalhos da disciplina', 'Colaboração',
     'Usuário vê os trabalhos propostos, o prazo e a situação do próprio grupo.',
     'GET /api/colaboracao/trabalhos/. Filtra pelas disciplinas de vínculo. '
     'Quem não tem vínculo com nenhuma disciplina não alcança esta tela: a aba '
     'sequer aparece, porque toda ação disponível ali terminaria em erro.',
     'Aluno/Monitor/Professor', 'ESSENCIAL'),

    ('RF-COL-016', 'Consultar composição dos grupos', 'Colaboração',
     'Quem conduz a turma vê como os grupos ficaram formados.',
     'GET /api/colaboracao/grupos/. O professor enxerga a composição e o '
     'andamento, mas não entra na conversa privada da equipe.',
     'Professor/Monitor', 'ESSENCIAL'),

    ('RF-COL-017', 'Listar conversas com pendências', 'Colaboração',
     'Usuário vê suas conversas com a quantidade de mensagens por ler.',
     'GET /api/colaboracao/conversas/. Filtra por participação e calcula as não '
     'lidas a partir do marcador de leitura de cada participante.',
     'Aluno/Monitor/Professor', 'ESSENCIAL'),

    ('RF-COL-018', 'Acompanhar a fila de pedidos de ajuda', 'Colaboração',
     'Quem conduz a turma vê os pedidos abertos, em atendimento e resolvidos.',
     'GET /api/colaboracao/ajuda/. O destino do pedido decide quem o enxerga: '
     'monitoria quando a disciplina tem monitor, professor quando não tem.',
     'Monitor/Professor', 'ESSENCIAL'),

    # --- Voluntariado ---
    ('RF-VOL-001', 'Publicar oportunidade', 'Voluntariado',
     'Organização parceira cadastra uma ação de voluntariado com período, '
     'vagas, carga horária e local.',
     'POST /api/voluntariado/oportunidades/. Restrito ao perfil de organização.',
     'Organização', 'ESSENCIAL'),

    ('RF-VOL-002', 'Consultar oportunidades', 'Voluntariado',
     'Estudante vê as ações disponíveis, com filtro por situação e busca por '
     'texto.',
     'GET /api/voluntariado/oportunidades/. Informa vagas preenchidas e total.',
     'Aluno', 'ESSENCIAL'),

    ('RF-VOL-003', 'Inscrever-se em oportunidade', 'Voluntariado',
     'Estudante se candidata a uma vaga.',
     'POST /api/voluntariado/oportunidades/{id}/inscrever/. Unicidade por par '
     'pessoa e oportunidade. Verifica vaga disponível dentro de transação, para '
     'que duas inscrições simultâneas não ultrapassem o limite.',
     'Aluno', 'ESSENCIAL'),

    ('RF-VOL-004', 'Desistir da inscrição', 'Voluntariado',
     'Estudante cancela a própria inscrição e libera a vaga.',
     'POST /api/voluntariado/inscricoes/{id}/desistir/.',
     'Aluno', 'IMPORTANTE'),

    ('RF-VOL-005', 'Aprovar ou rejeitar inscrição', 'Voluntariado',
     'A organização decide quem participa.',
     'POST /api/voluntariado/inscricoes/{id}/aprovar/ e rejeitar. Notifica o '
     'candidato da decisão.',
     'Organização', 'ESSENCIAL'),

    ('RF-VOL-006', 'Remover participante', 'Voluntariado',
     'A organização retira alguém já aprovado.',
     'POST /api/voluntariado/inscricoes/{id}/remover/. Devolve a vaga.',
     'Organização', 'IMPORTANTE'),

    ('RF-VOL-007', 'Concluir participação', 'Voluntariado',
     'A organização confirma que a pessoa cumpriu a ação, o que dispara a '
     'emissão do certificado.',
     'POST /api/voluntariado/inscricoes/{id}/concluir/. Registra a conclusão e '
     'gera o certificado na sequência.',
     'Organização', 'CRÍTICA'),

    ('RF-VOL-008', 'Emitir certificado em PDF', 'Voluntariado',
     'Certificado de participação com código de verificação, para '
     'aproveitamento das horas como atividade complementar.',
     'Geração com WeasyPrint a partir de modelo HTML, com identidade visual da '
     'UNIFEI, dados da ação, carga horária e código único de conferência.',
     'Sistema', 'CRÍTICA'),

    ('RF-VOL-009', 'Consultar certificados', 'Voluntariado',
     'Estudante acessa e baixa os certificados que recebeu.',
     'GET /api/voluntariado/certificados/.',
     'Aluno', 'ESSENCIAL'),

    ('RF-VOL-010', 'Acompanhar inscritos', 'Voluntariado',
     'A organização vê quem se inscreveu e em que situação está cada inscrição.',
     'GET /api/voluntariado/oportunidades/{id}/inscricoes/.',
     'Organização', 'ESSENCIAL'),

    ('RF-VOL-011', 'Editar oportunidade publicada', 'Voluntariado',
     'A organização corrige dados da ação já publicada.',
     'PUT /api/voluntariado/oportunidades/{id}/. Verifica que a organização é a '
     'autora. Alteração de data notifica os inscritos.',
     'Organização', 'IMPORTANTE'),

    ('RF-VOL-012', 'Encerrar oportunidade', 'Voluntariado',
     'A organização encerra as inscrições sem apagar o registro.',
     'Alteração de situação, e não remoção. Quem participou precisa de um '
     'caminho de volta até a ação para alcançar o certificado.',
     'Organização', 'ESSENCIAL'),

    ('RF-VOL-013', 'Consultar as próprias inscrições', 'Voluntariado',
     'Estudante acompanha em que situação está cada candidatura.',
     'GET /api/voluntariado/inscricoes/minhas/.',
     'Aluno', 'ESSENCIAL'),

    # --- Paineis por perfil ---
    ('RF-PAI-001', 'Painel de quem conduz a turma', 'Painéis',
     'Professor e monitor veem, num lugar só, as dúvidas sem resposta, os '
     'pedidos de ajuda abertos e os trabalhos em andamento das suas turmas.',
     'Composição das consultas dos módulos, restrita às disciplinas em que a '
     'pessoa leciona ou exerce monitoria. O monitor vê apenas onde é monitor.',
     'Professor/Monitor', 'ESSENCIAL'),

    ('RF-PAI-002', 'Painel da organização parceira', 'Painéis',
     'A organização vê suas oportunidades, quantos se inscreveram e quantos '
     'concluíram.',
     'Restrito às oportunidades da própria organização. A organização não '
     'participa do fórum: publica ações, acompanha inscrições e emite '
     'certificados.',
     'Organização', 'ESSENCIAL'),

    # --- Notificacoes ---
    ('RF-NOT-001', 'Entregar notificação em tempo real', 'Notificações',
     'O aviso chega sem recarregar a página.',
     'WebSocket em /ws/notificacoes/ com Django Channels sobre Daphne. Sala por '
     'usuário. Camada em Redis quando disponível, com queda para camada em '
     'memória em implantação de instância única.',
     'Sistema', 'ESSENCIAL'),

    ('RF-NOT-002', 'Listar notificações', 'Notificações',
     'Usuário vê o histórico de avisos e quantos estão por ler.',
     'GET /api/notificacoes/ e /nao-lidas/.',
     'Todos', 'ESSENCIAL'),

    ('RF-NOT-003', 'Marcar notificação como lida', 'Notificações',
     'Usuário marca um aviso ou todos de uma vez.',
     'POST /api/notificacoes/{id}/marcar-lida/ e /marcar-todas-lidas/.',
     'Todos', 'IMPORTANTE'),

    ('RF-NOT-004', 'Limpar notificações', 'Notificações',
     'Usuário descarta os avisos já lidos.',
     'POST /api/notificacoes/limpar/.',
     'Todos', 'DESEJÁVEL'),

    ('RF-NOT-005', 'Agrupar aviso por conversa', 'Notificações',
     'Uma conversa com muitas mensagens novas gera um aviso, e não um por '
     'mensagem.',
     'Enquanto houver aviso não lido daquela conversa, não se cria outro. Sem '
     'isso, uma discussão ativa produziria dezenas de avisos e a pessoa '
     'desligaria todos.',
     'Sistema', 'IMPORTANTE'),

    # --- Perfil e acompanhamento ---
    ('RF-PRF-001', 'Visualizar perfil', 'Perfil',
     'Usuário vê seus dados, foto, curso, período e disciplinas.',
     'Compõe dados de /api/auth/me/ com o andamento por disciplina.',
     'Todos', 'ESSENCIAL'),

    ('RF-PRF-002', 'Consultar histórico de participação', 'Perfil',
     'Usuário vê suas publicações, inscrições e certificados reunidos.',
     'Agrega as consultas de cada módulo na tela de perfil.',
     'Todos', 'IMPORTANTE'),

    # --- Coordenacao ---
    ('RF-COO-001', 'Acompanhar o curso por disciplina', 'Coordenação',
     'A coordenação vê o movimento de cada disciplina do curso: volume de '
     'dúvidas, proporção respondida e tempo até a primeira resposta.',
     'Painel que agrega por disciplina e período. Identifica disciplina com '
     'muita dúvida sem resposta, que é o sinal que o painel existe para '
     'produzir.',
     'Coordenação', 'ESSENCIAL'),

    ('RF-COO-002', 'Detalhar uma disciplina', 'Coordenação',
     'A coordenação abre uma disciplina e vê as dúvidas mais vistas e as sem '
     'resposta.',
     'Consulta por disciplina, ordenada pela razão entre visualizações e '
     'respostas.',
     'Coordenação', 'IMPORTANTE'),

    ('RF-COO-003', 'Importar a matriz curricular', 'Coordenação',
     'As disciplinas do curso entram na plataforma a partir do projeto '
     'pedagógico.',
     'Comando importar_matriz_ppc, que lê o ementário e cadastra código, nome, '
     'período e carga horária. A paridade do período define o semestre de '
     'oferta.',
     'Coordenação', 'IMPORTANTE'),

    # --- Auditoria ---
    ('RF-AUD-001', 'Registrar ações sensíveis', 'Auditoria',
     'Ações de moderação e de gestão de vínculos ficam registradas.',
     'Modelo de registro de auditoria, com autor, ação, alvo e momento. '
     'Consulta restrita à administração.',
     'Sistema', 'IMPORTANTE'),

    # --- Sistema ---
    ('RF-SIS-001', 'Alternar entre tema claro e escuro', 'Sistema',
     'Usuário escolhe o tema e a escolha permanece entre visitas.',
     'Alternância por variáveis de cor no navegador, com a preferência '
     'guardada localmente. Todas as cores da interface vêm dessas variáveis: '
     'valor fixo escrito no código produz texto ilegível num dos dois temas.',
     'Todos', 'IMPORTANTE'),

    ('RF-SIS-002', 'Consultar a documentação da API', 'Sistema',
     'A especificação da API fica acessível e navegável.',
     'Esquema OpenAPI gerado por drf-spectacular a partir das views e '
     'serializadores, com interface de navegação.',
     'Desenvolvedor', 'IMPORTANTE'),

    ('RF-SIS-003', 'Carregar dados de demonstração', 'Sistema',
     'A plataforma pode ser povoada com um semestre completo para '
     'demonstração e avaliação.',
     'Comando popular_demonstracao, com semente fixa para que a mesma execução '
     'produza sempre o mesmo conjunto. Gera disciplinas com ritmos distintos de '
     'atividade, deliberadamente incluindo uma sem professor atribuído, para '
     'que o painel de coordenação tenha o que apontar.',
     'Coordenação', 'IMPORTANTE'),
]


# ---------------------------------------------------------------------------
# Requisitos nao funcionais
#
# Codigo, Requisito, Categoria, Descricao funcional, Descricao tecnica,
# Prioridade
# ---------------------------------------------------------------------------

NAO_FUNCIONAIS = [
    # --- Seguranca ---
    ('RNF-SEG-001', 'Autenticação por token com expiração', 'Segurança',
     'A sessão expira sozinha e o token deixa de valer quando a pessoa sai.',
     'SimpleJWT com par de tokens. O de renovação é rotacionado a cada uso e o '
     'anterior vai para a lista de negação em Redis. Sem a lista, um token '
     'vazado continuaria válido até expirar naturalmente, e o encerramento de '
     'sessão seria apenas visual.',
     'CRÍTICA'),

    ('RNF-SEG-002', 'Senha armazenada com hash', 'Segurança',
     'A senha nunca é guardada de forma recuperável.',
     'Hasher padrão do Django, com PBKDF2 e sal por usuário. Nenhum ponto do '
     'sistema lê a senha em texto claro, inclusive os comandos de carga: o '
     'cadastro em lote cria a conta sem senha utilizável.',
     'CRÍTICA'),

    ('RNF-SEG-003', 'Controle de acesso por papel e vínculo', 'Segurança',
     'Cada pessoa só alcança o que corresponde ao seu papel na disciplina.',
     'Verificação no servidor a cada requisição, combinando papel global e '
     'vínculo com a disciplina. Duas funções distintas: moderar, pela qual a '
     'administração passa, e lecionar, pela qual não. A ocultação de abas no '
     'menu é conveniência de interface, nunca o controle em si.',
     'CRÍTICA'),

    ('RNF-SEG-004', 'Negar existência a quem não tem acesso', 'Segurança',
     'Quem não pode ver um recurso recebe resposta de inexistência, e não de '
     'proibição.',
     'As consultas são filtradas pelo escopo da pessoa antes da busca por '
     'identificador, o que produz 404 em vez de 403. Responder proibido '
     'confirmaria que o recurso existe, e isso já é informação.',
     'ESSENCIAL'),

    ('RNF-SEG-005', 'Validação do tipo real dos arquivos', 'Segurança',
     'Arquivo enviado é verificado pelo conteúdo, e não pelo nome.',
     'Leitura da assinatura com python-magic, comparada a uma lista de tipos '
     'aceitos por contexto. Confiar na extensão permitiria enviar executável '
     'renomeado para .pdf.',
     'CRÍTICA'),

    ('RNF-SEG-006', 'Limite de tamanho por envio', 'Segurança',
     'O tamanho do anexo é limitado conforme o contexto.',
     'Verificado no servidor, e não apenas no navegador: 20 MB para material de '
     'trabalho, 10 MB para anexo de conversa e de publicação.',
     'ESSENCIAL'),

    ('RNF-SEG-007', 'Proteção do tráfego em produção', 'Segurança',
     'Todo o acesso à plataforma trafega cifrado.',
     'HTTPS obrigatório, com redirecionamento e cabeçalho de proxy reconhecido. '
     'Origens confiáveis declaradas explicitamente para o token de formulário.',
     'CRÍTICA'),

    ('RNF-SEG-008', 'Restrição do acesso à comunidade', 'Segurança',
     'Só entra quem tem vínculo com a universidade.',
     'Verificação do CPF contra a base institucional antes do cadastro, e '
     'ativação por código enviado ao e-mail informado.',
     'CRÍTICA'),

    ('RNF-SEG-009', 'Sanitização do conteúdo enviado', 'Segurança',
     'Texto publicado não executa código no navegador de quem lê.',
     'Escape automático na renderização e ausência de inserção direta de HTML '
     'não tratado. Um fórum aceita texto de qualquer participante, o que o '
     'torna alvo natural de injeção de script.',
     'CRÍTICA'),

    ('RNF-SEG-010', 'Rastro das ações de moderação', 'Segurança',
     'Toda decisão de moderação fica registrada com autor e momento.',
     'Registro de auditoria gravado junto da ação, na mesma transação. '
     'Moderação sem rastro impede contestar uma decisão.',
     'ESSENCIAL'),

    # --- Privacidade ---
    ('RNF-PRI-001', 'Privacidade da conversa de grupo', 'Privacidade',
     'A conversa do grupo é fechada aos integrantes, inclusive em relação ao '
     'professor.',
     'A consulta de conversas filtra por participação. O único conteúdo que '
     'atravessa é o pedido de ajuda, recortado: apenas a mensagem marcada e a '
     'descrição escrita. É condição para o módulo funcionar — sem ela, os '
     'grupos usam aplicativos externos.',
     'CRÍTICA'),

    ('RNF-PRI-002', 'Agregação sem identificação', 'Privacidade',
     'Os números públicos e os painéis de acompanhamento não expõem indivíduos.',
     'As contagens da tela de entrada e do painel de coordenação são agregadas '
     'por disciplina, sem nome nem identificador de pessoa.',
     'ESSENCIAL'),

    ('RNF-PRI-003', 'Campos de identificação não editáveis', 'Privacidade',
     'Nome, CPF, matrícula e vínculos vêm da organização e não se alteram pelo '
     'perfil.',
     'Lista explícita de campos editáveis na edição do próprio perfil. Permitir '
     'a alteração quebraria a correspondência com o registro institucional.',
     'ESSENCIAL'),

    # --- Integridade ---
    ('RNF-INT-001', 'Preservação do histórico na remoção', 'Integridade',
     'Remover não destrói o registro.',
     'Exclusão lógica por deleted_at nos modelos em que apagar de verdade '
     'destruiria histórico: publicações, respostas e mensagens. As consultas '
     'filtram o campo. Permite auditoria e mantém coerentes as respostas que '
     'dependiam do item removido.',
     'ESSENCIAL'),

    ('RNF-INT-002', 'Unicidade garantida no banco', 'Integridade',
     'Um voto por pessoa e publicação, um papel por pessoa e disciplina, uma '
     'inscrição por pessoa e oportunidade.',
     'Restrições declaradas no banco, e não apenas verificadas na aplicação. '
     'Verificação só na aplicação falha sob concorrência.',
     'CRÍTICA'),

    ('RNF-INT-003', 'Atomicidade nas operações concorrentes', 'Integridade',
     'Duas inscrições simultâneas não ultrapassam o número de vagas.',
     'Verificação de disponibilidade e gravação dentro da mesma transação.',
     'ESSENCIAL'),

    ('RNF-INT-004', 'Identificadores não sequenciais', 'Integridade',
     'O identificador de um registro não revela quantos existem nem permite '
     'percorrer os vizinhos.',
     'Chaves primárias em UUID em todos os modelos.',
     'IMPORTANTE'),

    # --- Desempenho ---
    ('RNF-DES-001', 'Consulta sem multiplicação de acessos', 'Desempenho',
     'Listas com dados relacionados não disparam uma consulta por item.',
     'Uso de select_related e prefetch_related nas consultas que compõem '
     'listagens. O acervo de arquivos, que atravessa três modelos, foi montado '
     'com esse cuidado.',
     'ESSENCIAL'),

    ('RNF-DES-002', 'Índices nos campos de filtro e ordenação', 'Desempenho',
     'As consultas frequentes têm suporte de índice.',
     'Índices declarados em conversa e data de mensagem, em tipo de conversa e '
     'em data de criação de publicação.',
     'IMPORTANTE'),

    ('RNF-DES-003', 'Paginação nas listagens', 'Desempenho',
     'Nenhuma listagem devolve a coleção inteira.',
     'Paginação padrão do DRF configurada globalmente.',
     'ESSENCIAL'),

    ('RNF-DES-004', 'Custo de rede evitado em listagem', 'Desempenho',
     'Montar uma lista não faz uma chamada ao armazenamento por item.',
     'O acervo não consulta o tamanho de cada anexo de conversa, porque a '
     'mensagem não o guarda e perguntar ao arquivo custaria uma chamada de rede '
     'por linha quando o armazenamento é externo.',
     'IMPORTANTE'),

    ('RNF-DES-005', 'Modelo de linguagem carregado sob demanda', 'Desempenho',
     'O modelo de busca semântica não é carregado na partida da aplicação.',
     'Carregamento tardio, na primeira indexação. Em instância pequena, o '
     'carregamento na partida esgotaria a memória antes de a aplicação '
     'responder.',
     'IMPORTANTE'),

    ('RNF-DES-006', 'Latência do canal em tempo real', 'Desempenho',
     'A mensagem enviada aparece para os demais sem demora perceptível.',
     'Entrega por WebSocket sobre Daphne, sem consulta periódica ao servidor. '
     'A consulta periódica geraria carga constante e ainda assim exibiria a '
     'mensagem com atraso.',
     'ESSENCIAL'),

    ('RNF-DES-007', 'Filtragem no navegador quando o volume permite',
     'Desempenho',
     'A busca dentro do acervo de arquivos responde a cada tecla, sem ida ao '
     'servidor.',
     'O acervo de um semestre são dezenas de arquivos, não milhares. Consultar '
     'o servidor a cada tecla custaria mais que filtrar o conjunto inteiro '
     'localmente.',
     'IMPORTANTE'),

    # --- Confiabilidade ---
    ('RNF-CON-001', 'Degradação previsível da busca', 'Confiabilidade',
     'Sem o modelo semântico, a busca continua funcionando em modo textual.',
     'A função de busca devolve o modo utilizado junto com os resultados, e a '
     'troca é automática. A interface informa qual modo respondeu.',
     'ESSENCIAL'),

    ('RNF-CON-002', 'Operação sem Redis', 'Confiabilidade',
     'A plataforma funciona em implantação de instância única, sem serviço de '
     'fila externo.',
     'Camada de canais em memória e cache local quando Redis está desativado '
     'por variável de ambiente. Torna viável a implantação em plano gratuito, '
     'usada na avaliação com usuários.',
     'IMPORTANTE'),

    ('RNF-CON-003', 'Falha de carga não impede o acesso', 'Confiabilidade',
     'Um erro na carga inicial não derruba a aplicação, e aparece no registro.',
     'Os passos da carga rodam em segundo plano, depois de o servidor abrir a '
     'porta, e cada falha é impressa em destaque. A versão anterior silenciava '
     'o erro: a plataforma subia vazia e o registro não dizia por quê.',
     'IMPORTANTE'),

    ('RNF-CON-004', 'Verificação automatizada', 'Confiabilidade',
     'As regras de permissão e privacidade têm teste que as sustenta.',
     'Suíte de testes automatizados cobrindo autenticação, visibilidade por '
     'matrícula, privacidade da conversa, moderação e o acervo de arquivos.',
     'ESSENCIAL'),

    ('RNF-CON-005', 'Reprodutibilidade do conjunto de demonstração',
     'Confiabilidade',
     'A mesma carga produz sempre o mesmo conjunto de dados.',
     'Semente fixa no gerador aleatório do comando de demonstração. Sem isso, '
     'uma captura de tela do artigo não corresponderia ao que a banca veria ao '
     'executar o projeto.',
     'IMPORTANTE'),

    ('RNF-CON-006', 'Carga inicial que não sobrescreve uso real',
     'Confiabilidade',
     'A carga de demonstração roda uma vez, e não a cada reinício.',
     'Controlada por variável de ambiente, desligada após a primeira '
     'implantação. Repeti-la apagaria o que os participantes produziram durante '
     'a avaliação, que é justamente o dado a observar.',
     'ESSENCIAL'),

    # --- Usabilidade e acessibilidade ---
    ('RNF-USA-001', 'Conformidade com diretrizes de acessibilidade',
     'Acessibilidade',
     'A plataforma é utilizável por quem depende de leitor de tela ou navega '
     'por teclado.',
     'Idioma declarado no elemento raiz, atalho para o conteúdo principal, '
     'contorno de foco visível, nome acessível em botões que só têm ícone, '
     'indicação da página atual na navegação e respeito à preferência de '
     'movimento reduzido. Segue as diretrizes da W3C.',
     'ESSENCIAL'),

    ('RNF-USA-002', 'Contraste suficiente nos dois temas', 'Acessibilidade',
     'Texto e controles permanecem legíveis no tema claro e no escuro.',
     'Cores definidas por variáveis que trocam de valor com o tema. Valores '
     'fixos escritos no código produziam texto quase invisível no tema escuro.',
     'ESSENCIAL'),

    ('RNF-USA-003', 'Adaptação a telas estreitas', 'Usabilidade',
     'A plataforma é utilizável no telefone.',
     'Abaixo de 1024 pixels a barra lateral sai do fluxo e vira gaveta '
     'sobreposta. Grades de colunas fixas foram trocadas por ajuste automático, '
     'que só cria a segunda coluna quando há largura para ela. Campos com no '
     'mínimo 16 pixels, para o navegador não aproximar a página ao receber '
     'foco.',
     'ESSENCIAL'),

    ('RNF-USA-004', 'Confirmação em ação de efeito coletivo', 'Usabilidade',
     'Sair de um grupo e excluir mensagem pedem confirmação.',
     'Diálogo antes de executar. São ações que afetam outras pessoas e cujo '
     'desfazer não é imediato.',
     'IMPORTANTE'),

    ('RNF-USA-005', 'Mensagem de erro acionável', 'Usabilidade',
     'O erro diz o que aconteceu e o que fazer.',
     'As recusas de regra de negócio devolvem texto explicativo em vez de '
     'código genérico. A migração da extensão vetorial distingue ausência de '
     'extensão de falta de permissão, e indica o comando a executar.',
     'IMPORTANTE'),

    ('RNF-USA-006', 'Estado vazio que orienta', 'Usabilidade',
     'Tela sem conteúdo explica o que aparecerá ali e como fazer aparecer.',
     'Cada listagem tem texto próprio para o caso vazio, em vez de área em '
     'branco. Numa plataforma nova, o estado vazio é o mais frequente.',
     'IMPORTANTE'),

    ('RNF-USA-007', 'Contagem que não inventa número', 'Usabilidade',
     'Nenhum número exibido na interface é fixo no código.',
     'As contagens da tela de entrada vêm de consulta real e mostram zero '
     'quando o valor é zero. Número inventado em tela institucional é problema '
     'de credibilidade: quem perguntar de onde vem não tem resposta.',
     'IMPORTANTE'),

    ('RNF-USA-008', 'Concordância de número no texto da interface',
     'Usabilidade',
     'Singular e plural corretos em toda contagem exibida.',
     'Função utilitária de pluralização aplicada nas contagens. Detalhe '
     'pequeno, mas "1 oportunidades" desgasta a percepção de cuidado da '
     'plataforma inteira.',
     'DESEJÁVEL'),

    # --- Manutenibilidade ---
    ('RNF-MAN-001', 'Regras de negócio fora das views', 'Manutenibilidade',
     'A mesma regra vale para a API e para o canal em tempo real.',
     'As regras vivem em módulos de serviço, usados tanto pelas views quanto '
     'pelo consumidor de WebSocket. Duplicá-las garantiria divergência.',
     'ESSENCIAL'),

    ('RNF-MAN-002', 'Permissões centralizadas', 'Manutenibilidade',
     'A verificação de papel tem um único lugar de definição.',
     'Módulo compartilhado em config/permissions, importado por todos os apps.',
     'ESSENCIAL'),

    ('RNF-MAN-003', 'Documentação da API gerada do código',
     'Manutenibilidade',
     'A especificação da API acompanha a implementação.',
     'drf-spectacular gera o esquema OpenAPI a partir das views e '
     'serializadores.',
     'IMPORTANTE'),

    ('RNF-MAN-004', 'Verificação de tipos antes da entrega',
     'Manutenibilidade',
     'Erro de tipo no frontend é detectado antes da implantação.',
     'TypeScript com verificação na construção. O servidor de desenvolvimento '
     'não verifica tipos: oito erros sobreviveram uma semana e só apareceram na '
     'implantação.',
     'ESSENCIAL'),

    ('RNF-MAN-005', 'Comentário que registra o motivo', 'Manutenibilidade',
     'O código explica por que a decisão foi tomada, e não o que a linha faz.',
     'Convenção adotada em todo o projeto. Reduz o risco de alguém desfazer uma '
     'correção por não conhecer o defeito que ela resolveu.',
     'IMPORTANTE'),

    # --- Portabilidade e implantacao ---
    ('RNF-POR-001', 'Implantação reprodutível em contêiner',
     'Portabilidade',
     'O ambiente de produção é construído sempre da mesma forma.',
     'Dockerfile de duas etapas: uma constrói o frontend, outra executa a '
     'aplicação. Bibliotecas de sistema necessárias declaradas explicitamente.',
     'ESSENCIAL'),

    ('RNF-POR-002', 'Configuração por variável de ambiente',
     'Portabilidade',
     'Nenhum segredo ou endereço fica escrito no código.',
     'Chave secreta, banco, hosts permitidos, armazenamento e chaves de '
     'serviços vêm do ambiente. Permite trocar de provedor sem alterar código.',
     'CRÍTICA'),

    ('RNF-POR-003', 'Armazenamento de arquivos intercambiável',
     'Portabilidade',
     'Os arquivos enviados podem ficar no disco local ou em serviço externo.',
     'Sistema de armazenamento escolhido por configuração, com django-storages. '
     'Necessário porque o disco do contêiner é efêmero.',
     'ESSENCIAL'),

    ('RNF-POR-004', 'Entrega dos arquivos estáticos pela aplicação',
     'Portabilidade',
     'A aplicação serve o próprio frontend, sem servidor web separado.',
     'WhiteNoise com compressão. O frontend é construído com prefixo de caminho '
     'compatível com o local de publicação — sem isso o navegador pede os '
     'arquivos no lugar errado e recebe a página em branco.',
     'ESSENCIAL'),

    ('RNF-POR-005', 'Idioma declarado no documento', 'Portabilidade',
     'O leitor de tela pronuncia o conteúdo em português.',
     'Atributo de idioma no elemento raiz. Com o valor padrão do gerador, em '
     'inglês, palavras como "dúvida" e "matriculados" saem com fonética '
     'inglesa e a interface fica incompreensível para quem depende de áudio.',
     'ESSENCIAL'),

    ('RNF-POR-006', 'Aplicação de página única servida pelo backend',
     'Portabilidade',
     'Qualquer endereço da aplicação abre direto, sem passar pela raiz.',
     'Rota de captura no Django devolve a página principal para endereços que '
     'não sejam de API, administração ou arquivos. Sem ela, recarregar uma '
     'página interna resultaria em erro de página não encontrada.',
     'ESSENCIAL'),
]


# ---------------------------------------------------------------------------
# Divergencias em relacao ao planejamento do TCC1
# ---------------------------------------------------------------------------

DIVERGENCIAS = [
    ('Sistema de reputação e ranking semestral', 'Removido',
     'RF-PRF-007, RF-VOL-016 do TCC1',
     'A pontuação pública desloca o incentivo de ajudar para o de pontuar, e o '
     'efeito é mais forte num fórum de disciplina, onde as mesmas pessoas '
     'convivem o semestre inteiro, do que numa comunidade aberta. O '
     'reconhecimento permaneceu apenas na marcação de melhor resposta, que '
     'serve a quem consulta o tópico depois.'),

    ('Módulo de colaboração em grupo', 'Incorporado',
     'RF-COL-001 a RF-COL-014',
     'Não estava previsto com esta extensão. Foi incorporado ao se constatar, '
     'no levantamento, que a discussão de trabalho em grupo acontecia '
     'integralmente fora dos sistemas da universidade — a lacuna mais visível '
     'entre as observadas.'),

    ('Busca com Elasticsearch', 'Substituído',
     'RF-FOR-012 do TCC1',
     'Substituído por busca vetorial com pgvector no próprio PostgreSQL, com '
     'queda automática para busca textual. Evita um serviço adicional para '
     'manter e permite comparar por significado, não só por termo — o que '
     'importa quando a pessoa descreve a dúvida com as próprias palavras.'),

    ('Verificação automática de discurso de ódio', 'Não implementado',
     'RF-FOR-016 do TCC1',
     'Dependia de serviço externo pago. A moderação é humana, por denúncia, com '
     'análise registrada e justificativa comunicada ao autor. Fica como '
     'trabalho futuro.'),

    ('Registro de doações e pontuação por item', 'Removido',
     'RF-VOL-014 do TCC1',
     'Removido junto com o sistema de pontuação, pelo mesmo motivo.'),

    ('Restrição de publicação por decisão pedagógica', 'Incorporado',
     'RF-FOR-015',
     'Não estava previsto. Surgiu da distinção entre conteúdo que infringe '
     'regra, que é caso de denúncia, e resposta que entrega o exercício pronto, '
     'que não infringe nada e ainda assim prejudica a turma.'),

    ('Acervo de arquivos por disciplina', 'Incorporado',
     'RF-COL-014',
     'Não estava previsto. Surgiu do uso: o material chegava por três caminhos '
     'diferentes e reencontrá-lo exigia lembrar por qual deles havia passado.'),

    ('Certificado com assinatura digital X.509', 'Reduzido',
     'RF-VOL-012 do TCC1',
     'O certificado é emitido em PDF com código único de conferência. A '
     'assinatura criptográfica com certificado digital exigiria infraestrutura '
     'de chaves institucional, fora do alcance do trabalho.'),
]


# ---------------------------------------------------------------------------
# Montagem
# ---------------------------------------------------------------------------

def estilo_cabecalho(celula):
    celula.font = Font(name=FONTE, size=10, bold=True, color='FFFFFF')
    celula.fill = PatternFill('solid', fgColor=AZUL)
    celula.alignment = Alignment(horizontal='center', vertical='center',
                                 wrap_text=True)
    celula.border = BORDA


BORDA = Border(*[Side(style='thin', color='D0D2D8')] * 4)


def escrever_aba(planilha, colunas, larguras, linhas):
    for indice, nome in enumerate(colunas, start=1):
        celula = planilha.cell(row=1, column=indice, value=nome)
        estilo_cabecalho(celula)

    for numero, linha in enumerate(linhas, start=2):
        for indice, valor in enumerate(linha, start=1):
            celula = planilha.cell(row=numero, column=indice, value=valor)
            celula.font = Font(name=FONTE, size=10)
            celula.alignment = Alignment(vertical='top', wrap_text=True)
            celula.border = BORDA

        # Faixa alternada, para a leitura não pular de linha numa tabela larga.
        if numero % 2 == 0:
            for indice in range(1, len(colunas) + 1):
                planilha.cell(row=numero, column=indice).fill = PatternFill(
                    'solid', fgColor=CINZA_CLARO
                )

    for indice, largura in enumerate(larguras, start=1):
        planilha.column_dimensions[get_column_letter(indice)].width = largura

    planilha.row_dimensions[1].height = 30
    planilha.freeze_panes = 'A2'
    planilha.auto_filter.ref = (
        f'A1:{get_column_letter(len(colunas))}{len(linhas) + 1}'
    )


def escrever_resumo(livro, titulo, nome_aba, total, coluna_prioridade,
                    observacao):
    """
    Aba de contagem por prioridade.

    As contagens são fórmulas, e não números escritos pelo gerador: se uma
    linha for acrescentada à mão na aba de requisitos, o resumo acompanha.
    """
    aba = livro.create_sheet('Resumo', 0)
    ultima = total + 1

    aba['A1'] = titulo
    aba['A1'].font = Font(name=FONTE, size=14, bold=True, color=AZUL)

    aba['A2'] = observacao
    aba['A2'].font = Font(name=FONTE, size=10, italic=True)
    aba['A2'].alignment = Alignment(wrap_text=True, vertical='top')
    aba.merge_cells('A2:C2')
    aba.row_dimensions[2].height = 30

    aba['A4'] = 'Prioridade'
    aba['B4'] = 'Quantidade'
    for referencia in ('A4', 'B4'):
        estilo_cabecalho(aba[referencia])

    linha = 5
    for prioridade in ('CRÍTICA', 'ESSENCIAL', 'IMPORTANTE', 'DESEJÁVEL'):
        aba.cell(row=linha, column=1, value=prioridade).font = Font(
            name=FONTE, size=10
        )
        celula = aba.cell(
            row=linha, column=2,
            value=(
                f"=COUNTIF('{nome_aba}'!{coluna_prioridade}2:"
                f"{coluna_prioridade}{ultima},\"{prioridade}\")"
            ),
        )
        celula.font = Font(name=FONTE, size=10)
        celula.alignment = Alignment(horizontal='center')
        linha += 1

    aba.cell(row=linha, column=1, value='Total').font = Font(
        name=FONTE, size=10, bold=True
    )
    celula = aba.cell(
        row=linha, column=2, value=f"=COUNTA('{nome_aba}'!B2:B{ultima})"
    )
    celula.font = Font(name=FONTE, size=10, bold=True)
    celula.alignment = Alignment(horizontal='center')
    celula.fill = PatternFill('solid', fgColor=CINZA_CLARO)

    aba.column_dimensions['A'].width = 22
    aba.column_dimensions['B'].width = 14
    aba.column_dimensions['C'].width = 40

    return aba


def gerar_funcionais():
    livro = Workbook()

    aba = livro.active
    aba.title = 'Requisitos Funcionais'
    escrever_aba(
        aba,
        ['ID', 'Código RF', 'Requisito', 'Categoria', 'Descrição Funcional',
         'Descrição Técnica', 'Ator', 'Prioridade'],
        [6, 14, 30, 16, 48, 68, 22, 13],
        [(numero, *dados) for numero, dados in enumerate(FUNCIONAIS, start=1)],
    )

    # As divergências acompanham os funcionais porque é neles que a mudança de
    # escopo aparece: requisito planejado no TCC1 que não foi entregue, e
    # requisito entregue que não estava planejado.
    aba_div = livro.create_sheet('Divergências TCC1')
    escrever_aba(
        aba_div,
        ['ID', 'Item', 'Situação', 'Referência no TCC1', 'Justificativa'],
        [6, 40, 18, 26, 92],
        [(numero, *dados) for numero, dados in enumerate(DIVERGENCIAS, start=1)],
    )

    escrever_resumo(
        livro,
        'Requisitos Funcionais — Plataforma UNIFEI',
        'Requisitos Funcionais',
        len(FUNCIONAIS),
        'H',
        'Levantamento a partir do sistema implementado, e não do planejamento. '
        'As diferenças em relação ao TCC1 estão registradas na aba '
        'Divergências TCC1, com a justificativa de cada uma.',
    )

    livro.save(DESTINO_RF)
    return DESTINO_RF


def gerar_nao_funcionais():
    livro = Workbook()

    aba = livro.active
    aba.title = 'Requisitos Não-Funcionais'
    escrever_aba(
        aba,
        ['ID', 'Código RNF', 'Requisito', 'Categoria', 'Descrição Funcional',
         'Descrição Técnica', 'Prioridade'],
        [6, 15, 34, 17, 48, 68, 13],
        [(numero, *dados)
         for numero, dados in enumerate(NAO_FUNCIONAIS, start=1)],
    )

    escrever_resumo(
        livro,
        'Requisitos Não-Funcionais — Plataforma UNIFEI',
        'Requisitos Não-Funcionais',
        len(NAO_FUNCIONAIS),
        'G',
        'Levantamento a partir do sistema implementado. Agrupados em oito '
        'categorias: segurança, privacidade, integridade, desempenho, '
        'confiabilidade, usabilidade e acessibilidade, manutenibilidade e '
        'portabilidade.',
    )

    livro.save(DESTINO_RNF)
    return DESTINO_RNF


def main():
    PASTA.mkdir(parents=True, exist_ok=True)

    caminho_rf = gerar_funcionais()
    caminho_rnf = gerar_nao_funcionais()

    print(f'{caminho_rf}')
    print(f'  {len(FUNCIONAIS)} requisitos funcionais')
    print(f'  {len(DIVERGENCIAS)} divergências em relação ao TCC1')
    print()
    print(f'{caminho_rnf}')
    print(f'  {len(NAO_FUNCIONAIS)} requisitos não-funcionais')


if __name__ == '__main__':
    main()
