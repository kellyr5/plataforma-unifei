% Universidade Federal de Itajuba
% Instituto de Matematica e Computacao
%
% Modelo LaTeX para escrita de Trabalho de Conclusao de Curso
% para os cursos de Ciencia da Computacao e Sistemas de Informacao
%
% Autores:
% Template: Luiz Olmes Carvalho - olmes@unifei.edu.br
% Texto: Rafael de Magalhães Dias Frinhani - frinhani@unifei.edu.br
% Arte da capa: Elisa de Cássia Silva Rodrigues - elisa.rodrigues@unifei.edu.br
%
% Ultima Atualização: 2/12/2021.
%
% Parte desta classe faz uso de codigos dos modelos originais de:
% - ICMC-USP: http://www.icmc.usp.br/biblio/ficha.php 
%      > apenas o modelo da ficha catalografica, sem cutter
% - UFRJ: https://www.overleaf.com/latex/templates/modelo-tcc-dcc-slash-ufrj/hnbjwfbqrwgh 
%      > formatacao dos headings de secoes e subsecoes
%
% +-------------------------+
% | NAO ALTERE ESTE ARQUIVO |
% | DO NOT CHANGE THIS FILE |
% +-------------------------+
%
% Any bugs? Please, report us!

% Define a versao do LaTeX
\NeedsTeXFormat{LaTeX2e}

% Definicao da classe
\ProvidesClass{imc}[2021/11/23 v.1.0 - Luiz Olmes / Rafael Frinhani]

% Classe base: article
\LoadClass[10pt, a4paper, twocolumn, twoside]{article}

% Pacotes padrao
\RequirePackage{afterpage} % Fix para paginas em landscape
\RequirePackage[ruled, linesnumbered, commentsnumbered, portuguese, onelanguage]{algorithm2e} % Inclusao de algoritmos no documento
\RequirePackage{amsmath, amssymb, amsthm} % Pacotes matematicos
\RequirePackage{array} % Criacao de tabelas
\RequirePackage[brazil]{babel} % Idioma do texto: portugues - Brasil
\RequirePackage[font=small]{caption} % Caption de figuras e tabelas
\RequirePackage[usenames, table, x11names]{xcolor} % Cores em geral, tabelas e links
\RequirePackage[inline]{enumitem} % Listas de itens
\RequirePackage{float} % Elementos flutuantes: figuras, tabelas
\RequirePackage{ifthen} % Comandos condicionais
\RequirePackage{fancybox} % Criacao de caixas
\RequirePackage{fancyhdr} % Criacao de cabecalhos e rodapes
%\RequirePackage{flushend} % Balanceamento das colunas na ultima pagina
\RequirePackage[T1]{fontenc} % Codificacao de fontes
\RequirePackage[top=20mm, bottom=20mm, left=15mm, right=15mm]{geometry} % Define as margens
\RequirePackage{graphicx} % Inclusao de figuras
\RequirePackage{hyphenat} % Comandos de separacao silabica: \hypenation
\RequirePackage[hyphens]{url} % Hifenação de URLs longas.
\PassOptionsToPackage{hyphens}{url} % Hifenizar URLs longas
\RequirePackage{lastpage} % Obter a quantidade de paginas
\usepackage[tt=false, type1=true]{libertine} % Fonte do documento: Libertine % Nao altere, ou vai dar problema nos espacamentos.
\RequirePackage{lipsum} % Teste de formatacao
\RequirePackage{listings} % Inclusao de codigos-fonte no documento
\RequirePackage{longtable} % Tabelas grandes (mais de 1 pagina)
\RequirePackage{lscape} % Definir a orientacao da pagina como paisagem.
\RequirePackage{multirow} % Mesclar celulas de tabelas
\RequirePackage{natbib} % Citacoes
\usepackage[libertine]{newtxmath} % Fonte matematica % Nao altere, ou vai dar problemas nos espacamentos.
\RequirePackage{pdfpages} % Inclusao de PDF: mater apos xcolor!
\RequirePackage{pdflscape} % Permite definir a orientacao da pagina como paisagem.
\RequirePackage{quoting} % Alterar tabulação do parágrafo
\RequirePackage{rotating} % Para rotacoes
\RequirePackage{setspace} % Configuracoes de espacamento: manter antes de hyperref
\RequirePackage{subfigure} % Inclusao de subfiguras
\RequirePackage[absolute]{textpos} % Posicionamento de caixas
\RequirePackage[normalem]{ulem} % Sublinhado
\RequirePackage{eso-pic} % Para a primeira capa como fundo
\RequirePackage[breaklinks, bookmarksnumbered=true, bookmarksopen=true, colorlinks=true, linkcolor=azul, citecolor=azul, filecolor=azul, urlcolor=azul, debug, hyperindex=true, pagebackref=false, verbose=true]{hyperref} % Links do documento

% Definicao de cores
\definecolor{azul}{rgb}{0,0,1.0}
\definecolor{azul-capa}{RGB}{22,62,166}
\definecolor{verde-capa}{RGB}{0,102,102}

% Variaveis: informacoes do autor
\newcommand*{\ano}[1]{\gdef\@ano{#1}}
\newcommand*{\autorNomeA}[1]{\gdef\@autorNomeA{#1}}
\newcommand*{\autorSobrenomeA}[1]{\gdef\@autorSobrenomeA{#1}}
\newcommand*{\autorNomeB}[1]{\gdef\@autorNomeB{#1}}
\newcommand*{\autorSobrenomeB}[1]{\gdef\@autorSobrenomeB{#1}}
\newcommand*{\coorientadorNome}[1]{\gdef\@coorientadorNome{#1}}
\newcommand*{\coorientadorSobrenome}[1]{\gdef\@coorientadorSobrenome{#1}}
\newcommand*{\dataDefesa}[1]{\gdef\@dataDefesa{#1}}
\newcommand*{\emailAutorA}[1]{\gdef\@emailAutorA{#1}}
\newcommand*{\emailAutorB}[1]{\gdef\@emailAutorB{#1}}
\newcommand*{\local}[1]{\gdef\@local{#1}}
\newcommand*{\membroBancaA}[1]{\gdef\@membroBancaA{#1}}
\newcommand*{\membroBancaB}[1]{\gdef\@membroBancaB{#1}}
\newcommand*{\membroBancaC}[1]{\gdef\@membroBancaC{#1}}
\newcommand*{\membroBancaD}[1]{\gdef\@membroBancaD{#1}}
\newcommand*{\membroBancaE}[1]{\gdef\@membroBancaE{#1}}
\newcommand*{\mes}[1]{\gdef\@mes{#1}}
\newcommand*{\orientadorNome}[1]{\gdef\@orientadorNome{#1}}
\newcommand*{\orientadorSobrenome}[1]{\gdef\@orientadorSobrenome{#1}}
\newcommand*{\palavraChaveA}[1]{\gdef\@palavraChaveA{#1}}
\newcommand*{\palavraChaveB}[1]{\gdef\@palavraChaveB{#1}}
\newcommand*{\palavraChaveC}[1]{\gdef\@palavraChaveC{#1}}
\newcommand*{\palavraChaveD}[1]{\gdef\@palavraChaveD{#1}}
\newcommand*{\palavraChaveE}[1]{\gdef\@palavraChaveE{#1}}
\newcommand*{\pdfAprovacao}[1]{\gdef\@pdfAprovacao{#1}}
\newcommand*{\titulo}[1]{\gdef\@titulo{#1}}
\newcommand*{\txtCoorientador}[1]{\gdef\@txtCoorientador{#1}}
\newcommand*{\txtOrientador}[1]{\gdef\@txtOrientador{#1}}

% Variaveis textuais inicializadas
\newcommand{\instituto}{Instituto de Matemática e Computação}
\newcommand{\instituicao}{Universidade Federal de Itajubá}
\newcommand{\sigla}{UNIFEI}
\newcommand{\tipo}{Trabalho de Conclusão de Curso}
\newcommand{\txtAprovadoEm}{Defesa em}
\newcommand{\txtBach}{Bacharelado em}
\newcommand{\txtBancaExaminadora}{Banca Examinadora}
\newcommand{\txtCoorientacao}{Coorientação}
\newcommand{\txtCursoBach}{Curso de Bacharelado em}
\newcommand{\txtDe}{de}
\newcommand{\txtOrientacao}{Orientação}

% Identificador de curso para gerar capa
\newcommand{\iscco}{1}
\newcommand{\siglaCurso}{CCO}

% Opcoes da classe
\DeclareOption*{} % Remove warnings

\DeclareOption{cco}
{
	\xdef\@curso{Ciência da Computação}
	\xdef\@cursoCapa{C~i~ê~n~c~i~a\quad d~a\quad C~o~m~p~u~t~a~ç~ã~o}
}

\DeclareOption{sin}
{
	\xdef\@curso{Sistemas de Informação}
	\xdef\@cursoCapa{S~i~s~t~e~m~a~s\quad d~e\quad I~n~f~o~r~m~a~ç~ã~o}
	\renewcommand{\iscco}{0}
	\renewcommand{\siglaCurso}{SIN}
}

\ProcessOptions % Processa opcoes

\pdfminorversion=7 % Permite a inclusao de PDFs sem warnings de versao
% Definicoes de espacamento:
\everymath{\displaystyle} % Espacamento matematico
\frenchspacing % Remove espacos extras apos ponto final
\sloppy % Mantem linhas dentro das margens
% Proibe linhas unicas:
%\widowpenalty = 10000
%\clubpenalty = 10000
\raggedbottom % Relaxa quantidade de linhas para completar a pagina

% Contadores de floats por pagina
\setcounter{topnumber}{8}
\setcounter{bottomnumber}{8}
\setcounter{totalnumber}{8}

% Espaco entre colunas
\setlength{\columnsep}{13pt}
% Indentacao do paragrafo
\setlength{\parindent}{7mm}

% Formatacao dos cabecalhos
\pagestyle{fancy} % Aplica estilo dos cabecalhos
\renewcommand{\sectionmark}[1]
{\markright{\thesection.\ #1}} % No. Nome da secao
\renewcommand{\headrulewidth}{0.5pt} % Linha do cabecalho
\renewcommand{\footrulewidth}{0pt} % Linha do rodape
\fancyhf{} % Limpa cabecalhos
\setlength{\headheight}{16pt} % Altura do cabecalho. Valores menores que 15.71 dao pau!
\if@twoside % Se o documento for twoside (dois lados da folha)
\fancyhead[LE, RO]{\thepage} % Numero da pagina
\fancyhead[LO]{\slshape\@autorNomeA\space\@autorSobrenomeA%
    \ifthenelse{\equal{\@autorNomeB}{}}% Verificando se ha segundo autor
    {% if
    }%
    {% else
    	,~\@autorNomeB\space\@autorSobrenomeB%
    }%
} 
\fancyhead[RE]{\slshape\@titulo} 
\else % Se for oneside
\fancyhead[RO]{\thepage} 
\fancyhead[LO]{\slshape\@titulo} 
\fi % Fim If

% Definindo atributos do pacote Listings, que insere codigo-fonte.
\lstset
{
	numbers=left, % Numeros ao lado esquerdo do algoritmo
	stepnumber=1, % Incremento
	firstnumber=1, % Inicio
	numberstyle=\scriptsize\textbf, % Estilo da fonte
	extendedchars=true,
	breaklines=true,
	frame=tb,
	basicstyle=\small,
	stringstyle=\ttfamily,
	showstringspaces=false,
	xleftmargin=5mm
}

% Formatacao das secoes
\def\@seccntformat#1{%
	{\csname the#1\endcsname\;}
}

\renewcommand\section{%
    \@startsection{section}{1}{\z@}%
    {-3.5ex \@plus -1ex \@minus -.2ex}%
    {2.3ex \@plus.2ex}%
    {\large\bfseries}%
}

\renewcommand{\subsection}{%
	\@startsection{subsection}{2}{\z@}%
	{-3.25ex\@plus -1ex \@minus -.2ex}%
	{1.5ex \@plus .2ex}%
	{\large\bfseries}%
}

\renewcommand{\subsubsection}{%
	\@startsection{subsubsection}{2}{\z@}%
	{-3.25ex\@plus -1ex \@minus -.2ex}%
	{1.5ex \@plus .2ex}%
	{\large\bfseries}%
}

% Comando que produz a primeira capa do documento (colorida)
\newcommand{\criaCapaDura}
{%
	\thispagestyle{empty}
	\pagenumbering{Roman}
	\pdfbookmark[1]{\capadura}{capadura}
	\begin{center}
        \ifthenelse{\equal{\iscco}{1}}
        {% if
            \AddToShipoutPictureBG*{\includegraphics[height=\paperheight]{./config/capa-cco.pdf}}
        }%
        {% else
        	\AddToShipoutPictureBG*{\includegraphics[height=\paperheight]{./config/capa-sin.pdf}}
        }
        \begin{textblock*}{20mm}(22mm, 75mm) % Curso
        	\begin{center}
                \textcolor{white}%
                {%
    	            \begin{turn}{90}
	                    {\fontfamily{phv}\fontsize{24pt}{24pt}\selectfont\centering\nohyphens{\textbf{\MakeUppercase{\@cursoCapa}}}}
    	            \end{turn}
    	        }
    	    \end{center}
        \end{textblock*}
        \begin{textblock*}{20mm}(8mm, 271mm) % Ano, rotacionado em aprox. -45 graus
    	    \begin{center}
    	        \textcolor{white}%
                {%
    	            \begin{turn}{314}
	                    {\fontfamily{phv}\fontsize{24pt}{24pt}\selectfont\@ano}
    	            \end{turn}
    	        }
    	    \end{center}
    	\end{textblock*}
    	\begin{textblock*}{20mm}(5mm, 20mm) % UNIFEI, rotacionado em 90 graus
    	    \begin{center}
                \textcolor{white}%
                {%
    	            \begin{turn}{90}
	                {\fontfamily{phv}\fontsize{14pt}{14pt}\selectfont\centering\nohyphens{\textbf{\MakeUppercase{\instituicao}}}}
    	            \end{turn}
    	        }
    	    \end{center}
    	\end{textblock*}
    	\begin{textblock*}{140mm}(42mm, 36mm) % Titulo
    	    \begin{tabular}{m{136mm} m{0mm}} 
        		%\hline
        		\centering\fontfamily{phv}\fontsize{18pt}{18pt}\selectfont{\textbf{\textsc{\@titulo}}} & \vspace*{52mm}~ \\ 
        		%\hline
    		\end{tabular}
    	\end{textblock*}
    	\begin{textblock*}{108mm}(81mm, 120mm) % Autor(es)
    	    \begin{tabular}{m{100mm} m{0mm}} 
        		%\hline
        		\begin{flushright}
        		    \fontfamily{phv}\fontsize{16pt}{16pt}\selectfont{\textbf{\@autorNomeA\space\@autorSobrenomeA}}%
        		    \ifthenelse{\equal{\@autorNomeB}{}} % Verificando se ha segundo autor
                    {% if
                    }%
                    {% else
                    	\par\vspace*{5px}\fontfamily{phv}\fontsize{16pt}{16pt}\selectfont{\textbf{\@autorNomeB\space\@autorSobrenomeB}}%
                    }
        		\end{flushright}
        		& \vspace*{33mm}~ \\
        		%\hline
    		\end{tabular}
    	\end{textblock*}
    	\begin{textblock*}{110mm}(81mm, 162mm) % Tipo
    	    \begin{flushleft}
    	            {\fontfamily{phv}\fontsize{13pt}{13pt}\selectfont\nohyphens{\mdseries{\tipo\\ \txtBach\space\@curso}}}
    	    \end{flushleft}
    	\end{textblock*}
    \end{center}
    ~
    \pagebreak
}

% Comando que produz a ficha catalografica (verso da folha de rosto)
\newcommand{\criaFichaCatalografica}%
{%
    \thispagestyle{empty}
	\pdfbookmark[1]{\fichacatalografica}{fichacatalografica}
	\vspace*{161mm}
	{
	    \small%
	    {
        	\begin{center}
        		\fbox{%
        		    \begin{minipage}[c][75mm][t]{125mm}%
        		        \hspace*{6mm}
        		        \begin{minipage}[r][75mm][t]{112mm}%
        		            % 1a e 2a linhas: em branco
        		            \vspace{2.2\baselineskip}
        		            % 3a linha: Sobrenome, Nome do Autor (Sempre o primeiro autor)
        		            \hspace{1.5em}{\@autorSobrenomeA,\space \@autorNomeA\par}
        		            % 4a linha: titulo / autor, local, sigla instituicao, ano
        		            \hspace{1.5em}{\@titulo\space{/}\space\@autorNomeA\space\@autorSobrenomeA%
            		            \ifthenelse{\equal{\@autorNomeB}{}}%
                    			{% if
                    			}%
                    			{% else
                    				;\space\@autorNomeB\space\@autorSobrenomeB%
                    			}%
        		            . - \@local: \sigla, \@ano.\par}
        		            % 5a linha: paginacao f., il (ilustrada), altura do documento
        		            \hspace{1.5em}{\pageref{LastPage}\space p.\par}
        		            % 6a linha: tipo (curso) - instituicao, local, ano
        		            \hspace{1.5em}{\tipo\space (\@curso)\space{-}\space\instituicao,\space\@local,\space\@ano\par}
        		            % 7a linha: orientador (8a linha: coorientador)
        		            \hspace{1.5em}{\txtOrientacao:\space\@orientadorNome\space\@orientadorSobrenome\par}
        		            \ifthenelse{\equal{\@coorientadorNome}{}}
                			{% if
                			}%
                			{% else
                				\hspace{1.5em}{\txtCoorientacao:\space\@coorientadorNome\space\@coorientadorSobrenome\par}
                			}
                			% Ultima linha: palavras chave, pistas
                			\hspace{1.5em}%
                			\begin{enumerate*}
                			    \item \@palavraChaveA.
                			    \item \@palavraChaveB.
                			    \item \@palavraChaveC.
                			    \ifthenelse{\equal{\@palavraChaveD}{}}%
                                {% if
                                }%
                            	{% else
                            	    \item \@palavraChaveD.
                                }%
                                \ifthenelse{\equal{\@palavraChaveE}{}}%
                                {% if
                                }%
                            	{% else
                            	    \item \@palavraChaveE.
                                }%
                            \end{enumerate*}\space%
                        	\begin{enumerate*}[label=\Roman*.]
                        	    \item \@orientadorSobrenome,\space\@orientadorNome, orient.
                        	    \ifthenelse{\equal{\@coorientadorNome}{}}%
                    			{% if
                    			}%
                    			{% else
                    				\item \@coorientadorSobrenome,\space\@coorientadorNome, coorient.
                    			}%
                        	    \item T\'{i}tulo.
                        	\end{enumerate*}
                		\end{minipage}%
        		    \end{minipage}%
        		}%
        	\end{center}
        }
	}
}

% Comando que produz a folha de aprovacao
\newcommand{\criaFolhaAprovacao}%
{%
    \thispagestyle{empty}
    \pdfbookmark[1]{\folhaaprovacao}{folhaaprovacao}
    \ifthenelse{\equal{\@pdfAprovacao}{}}
    {% if
        \hspace*{10mm}\begin{minipage}[c][230mm][t]{165mm}%
            \begin{center}
            \large\bfseries\MakeUppercase{\folhaaprovacao}\par\vspace*{5mm}
            \end{center}
            \noindent\large\@autorSobrenomeA, \@autorNomeA%
            \ifthenelse{\equal{\@autorNomeB}{}}%
            {% if
            }%
            {;~\@autorSobrenomeB, \@autorNomeB%
            }%
            .~\textbf{\@titulo}.~\pageref{LastPage}~p.~\tipo~(\@curso),~\instituicao,~\@local,~\@ano.\par\vspace*{10mm}
            \noindent\large\txtAprovadoEm\space\@dataDefesa.~\par\vspace*{10mm}
        	\noindent\large\MakeUppercase{\txtBancaExaminadora}:\par\vspace*{10mm}
            \begin{center}
        	    \ifthenelse{\equal{\@membroBancaA}{}}
                {% if
                }%
        		{% else
        		    \rule{90mm}{0.4pt}\\
        	        {\@membroBancaA\par\vspace*{15mm}}
        	    }
        	    \ifthenelse{\equal{\@membroBancaB}{}}
                {% if
                }%
        		{% else
        		    \rule{90mm}{0.4pt}\\
        	        {\@membroBancaB\par\vspace*{15mm}}
        	    }
        	    \ifthenelse{\equal{\@membroBancaC}{}}
                {% if
                }%
        		{% else
        		    \rule{90mm}{0.4pt}\\
        	        {\@membroBancaC\par\vspace*{15mm}}
        	    }
        	    \ifthenelse{\equal{\@membroBancaD}{}}
                {% if
                }%
        		{% else
        		    \rule{90mm}{0.4pt}\\
        	        {\@membroBancaD\par\vspace*{15mm}}
        	    }
        	    \ifthenelse{\equal{\@membroBancaE}{}}
                {% if
                }%
        		{% else
        		    \rule{90mm}{0.4pt}\\
        	        {\@membroBancaE\par\vspace*{15mm}}
        	    }
        	\end{center}
        \end{minipage}
    }%
    {% else
	\includepdf[pages=-]{\@pdfAprovacao}
    }
}

% Comando que produz a primeira pagina de elementos textuais do artigo: posiciona titulo, autoria e abstract
\newcommand{\criaPaginaInicialArtigo}
{
    \pagenumbering{arabic}
    \thispagestyle{empty}
    \AddToShipoutPictureBG*{\includegraphics[height=\paperheight]{./config/unifei-imc.pdf}}
    \twocolumn[
        \vspace*{25mm}
        {\LARGE\centering\@titulo\par\vspace*{\baselineskip}}
        {\Large\centering\@autorNomeA\space\@autorSobrenomeA%
            \ifthenelse{\equal{\@autorNomeB}{}}
            {% if
                \par%\vspace*{3pt}%
                {\textit{\normalsize\@emailAutorA}}
            }%
    		{% else
    		    ,\space\@autorNomeB\space\@autorSobrenomeB%
    		    \par%\vspace*{3pt}%
                \textit{\normalsize\@emailAutorA,\space\@emailAutorB}
    	    }%
    	    \par\vspace*{9pt}%
	    }%
	    {\centering\textit{\@txtOrientador}:\space\@orientadorNome\space\@orientadorSobrenome\par}
	    \ifthenelse{\equal{\@coorientadorNome}{}}
        {% if
        }%
		{% else
		    {\centering\textit{\@txtCoorientador}:\space\@coorientadorNome\space\@coorientadorSobrenome\par}%
	    }%
        \vspace*{\baselineskip}
        {
            \hrulefill
            
            {\vspace*{4pt}\textbf{\MakeUppercase{\resumo}}\par}
            {%
                \input{./elemtextuais/resumo.tex}\par%
            }
            \vspace*{-2pt}
            \hrulefill
            {
                \par\noindent\textbf{Palavras-chave:}\space\@palavraChaveA;\space\@palavraChaveB;\space\@palavraChaveC
            	\ifthenelse{\equal{\@palavraChaveD}{}}
                {% if
                }%
            	{% else
            	    ;\space\@palavraChaveD
                }
                \ifthenelse{\equal{\@palavraChaveE}{}}
                {% if
                }%
            	{% else
            	    ;\space\@palavraChaveE
                }
            }
        }
        \vspace*{12pt}
    ]
    \begin{textblock*}{120mm}(47mm, 17mm) % Cabecalho
	    \begin{center}
	        \textcolor{black}%
	        {%
	            {\normalsize\centering\MakeUppercase{\instituicao}\\ \vspace*{4pt}}
	            {\normalsize\centering\MakeUppercase{\instituto}\\ \vspace*{4pt}}
	            {\normalsize\centering\MakeUppercase{\txtCursoBach\space\@curso}\\ \vspace*{1pt}}
	        }%
	    \end{center}
	\end{textblock*}
	\begin{textblock*}{88.1mm}(15mm, 276.5mm) % Copyright, Data
	    \begin{center}
	        \hrulefill\\
	        \begin{flushleft}
	            \vspace*{-10pt}
	            {{\large\textcopyright}~IMC-UNIFEI - \@mes\space\txtDe\space\@ano}
	        \end{flushleft}
	    \end{center}
	\end{textblock*}
}

% Comando que produz os elementos pretextuais do documento: capa, folha de rosto...
\renewcommand{\maketitle}%
{%
    \hypersetup%
    {%
        pdftitle={\@titulo},    % title
        pdfauthor={\@autorNomeA\space\@autorSobrenomeA\space\@autorNomeB\space\@autorSobrenomeB},
        pdfsubject={\tipo\space-\space\@curso},   % subject of the document
        pdfcreator={\LaTeX\space+ imc.cls},
        pdfproducer={\instituto\space-\space\sigla},
        pdfkeywords={\@palavraChaveA\space\@palavraChaveB\space\@palavraChaveC\space\@palavraChaveD\space\@palavraChaveE},
    }%
    \twocolumn[\criaCapaDura]%
    \clearpage
    \twocolumn[\criaFichaCatalografica]~%
    \clearpage
    \ifthenelse{\equal{\@pdfAprovacao}{}}{%
        \twocolumn[\criaFolhaAprovacao]~%
    }{%
    \criaFolhaAprovacao%
    }
    \clearpage
    \thispagestyle{empty}~%
    \clearpage
    \criaPaginaInicialArtigo%
}

% Ambiente para figuras em formato paisagem
\newenvironment{figpaisagem}
{
	\begin{figure*}
        \begin{turn}{90}%
            \begin{minipage}{\textheight}%
                \begin{center}%
}%
{%
    	        \end{center}%
            \end{minipage}%
        \end{turn}
    \end{figure*}
}

% Ambiente para tabelas em formato paisagem
\newenvironment{tabpaisagem}
{
	\begin{table*}
        \begin{turn}{90}%
            \begin{minipage}{\textheight}%
                \begin{center}%
}%
{%
    	        \end{center}%
            \end{minipage}%
        \end{turn}
    \end{table*}
}

% Comando para figuras e tabelas em formato paisagem
\newcommand{\paisagem}[2]
{
    \ifthenelse{\equal{#1}{f}}
    {% if
        \begin{figure*}
            \begin{turn}{90}%
                \begin{minipage}{\textheight}%
                    \begin{center}%
                    #2
                    \end{center}%
                \end{minipage}%
            \end{turn}
        \end{figure*}
    }%
	{% else
	    \begin{table*}
            \begin{turn}{90}%
                \begin{minipage}{\textheight}%
                    \begin{center}%
                    #2
                    \end{center}%
                \end{minipage}%
            \end{turn}
        \end{table*}
    }
}

% Variaveis: elementos do texto
\AtBeginDocument
{%
	\newcommand{\capadura}{Capa}
	\newcommand{\contracapa}{Contra Capa}
	\newcommand{\fichacatalografica}{Ficha Catalográfica}
	\newcommand{\folhaaprovacao}{Folha de Aprovação}
	\newcommand{\myabstract}{\resumo}
	\newcommand{\resumo}{Resumo}
	\renewcommand{\bibname}{Referências}
	\renewcommand{\figurename}{Figura}
	\renewcommand{\lstlistingname}{Código}
	\renewcommand{\tablename}{Tabela}
	\renewcommand{\refname}{Referências}
}

\AtEndDocument
{
    \pdfbookmark[1]{\contracapa}{contracapa}
    \ifthenelse{\equal{\iscco}{1}}
	{% if
	    \includepdf[pages={1}]{./config/ccapa-cco.pdf}
	}%
	{% else
		\includepdf[pages={1}]{./config/ccapa-sin.pdf}
	}
}
