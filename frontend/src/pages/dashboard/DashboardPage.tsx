/**
 * DashboardPage — Visao geral da plataforma apos login.
 *
 * Mostra estatisticas, topicos recentes e oportunidades.
 * Por enquanto, conteudo placeholder que sera substituido
 * por dados reais da API.
 */

import { useAuth } from '../../contexts/AuthContext'

export default function DashboardPage() {
  const { user } = useAuth()

  const stats = [
    { label: 'Topicos ativos', value: '12', change: '+3 esta semana', color: '#003087' },
    { label: 'Reputacao', value: '245', change: '+30 pts', color: '#10B981' },
    { label: 'Horas voluntariado', value: '48h', change: '+8h este mes', color: '#F59E0B' },
    { label: 'Certificados', value: '3', change: '', color: '#C8102E' },
  ]

  return (
    <div>
      {/* Saudacao */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="font-bold tracking-tight" style={{ fontSize: '22px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Ola{user?.nome_completo ? `, ${user.nome_completo.split(' ')[0]}` : ''}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Bem-vindo de volta. Aqui esta o resumo da sua atividade.
        </p>
      </div>

      {/* Cards de estatisticas */}
      <div className="grid grid-cols-4" style={{ gap: '12px', marginBottom: '24px' }}>
        {stats.map((s, i) => (
          <div key={i} className="rounded-xl" style={{
            padding: '16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{s.label}</div>
            <div className="font-bold" style={{ fontSize: '22px', color: 'var(--text-primary)' }}>{s.value}</div>
            {s.change && (
              <div style={{ fontSize: '12px', color: s.color, marginTop: '4px' }}>{s.change}</div>
            )}
          </div>
        ))}
      </div>

      {/* Topicos recentes */}
      <div style={{ marginBottom: '24px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <h2 className="font-medium" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Topicos recentes no forum</h2>
          <a href="/forum" style={{ fontSize: '13px', color: '#003087' }}>Ver todos</a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { title: 'Como resolver exercicio de complexidade O(n log n)?', disc: 'XAS001 - Algoritmos', respostas: 3, tempo: 'ha 2 horas', votos: 7, resolvido: true },
            { title: 'Duvida sobre normalizacao de tabelas - 3FN vs BCNF', disc: 'XBD001 - Banco de Dados', respostas: 1, tempo: 'ha 5 horas', votos: 2, resolvido: false },
            { title: 'Qual a diferenca entre processo e thread?', disc: 'XCC101 - Sistemas Operacionais', respostas: 5, tempo: 'ha 1 dia', votos: 12, resolvido: true },
          ].map((post, i) => (
            <div key={i} className="flex rounded-xl cursor-pointer transition-all duration-150"
              style={{
                padding: '14px 16px', gap: '14px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
              }}>
              <div className="text-center" style={{ minWidth: '40px' }}>
                <div className="font-medium" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{post.votos}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>votos</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '6px' }}>{post.title}</div>
                <div className="flex items-center flex-wrap" style={{ gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span className="rounded" style={{ padding: '2px 8px', background: 'rgba(0,48,135,0.08)', color: '#003087', fontSize: '11px' }}>{post.disc}</span>
                  {post.resolvido && <span className="rounded" style={{ padding: '2px 8px', background: 'rgba(16,185,129,0.08)', color: '#10B981', fontSize: '11px' }}>Resolvido</span>}
                  <span>{post.respostas} respostas</span>
                  <span>{post.tempo}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Oportunidades */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <h2 className="font-medium" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Oportunidades de voluntariado</h2>
          <a href="/voluntariado" style={{ fontSize: '13px', color: '#003087' }}>Ver todas</a>
        </div>
        <div className="grid grid-cols-2" style={{ gap: '12px' }}>
          {[
            { titulo: 'Apoio a curso preparatorio comunitario', area: 'Educacao', cor: '#10B981', local: 'Itajuba/MG', horas: '40 horas', vagas: '3 de 5' },
            { titulo: 'Oficina de robotica para escolas publicas', area: 'Tecnologia', cor: '#8B5CF6', local: 'Itajuba/MG', horas: '12 horas', vagas: '1 de 3' },
          ].map((op, i) => (
            <div key={i} className="rounded-xl cursor-pointer transition-all duration-150"
              style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <span className="rounded" style={{ padding: '2px 8px', fontSize: '11px', background: `${op.cor}15`, color: op.cor }}>{op.area}</span>
              <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '8px 0 6px' }}>{op.titulo}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{op.local}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{op.horas}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{op.vagas} vagas preenchidas</div>
              <div className="rounded-full" style={{ height: '4px', background: 'var(--border)', marginTop: '10px' }}>
                <div className="rounded-full" style={{ height: '4px', background: op.cor, width: op.vagas === '3 de 5' ? '60%' : '33%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
