import { useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Cartao } from '../components/Cartao';
import { operacoes } from '../database/operacoes';
import { useDataHoje, useLive } from '../hooks/useLive';
import type { EntradaDia, HabitoCompleto } from '../services/calculos';
import { baixarArquivo, compartilharArquivo } from '../services/compartilhar';
import { somarDias } from '../services/datas';
import {
  csvDoRelatorio,
  montarRelatorio,
  nomeArquivoRelatorio,
  periodoDoRelatorio,
  ROTULOS_RELATORIO,
  textoDoRelatorio,
  type TipoRelatorio,
} from '../services/relatorio';
import { formatarNumero } from '../services/textos';
import { CONFIG_PADRAO, type DataLocal } from '../types';

const TIPOS: TipoRelatorio[] = ['semana', 'mes', 'mesAnterior', 'personalizado'];
const plural = (n: number, um: string, varios: string) => `${formatarNumero(n)} ${n === 1 ? um : varios}`;
const dataBr = (d: DataLocal) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const campoData =
  'box-border h-12 w-full min-w-0 max-w-full appearance-none rounded-xl border-[1.5px] border-cinza-anel bg-cartao px-3 text-left text-[16px] text-texto';
const botaoAcao =
  'h-12 rounded-full border-[1.5px] border-verde-texto bg-cartao px-5 text-[15px] font-semibold text-verde-texto disabled:opacity-50';

/** Tela Relatório (Fase 7, Parte B, RF-51): resumo do período e exportação em texto e CSV. */
export default function Relatorio({ aoVoltar }: { aoVoltar: () => void }) {
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const hoje = useDataHoje(config.inicioDoDiaHora);
  const [tipo, setTipo] = useState<TipoRelatorio>('mes');
  const [inicio, setInicio] = useState<string>(() => somarDias(hoje, -6));
  const [fim, setFim] = useState<string>(() => hoje);
  const [mensagem, setMensagem] = useState('');

  const habitos = useLive(() => operacoes.lerHabitosCompletos(), [], [] as HabitoCompleto[]);
  const primeira = useLive(() => operacoes.primeiraData(), [], undefined as DataLocal | undefined);

  const calculo = periodoDoRelatorio(tipo, hoje, config.inicioSemana, { inicio, fim });
  const periodo = calculo.ok ? calculo.periodo : { inicio: hoje, fim: hoje };
  const entradas = useLive(
    () => (calculo.ok ? operacoes.carregarEntradasDoIntervalo(periodo.inicio, periodo.fim, hoje) : Promise.resolve([] as EntradaDia[])),
    [calculo.ok, periodo.inicio, periodo.fim, hoje],
    [] as EntradaDia[],
  );

  const relatorio = useMemo(
    () => (calculo.ok ? montarRelatorio(entradas, habitos, periodo, ROTULOS_RELATORIO[tipo], primeira, hoje) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entradas, habitos, calculo.ok, periodo.inicio, periodo.fim, tipo, primeira, hoje],
  );

  // Os arquivos ficam PRONTOS antes do toque (regra do iPhone para o compartilhamento).
  const texto = useMemo(() => (relatorio ? textoDoRelatorio(relatorio) : ''), [relatorio]);
  const arquivoTxt = useMemo(
    () => (relatorio ? new File([texto], nomeArquivoRelatorio(relatorio.periodo, 'txt'), { type: 'text/plain' }) : null),
    [relatorio, texto],
  );
  const arquivoCsv = useMemo(
    () => (relatorio ? new File([csvDoRelatorio(relatorio)], nomeArquivoRelatorio(relatorio.periodo, 'csv'), { type: 'text/csv' }) : null),
    [relatorio],
  );

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setMensagem('Texto copiado. Agora é só colar.');
    } catch {
      setMensagem('Não consegui copiar. Use "Compartilhar texto".');
    }
  }

  async function compartilhar(arquivo: File | null, titulo: string) {
    if (!arquivo) return;
    const r = await compartilharArquivo(arquivo, titulo);
    if (r === 'indisponivel') {
      baixarArquivo(arquivo);
      setMensagem('Arquivo baixado.');
    } else if (r === 'compartilhado') setMensagem('Pronto.');
    else if (r === 'erro') setMensagem('Não consegui compartilhar agora. Tente de novo.');
    else setMensagem('');
  }

  const p = relatorio?.resumo;

  return (
    <div className="h-full overflow-y-auto px-4 pb-28" style={{ paddingTop: 'var(--topo-seguro)' }}>
      <div className="mx-auto flex max-w-[480px] flex-col gap-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Voltar para Evolução"
            onClick={aoVoltar}
            className="-ml-2 flex size-11 items-center justify-center rounded-full border-0 bg-transparent p-0 text-texto"
          >
            <ChevronLeft size={26} aria-hidden="true" />
          </button>
          <h1 className="text-[28px] font-bold leading-tight">Relatório</h1>
        </div>

        <div role="radiogroup" aria-label="Período do relatório" className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => {
                setTipo(t);
                setMensagem('');
              }}
              className={`h-11 rounded-full border-[1.5px] px-4 text-[14px] font-semibold ${
                tipo === t ? 'border-verde bg-verde text-white' : 'border-borda-bloco bg-cartao text-verde-texto'
              }`}
            >
              {ROTULOS_RELATORIO[t]}
            </button>
          ))}
        </div>

        {tipo === 'personalizado' && (
          <div className="flex flex-col gap-3">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[14px] font-semibold">De</span>
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campoData} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[14px] font-semibold">Até</span>
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={campoData} />
            </label>
          </div>
        )}

        {!calculo.ok && (
          <p role="alert" className="rounded-xl border border-laranja bg-laranja-claro p-3 text-[14px] text-laranja-texto">
            {calculo.erro}
          </p>
        )}

        {relatorio && p && (
          <>
            <p className="text-[14px] text-texto2">
              Período: {dataBr(relatorio.periodo.inicio)} a {dataBr(relatorio.periodo.fim)}. Dias que ainda não chegaram não entram.
            </p>

            <section aria-label="Resumo" className="grid grid-cols-2 gap-3">
              <Cartao
                titulo="Dias completos"
                valor={p.diasDoPeriodo === 0 ? '—' : `${p.diasCompletos} de ${p.diasDoPeriodo}`}
                detalhe={p.consistenciaPct === null ? 'sem dias para contar' : `${p.consistenciaPct}% dos dias do período`}
              />
              <Cartao titulo="Dias parciais" valor={formatarNumero(p.diasParciais)} />
              <Cartao titulo="Sem dados" valor={formatarNumero(p.diasSemDados)} />
              <Cartao titulo="Folga" valor={formatarNumero(p.diasFolga)} />
              {relatorio.periodo.fim >= hoje && <Cartao titulo="Sequência atual" valor={plural(p.sequenciaAtual, 'dia', 'dias')} />}
              <Cartao titulo="Melhor sequência" valor={plural(p.melhorSequencia, 'dia', 'dias')} />
              <Cartao titulo="Metas superadas" valor={formatarNumero(relatorio.metasSuperadas)} />
            </section>

            <section aria-labelledby="t-rh" className="flex flex-col gap-2">
              <h2 id="t-rh" className="text-[16px] font-semibold">
                Por hábito
              </h2>
              <div className="rounded-[20px] border border-borda bg-cartao px-4 py-1">
                {relatorio.habitos.length === 0 && <p className="py-3 text-[14px] text-texto2">Nenhum hábito neste período.</p>}
                {relatorio.habitos.map((h, i) => (
                  <div key={h.habitoId} className={`flex flex-col gap-0.5 py-3 text-[14px] ${i > 0 ? 'border-t border-linha' : ''}`}>
                    <span className="text-[15px] font-semibold">
                      {h.nome}
                      {h.apagado ? ' (apagado)' : ''}
                    </span>
                    <span className="text-texto2">
                      {h.diasProgramados === 0 ? 'Sem dias programados' : `Dias feitos: ${h.diasFeitos} de ${h.diasProgramados}`}
                    </span>
                    {(h.tipo === 'quantidade' || h.tipo === 'limite') && (
                      <>
                        <span className="text-texto2">
                          Total: {formatarNumero(h.total)} {h.unidade}
                        </span>
                        <span className="text-texto2">
                          Média por dia programado: {h.mediaPorDia === null ? '—' : `${formatarNumero(h.mediaPorDia)} ${h.unidade}`}
                        </span>
                      </>
                    )}
                    {h.tipo === 'quantidade' && <span className="text-texto2">Metas superadas: {h.metasSuperadas}</span>}
                    {h.tipo === 'limite' && <span className="text-texto2">Dias dentro do limite: {h.diasDentroDoLimite}</span>}
                  </div>
                ))}
              </div>
            </section>

            {relatorio.notas.length > 0 && (
              <section aria-labelledby="t-rn" className="flex flex-col gap-2">
                <h2 id="t-rn" className="text-[16px] font-semibold">
                  Notas do dia
                </h2>
                <div className="rounded-[20px] border border-borda bg-cartao px-4 py-1">
                  {relatorio.notas.map((n, i) => (
                    <div key={n.data} className={`py-3 text-[14px] ${i > 0 ? 'border-t border-linha' : ''}`}>
                      <span className="font-semibold">{dataBr(n.data)}</span> · {n.texto}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="t-re" className="flex flex-col gap-2">
              <h2 id="t-re" className="text-[16px] font-semibold">
                Exportar
              </h2>
              <p className="text-[13px] text-texto2">Funciona sem internet. Os números são os mesmos desta tela.</p>
              <div className="flex flex-col gap-2">
                <button type="button" className={botaoAcao} onClick={() => void copiar()}>
                  Copiar texto
                </button>
                <button type="button" className={botaoAcao} disabled={!arquivoTxt} onClick={() => void compartilhar(arquivoTxt, 'Relatório do Habit Tracker')}>
                  Compartilhar texto (.txt)
                </button>
                <button type="button" className={botaoAcao} disabled={!arquivoCsv} onClick={() => void compartilhar(arquivoCsv, 'Relatório do Habit Tracker (planilha)')}>
                  Exportar planilha (CSV)
                </button>
              </div>
              {mensagem && <p className="text-[14px]" role="status">{mensagem}</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
