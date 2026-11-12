import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarioMes } from '../components/CalendarioMes';
import { Cartao } from '../components/Cartao';
import { operacoes } from '../database/operacoes';
import { useDataHoje, useLive } from '../hooks/useLive';
import { versaoVigente, type EntradaDia, type HabitoCompleto, type ResumoDia } from '../services/calculos';
import {
  compararMeses,
  mesDaData,
  nomeDoMes,
  periodoDe,
  resumirPeriodo,
  resumosDosDias,
  ROTULOS_PERIODO,
  somarMeses,
  type MesRef,
  type TipoPeriodo,
} from '../services/historico';
import { formatarNumero } from '../services/textos';
import { CONFIG_PADRAO, type DataLocal } from '../types';

const PERIODOS: TipoPeriodo[] = ['mes', '30', '90', 'ano', 'tudo'];

const plural = (n: number, um: string, varios: string) => `${formatarNumero(n)} ${n === 1 ? um : varios}`;

/** Aba Histórico (Fase 6): calendário mensal, filtros por período e por hábito, e resumo. */
export default function Historico({ aoAbrirDia }: { aoAbrirDia: (data: DataLocal) => void }) {
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const hoje = useDataHoje(config.inicioDoDiaHora);
  const mesAtual = mesDaData(hoje);
  const [mes, setMes] = useState<MesRef>(mesAtual);
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('mes');
  const [habitoId, setHabitoId] = useState<string | null>(null);

  const habitos = useLive(() => operacoes.lerHabitosCompletos(), [], [] as HabitoCompleto[]);
  const primeira = useLive(() => operacoes.primeiraData(), [], undefined as DataLocal | undefined);
  const escolhiveis = habitos.filter((h) => h.habito.status !== 'removido');
  const habitoEscolhido = habitos.find((h) => h.habito.id === habitoId);

  const periodo = periodoDe(tipoPeriodo, mes, hoje, primeira);
  const inicioMes = `${mes.ano}-${String(mes.mes).padStart(2, '0')}-01`;
  const fimMes = periodoDe('mes', mes, hoje).fim;
  // Carrega o mês do calendário e o período do resumo de uma vez.
  const inicio = periodo.inicio < inicioMes ? periodo.inicio : inicioMes;
  const fim = periodo.fim > fimMes ? periodo.fim : fimMes;

  const entradas = useLive(
    () => operacoes.carregarEntradasDoIntervalo(inicio, fim, hoje),
    [inicio, fim, hoje],
    [] as EntradaDia[],
  );

  const resumos = useMemo(() => resumosDosDias(entradas, habitoId), [entradas, habitoId]);
  const porData = useMemo(() => new Map(resumos.map((r) => [r.data, r])), [resumos]);
  const comNota = useMemo(
    () => new Set(entradas.filter((e) => (e.dia?.nota ?? '').trim() !== '').map((e) => e.data)),
    [entradas],
  );
  const doMes = useMemo(() => {
    const m = new Map<DataLocal, ResumoDia>();
    porData.forEach((r, d) => {
      if (d >= inicioMes && d <= fimMes) m.set(d, r);
    });
    return m;
  }, [porData, inicioMes, fimMes]);

  const resumo = useMemo(
    () =>
      resumirPeriodo(
        resumos.filter((r) => r.data >= periodo.inicio && r.data <= periodo.fim),
        primeira,
        hoje,
        habitoId,
      ),
    [resumos, periodo.inicio, periodo.fim, primeira, hoje, habitoId],
  );

  const podeVoltar = primeira ? compararMeses(mes, mesDaData(primeira)) > 0 : false;
  const podeAvancar = compararMeses(mes, mesAtual) < 0;
  const versaoDoHabito = habitoEscolhido ? versaoVigente(habitoEscolhido.versoes, hoje) ?? habitoEscolhido.versoes[0] : undefined;
  const incluiHoje = periodo.fim >= hoje;
  const p = resumo.periodo;
  const h = resumo.habito;
  const semDados = primeira === undefined;

  const botaoMes =
    'flex size-11 items-center justify-center rounded-full border-0 bg-transparent p-0 text-texto disabled:opacity-30';

  return (
    <div className="h-full overflow-y-auto px-4 pb-28" style={{ paddingTop: 'var(--topo-seguro)' }}>
      <div className="mx-auto flex max-w-[480px] flex-col gap-4">
        <h1 className="text-[28px] font-bold leading-tight">Histórico</h1>

        <div className="flex items-center justify-between">
          <button type="button" aria-label="Mês anterior" disabled={!podeVoltar} onClick={() => setMes(somarMeses(mes, -1))} className={botaoMes}>
            <ChevronLeft size={24} aria-hidden="true" />
          </button>
          <div className="flex flex-col items-center">
            <div className="text-[18px] font-bold" aria-live="polite">
              {nomeDoMes(mes)}
            </div>
            {compararMeses(mes, mesAtual) !== 0 && (
              <button
                type="button"
                onClick={() => setMes(mesAtual)}
                className="h-8 border-0 bg-transparent p-0 text-[13px] font-semibold text-verde-texto underline"
              >
                Ir para este mês
              </button>
            )}
          </div>
          <button type="button" aria-label="Próximo mês" disabled={!podeAvancar} onClick={() => setMes(somarMeses(mes, 1))} className={botaoMes}>
            <ChevronRight size={24} aria-hidden="true" />
          </button>
        </div>

        <CalendarioMes
          mes={mes}
          hoje={hoje}
          inicioSemana={config.inicioSemana}
          resumos={doMes}
          comNota={comNota}
          aoEscolher={aoAbrirDia}
        />

        <p className="-mt-2 text-[12px] text-texto2">
          ● completo · ◐ parcial · ◌ sem dados · ⊖ folga · ponto pequeno: descanso. Toque num dia para abrir e editar.
        </p>

        <section className="flex flex-col gap-3" aria-label="Filtros">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[14px] font-semibold">Hábito</span>
            <select
              value={habitoId ?? ''}
              onChange={(e) => setHabitoId(e.target.value === '' ? null : e.target.value)}
              className="box-border h-12 w-full min-w-0 rounded-xl border-[1.5px] border-cinza-anel bg-cartao px-3 text-[16px] text-texto"
            >
              <option value="">Todos os hábitos</option>
              {escolhiveis.map((x) => (
                <option key={x.habito.id} value={x.habito.id}>
                  {x.habito.nome}
                  {x.habito.status === 'arquivado' ? ' (arquivado)' : ''}
                </option>
              ))}
            </select>
          </label>

          <div role="radiogroup" aria-label="Período do resumo" className="flex flex-wrap gap-2">
            {PERIODOS.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tipoPeriodo === t}
                onClick={() => setTipoPeriodo(t)}
                className={`h-11 rounded-full border-[1.5px] px-4 text-[14px] font-semibold ${
                  tipoPeriodo === t ? 'border-verde bg-verde text-white' : 'border-borda-bloco bg-cartao text-verde-texto'
                }`}
              >
                {ROTULOS_PERIODO[t]}
              </button>
            ))}
          </div>
        </section>

        <section aria-label="Resumo do período" className="flex flex-col gap-3">
          <h2 className="text-[16px] font-semibold">
            Resumo · {tipoPeriodo === 'mes' ? nomeDoMes(mes) : ROTULOS_PERIODO[tipoPeriodo]}
            {habitoEscolhido ? ` · ${habitoEscolhido.habito.nome}` : ''}
          </h2>

          {semDados ? (
            <p className="rounded-2xl border border-borda bg-cartao p-4 text-[14px] text-texto2">
              Ainda não há registros. Quando você registrar o primeiro hábito, o resumo aparece aqui.
            </p>
          ) : habitoId === null ? (
            <div className="grid grid-cols-2 gap-3">
              <Cartao
                titulo="Dias completos"
                valor={p.diasDoPeriodo === 0 ? '—' : `${p.diasCompletos} de ${p.diasDoPeriodo}`}
                detalhe={p.consistenciaPct === null ? undefined : `${p.consistenciaPct}% dos dias do período`}
              />
              <Cartao titulo="Melhor sequência" valor={plural(p.melhorSequencia, 'dia', 'dias')} />
              {incluiHoje && <Cartao titulo="Sequência atual" valor={plural(p.sequenciaAtual, 'dia', 'dias')} />}
              <Cartao titulo="Metas superadas" valor={formatarNumero(resumo.metasSuperadas)} />
              <Cartao titulo="Dias de folga" valor={formatarNumero(p.diasFolga)} />
              <Cartao titulo="Dias parciais" valor={formatarNumero(p.diasParciais)} detalhe={`${plural(p.diasSemDados, 'dia sem dados', 'dias sem dados')}`} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Cartao
                titulo="Dias feitos"
                valor={!h || h.diasProgramados === 0 ? '—' : `${h.diasFeitos} de ${h.diasProgramados}`}
                detalhe={h && h.diasProgramados > 0 ? `${Math.round((h.diasFeitos / h.diasProgramados) * 100)}% dos dias programados` : undefined}
              />
              {versaoDoHabito && (versaoDoHabito.tipo === 'quantidade' || versaoDoHabito.tipo === 'limite') ? (
                <>
                  <Cartao titulo="Total no período" valor={`${formatarNumero(h?.total ?? 0)} ${versaoDoHabito.unidade}`} />
                  <Cartao
                    titulo="Média por dia"
                    valor={h?.mediaPorDia == null ? '—' : `${formatarNumero(h.mediaPorDia)} ${versaoDoHabito.unidade}`}
                  />
                  <Cartao titulo="Metas superadas" valor={formatarNumero(resumo.metasSuperadas)} />
                </>
              ) : (
                <Cartao titulo="Melhor sequência" valor={plural(p.melhorSequencia, 'dia', 'dias')} />
              )}
              {incluiHoje && <Cartao titulo="Sequência atual" valor={plural(p.sequenciaAtual, 'dia', 'dias')} />}
              <Cartao titulo="Dias de folga" valor={formatarNumero(p.diasFolga)} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
