import { useMemo, useState } from 'react';
import { Cartao } from '../components/Cartao';
import Relatorio from './Relatorio';
import { GraficoBarras, type BarraDoGrafico } from '../components/GraficoBarras';
import { MapaCalor } from '../components/MapaCalor';
import { operacoes } from '../database/operacoes';
import { useDataHoje, useLive } from '../hooks/useLive';
import { versaoVigente, type EntradaDia, type HabitoCompleto } from '../services/calculos';
import {
  consistenciaPorIntervalo,
  desempenhoPorHabito,
  diasCompletosPorIntervalo,
  grelhaDoAno,
  intervaloDoMes,
  mesesRecentes,
  semanasRecentes,
  totaisPorIntervalo,
} from '../services/evolucao';
import {
  NOMES_MESES,
  periodoDe,
  resumirPeriodo,
  resumosDosDias,
  ROTULOS_PERIODO,
  mesDaData,
  type TipoPeriodo,
} from '../services/historico';
import { dataCurta, formatarNumero } from '../services/textos';
import { CONFIG_PADRAO, type DataLocal } from '../types';

const PERIODOS: TipoPeriodo[] = ['7', '30', '90', 'ano', 'tudo'];
const SEMANAS = 8;
const MESES = 6;

const plural = (n: number, um: string, varios: string) => `${formatarNumero(n)} ${n === 1 ? um : varios}`;

/** Aba Evolução (Fase 7, Parte A): indicadores, desempenho por hábito, gráficos e mapa de calor. */
export default function Evolucao() {
  const [verRelatorio, setVerRelatorio] = useState(false);
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const hoje = useDataHoje(config.inicioDoDiaHora);
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('30');
  const [habitoAcum, setHabitoAcum] = useState<string>('');
  const [agrupar, setAgrupar] = useState<'semanas' | 'meses'>('semanas');

  const habitos = useLive(() => operacoes.lerHabitosCompletos(), [], [] as HabitoCompleto[]);
  const primeira = useLive(() => operacoes.primeiraData(), [], undefined as DataLocal | undefined);

  const mesAtual = mesDaData(hoje);
  const periodo = periodoDe(tipoPeriodo, mesAtual, hoje, primeira);
  const semanas = useMemo(() => semanasRecentes(hoje, SEMANAS, config.inicioSemana), [hoje, config.inicioSemana]);
  const meses = useMemo(() => mesesRecentes(hoje, MESES), [hoje]);
  const gradeAno = useMemo(() => grelhaDoAno(mesAtual.ano, config.inicioSemana), [mesAtual.ano, config.inicioSemana]);

  // Carrega de uma vez tudo que as telas pedem (período, 8 semanas, 6 meses e o ano).
  const inicioCarga = [periodo.inicio, semanas[0].inicio, intervaloDoMes(meses[0]).inicio, `${mesAtual.ano}-01-01`].sort()[0];
  const entradas = useLive(
    () => operacoes.carregarEntradasDoIntervalo(inicioCarga, hoje, hoje),
    [inicioCarga, hoje],
    [] as EntradaDia[],
  );

  const resumos = useMemo(() => resumosDosDias(entradas, null), [entradas]);
  const porData = useMemo(() => new Map(resumos.map((r) => [r.data, r])), [resumos]);

  const indicadores = useMemo(
    () =>
      resumirPeriodo(
        resumos.filter((r) => r.data >= periodo.inicio && r.data <= periodo.fim),
        primeira,
        hoje,
        null,
      ),
    [resumos, periodo.inicio, periodo.fim, primeira, hoje],
  );
  const desempenho = useMemo(
    () => desempenhoPorHabito(entradas, habitos, periodo, primeira, hoje),
    [entradas, habitos, periodo, primeira, hoje],
  );

  const semDados = primeira === undefined;
  const p = indicadores.periodo;
  const incluiHoje = periodo.fim >= hoje;

  const barrasSemana: BarraDoGrafico[] = useMemo(() => {
    const valores = diasCompletosPorIntervalo(resumos, semanas, primeira, hoje);
    return semanas.map((s, i) => ({
      rotulo: dataCurta(s.inicio),
      valor: s.inicio > hoje ? null : valores[i],
      texto: String(valores[i]),
    }));
  }, [resumos, semanas, primeira, hoje]);

  const barrasMes: BarraDoGrafico[] = useMemo(() => {
    const valores = consistenciaPorIntervalo(resumos, meses.map(intervaloDoMes), primeira, hoje);
    return meses.map((m, i) => ({
      rotulo: NOMES_MESES[m.mes - 1].slice(0, 3),
      valor: valores[i],
      texto: `${valores[i]}%`,
    }));
  }, [resumos, meses, primeira, hoje]);

  // Quantidades acumuladas: só hábitos de quantidade e de limite.
  const comQuantidade = habitos.filter((h) => {
    if (h.habito.status === 'removido') return false;
    const v = versaoVigente(h.versoes, hoje) ?? h.versoes[0];
    return v && (v.tipo === 'quantidade' || v.tipo === 'limite');
  });
  const habitoAcumulado = comQuantidade.find((h) => h.habito.id === habitoAcum) ?? comQuantidade[0];
  const unidade = habitoAcumulado ? (versaoVigente(habitoAcumulado.versoes, hoje) ?? habitoAcumulado.versoes[0])?.unidade ?? '' : '';

  const barrasAcum: BarraDoGrafico[] = useMemo(() => {
    if (!habitoAcumulado) return [];
    const r = resumosDosDias(entradas, habitoAcumulado.habito.id);
    const intervalos = agrupar === 'semanas' ? semanas : meses.map(intervaloDoMes);
    const totais = totaisPorIntervalo(r, intervalos, hoje);
    return intervalos.map((iv, i) => ({
      rotulo: agrupar === 'semanas' ? dataCurta(iv.inicio) : NOMES_MESES[meses[i].mes - 1].slice(0, 3),
      valor: iv.inicio > hoje ? null : totais[i],
      texto: `${formatarNumero(totais[i])}`,
    }));
  }, [habitoAcumulado, entradas, agrupar, semanas, meses, hoje]);
  const maxAcum = Math.max(1, ...barrasAcum.map((b) => b.valor ?? 0));

  const diasDoAno = gradeAno.flat().filter((d): d is DataLocal => d !== null);
  const contagemAno = (estado: string) =>
    diasDoAno.filter((d) => d <= hoje && (primeira === undefined || d >= primeira) && porData.get(d)?.estado === estado).length;
  const leituraMapa = `Mapa de calor de ${mesAtual.ano}: ${plural(contagemAno('completo'), 'dia completo', 'dias completos')}, ${plural(
    contagemAno('parcial'),
    'dia parcial',
    'dias parciais',
  )}, ${plural(contagemAno('folga'), 'dia de folga', 'dias de folga')}.`;

  if (verRelatorio) return <Relatorio aoVoltar={() => setVerRelatorio(false)} />;

  return (
    <div className="h-full overflow-y-auto px-4 pb-28" style={{ paddingTop: 'var(--topo-seguro)' }}>
      <div className="mx-auto flex max-w-[480px] flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[28px] font-bold leading-tight">Evolução</h1>
          <button
            type="button"
            onClick={() => setVerRelatorio(true)}
            className="h-11 shrink-0 rounded-full border-[1.5px] border-verde-texto bg-cartao px-4 text-[14px] font-semibold text-verde-texto"
          >
            Ver relatório
          </button>
        </div>

        {semDados ? (
          <p className="rounded-2xl border border-borda bg-cartao p-4 text-[15px] text-texto2">
            Ainda não há registros. Quando você registrar o primeiro hábito, aqui aparecem os indicadores e os gráficos.
          </p>
        ) : (
          <>
            <div role="radiogroup" aria-label="Período" className="flex flex-wrap gap-2">
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

            <section aria-label="Indicadores" className="grid grid-cols-2 gap-3">
              <Cartao
                titulo="Dias completos"
                valor={p.diasDoPeriodo === 0 ? '—' : `${p.diasCompletos} de ${p.diasDoPeriodo}`}
                detalhe={p.consistenciaPct === null ? undefined : `${p.consistenciaPct}% dos dias do período`}
              />
              <Cartao titulo="Melhor sequência" valor={plural(p.melhorSequencia, 'dia', 'dias')} />
              {incluiHoje && <Cartao titulo="Sequência atual" valor={plural(p.sequenciaAtual, 'dia', 'dias')} />}
              <Cartao titulo="Metas superadas" valor={formatarNumero(indicadores.metasSuperadas)} />
              <Cartao titulo="Dias de folga" valor={formatarNumero(p.diasFolga)} />
              <Cartao
                titulo="Dias parciais"
                valor={formatarNumero(p.diasParciais)}
                detalhe={plural(p.diasSemDados, 'dia sem dados', 'dias sem dados')}
              />
            </section>

            <section aria-labelledby="t-desemp" className="flex flex-col gap-2">
              <h2 id="t-desemp" className="text-[16px] font-semibold">
                Desempenho por hábito
              </h2>
              <div className="rounded-[20px] border border-borda bg-cartao px-4 py-1">
                {desempenho.length === 0 && <p className="py-3 text-[14px] text-texto2">Nenhum hábito.</p>}
                {desempenho.map((d, i) => (
                  <div key={d.habitoId} className={`py-3 ${i > 0 ? 'border-t border-linha' : ''}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-semibold">{d.nome}</span>
                      <span className="shrink-0 text-[13px] text-texto2">
                        {d.programados === 0 ? 'sem dias programados' : `${d.feitos} de ${d.programados} dias`}
                      </span>
                    </div>
                    <div
                      role="img"
                      aria-label={`${d.nome}: ${d.pct === null ? 'sem dias programados' : `${d.pct}% dos dias feitos`}`}
                      className="mt-1.5 h-1.5 overflow-hidden rounded-[3px] bg-trilho"
                    >
                      <div className="h-1.5 bg-verde-barra" style={{ width: `${d.pct ?? 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="t-graf" className="flex flex-col gap-3">
              <h2 id="t-graf" className="text-[16px] font-semibold">
                Gráficos
              </h2>
              <GraficoBarras titulo={`Dias completos por semana (últimas ${SEMANAS})`} barras={barrasSemana} maximo={7} />
              <GraficoBarras titulo={`Consistência por mês (últimos ${MESES})`} barras={barrasMes} maximo={100} />

              {habitoAcumulado && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-[14px] font-semibold">Quantidade acumulada de</span>
                      <select
                        value={habitoAcumulado.habito.id}
                        onChange={(e) => setHabitoAcum(e.target.value)}
                        className="box-border h-12 w-full min-w-0 rounded-xl border-[1.5px] border-cinza-anel bg-cartao px-3 text-[16px] text-texto"
                      >
                        {comQuantidade.map((h) => (
                          <option key={h.habito.id} value={h.habito.id}>
                            {h.habito.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div role="radiogroup" aria-label="Agrupar por" className="flex gap-2">
                      {(['semanas', 'meses'] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          role="radio"
                          aria-checked={agrupar === a}
                          onClick={() => setAgrupar(a)}
                          className={`h-11 flex-1 rounded-full border-[1.5px] text-[14px] font-semibold ${
                            agrupar === a ? 'border-verde bg-verde text-white' : 'border-borda-bloco bg-cartao text-verde-texto'
                          }`}
                        >
                          {a === 'semanas' ? 'Semanas' : 'Meses'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <GraficoBarras
                    titulo={`${habitoAcumulado.habito.nome}: total por ${agrupar === 'semanas' ? 'semana' : 'mês'} (${unidade})`}
                    barras={barrasAcum}
                    maximo={maxAcum}
                  />
                </>
              )}
            </section>

            <section aria-labelledby="t-mapa" className="flex flex-col gap-2">
              <h2 id="t-mapa" className="text-[16px] font-semibold">
                Mapa do ano {mesAtual.ano}
              </h2>
              <MapaCalor
                grelha={gradeAno}
                resumos={porData}
                hoje={hoje}
                primeiraData={primeira}
                inicioSemana={config.inicioSemana}
                leitura={leituraMapa}
              />
              <p className="text-[12px] text-texto2">
                ● completo · ◐ parcial · ◌ sem dados · ⊖ folga. Deslize para os lados para ver o ano todo.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
