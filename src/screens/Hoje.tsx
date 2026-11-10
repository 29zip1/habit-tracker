import { useMemo, useState } from 'react';
import { operacoes } from '../database/operacoes';
import type { EntradaDia } from '../services/calculos';
import { arredondar, calcularDia, versaoVigente } from '../services/calculos';
import { formatarHorario, somarDias } from '../services/datas';
import { dataCurta, diaSemanaLongo, formatarNumero, textoRegistros } from '../services/textos';
import { CONFIG_PADRAO, type DataLocal } from '../types';
import { AvisoDesfazer } from '../components/AvisoDesfazer';
import { Cabecalho } from '../components/Cabecalho';
import { FaixaDias } from '../components/FaixaDias';
import { LinhaHabito, type ItemHabito } from '../components/LinhaHabito';
import { useAviso } from '../hooks/useAviso';
import { useDataHoje, useLive } from '../hooks/useLive';

export default function Hoje({ irParaAjustes }: { irParaAjustes: () => void }) {
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const hoje = useDataHoje(config.inicioDoDiaHora);
  const [escolhida, setEscolhida] = useState<DataLocal | null>(null);
  const data = escolhida ?? hoje;
  const ehHoje = data === hoje;
  const { aviso, mostrar, desfazer } = useAviso();

  const inicioFaixa = somarDias(hoje, -6);
  const entradasFaixa = useLive(
    () => operacoes.carregarEntradasDoIntervalo(inicioFaixa, hoje, hoje),
    [inicioFaixa, hoje],
    [] as EntradaDia[],
  );
  const entradaCarregada = useLive(
    () => operacoes.carregarEntradaDoDia(data, hoje),
    [data, hoje],
    null as EntradaDia | null,
  );
  const entrada = entradaCarregada && entradaCarregada.data === data ? entradaCarregada : null;

  const resumo = useMemo(() => (entrada ? calcularDia(entrada) : null), [entrada]);
  const faixa = useMemo(() => entradasFaixa.map(calcularDia), [entradasFaixa]);

  const itens: ItemHabito[] = useMemo(() => {
    if (!entrada || !resumo) return [];
    const lista: ItemHabito[] = [];
    entrada.habitos.forEach((h, i) => {
      const r = resumo.habitos[i];
      const versao = versaoVigente(h.versoes, data);
      if (r.programado && versao) lista.push({ habito: h.habito, versao, resumo: r });
    });
    return lista;
  }, [entrada, resumo, data]);

  const nomesAParte = useMemo(() => {
    if (!entrada || !resumo) return [];
    return resumo.foraDoPercentual
      .map((id) => entrada.habitos.find((h) => h.habito.id === id)?.habito.nome)
      .filter((n): n is string => Boolean(n));
  }, [entrada, resumo]);

  // ----- ações -----

  async function somar(item: ItemHabito, valor: number) {
    const { versao: v, habito } = item;
    const antes = item.resumo.total;
    const cruzou = v.tipo === 'quantidade' && antes < v.meta && arredondar(antes + valor) >= v.meta;
    const horario = ehHoje ? formatarHorario(new Date()) : '12:00';
    const registro = await operacoes.registrarValor(habito.id, valor, data, 'bloco', horario);
    const base = `${habito.nome} +${formatarNumero(valor)} ${v.unidade}`.trim();
    mostrar({
      rotulo: cruzou ? `Meta batida · ${base}` : base,
      cruzou,
      desfazer: async () => {
        await operacoes.excluirRegistro(registro.id);
      },
    });
  }

  async function alternar(item: ItemHabito) {
    const { versao: v, habito, resumo: r } = item;
    const marcado = await operacoes.alternarMarcacao(habito.id, data);
    const novaContagem = (r.contagemSemana ?? 0) + (marcado ? 1 : -1);
    const bateuSemana = v.tipo === 'semanal' && marcado && novaContagem >= v.meta;
    mostrar({
      rotulo: !marcado
        ? `${habito.nome} desmarcado`
        : bateuSemana
          ? `Meta da semana batida · ${habito.nome}`
          : `Concluído · ${habito.nome}`,
      cruzou: marcado,
      desfazer: async () => {
        await operacoes.alternarMarcacao(habito.id, data);
      },
    });
  }

  async function desfazerTudo(item: ItemHabito) {
    const removidos = await operacoes.excluirRegistrosDoDia(item.habito.id, data);
    if (removidos.length === 0) return;
    mostrar({
      rotulo: `${item.habito.nome} desfeito (${textoRegistros(removidos.length)})`,
      cruzou: false,
      desfazer: async () => {
        await operacoes.restaurarRegistros(removidos);
      },
    });
  }

  async function finalizarOuReabrir() {
    const fechadoAntes = entrada?.dia?.fechado === true;
    await operacoes.salvarDia(data, { fechado: !fechadoAntes });
    mostrar({
      rotulo: fechadoAntes ? 'Dia reaberto' : 'Dia finalizado',
      cruzou: false,
      desfazer: async () => {
        await operacoes.salvarDia(data, { fechado: fechadoAntes });
      },
    });
  }

  const fechadoManual = entrada?.dia?.fechado === true;

  return (
    <div
      className="h-full overflow-y-auto pb-28"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}
    >
      {!ehHoje && (
        <div className="mx-4 mb-3 flex items-center justify-between rounded-2xl bg-verde-claro px-4 py-2 text-[14px]">
          <span>
            Editando <strong>{dataCurta(data)}</strong> · {diaSemanaLongo(data).toLowerCase()}
          </span>
          <button
            type="button"
            onClick={() => setEscolhida(null)}
            className="h-11 rounded-full border-0 bg-transparent px-3 text-[14px] font-bold text-verde"
          >
            Voltar para hoje
          </button>
        </div>
      )}

      {resumo ? <Cabecalho resumo={resumo} nomesAParte={nomesAParte} /> : <div className="h-28" />}

      {faixa.length > 0 && (
        <FaixaDias
          dias={faixa}
          hoje={hoje}
          selecionada={data}
          aoSelecionar={(d) => setEscolhida(d === hoje ? null : d)}
        />
      )}

      <section className="mx-4 mt-2.5 overflow-hidden rounded-[20px] border border-borda bg-cartao px-4" aria-label="Hábitos do dia">
        {resumo && itens.length === 0 && (
          <div className="px-1 py-6 text-center text-[15px] text-texto2">
            <p>Nenhum hábito programado para este dia.</p>
            <button
              type="button"
              onClick={irParaAjustes}
              className="mt-3 h-11 rounded-full border-[1.5px] border-verde bg-cartao px-5 text-[14px] font-semibold text-verde"
            >
              Carregar hábitos de exemplo (Ajustes)
            </button>
          </div>
        )}
        {itens.map((item, i) => (
          <LinhaHabito
            key={item.habito.id}
            item={item}
            ehHoje={ehHoje}
            primeira={i === 0}
            aoSomar={(valor) => void somar(item, valor)}
            aoAlternar={() => void alternar(item)}
            aoDesfazerTudo={() => void desfazerTudo(item)}
          />
        ))}
      </section>

      {resumo && !resumo.fechado && ehHoje && (
        <div className="mx-4 mt-3 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => void finalizarOuReabrir()}
            className="h-11 rounded-full border-[1.5px] border-verde bg-transparent px-[22px] text-[14px] font-semibold text-verde"
          >
            Finalizar dia
          </button>
          <div className="text-center text-[12px] text-texto2">
            O dia fecha sozinho à meia-noite. Tudo fica salvo neste iPhone.
          </div>
        </div>
      )}
      {resumo && ehHoje && fechadoManual && (
        <div className="mx-4 mt-3 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => void finalizarOuReabrir()}
            className="h-11 rounded-full border-[1.5px] border-verde bg-transparent px-[22px] text-[14px] font-semibold text-verde"
          >
            Reabrir dia
          </button>
          <div className="text-center text-[12px] text-texto2">Dia finalizado. Tudo fica salvo neste iPhone.</div>
        </div>
      )}

      <AvisoDesfazer aviso={aviso} aoDesfazer={() => void desfazer()} />
    </div>
  );
}
