import { useMemo, useState } from 'react';
import { db } from '../database/db';
import { operacoes } from '../database/operacoes';
import type { EntradaDia } from '../services/calculos';
import { arredondar, calcularDia, limiteAtingido, versaoVigente } from '../services/calculos';
import { formatarHorario, somarDias } from '../services/datas';
import {
  dataCurta,
  diaSemanaLongo,
  formatarNumero,
  textoRegistros,
} from '../services/textos';
import { CONFIG_PADRAO, type DataLocal, type OrigemRegistro, type Registro } from '../types';
import { AvisoDesfazer } from '../components/AvisoDesfazer';
import { Cabecalho } from '../components/Cabecalho';
import { FaixaBackup } from '../components/FaixaBackup';
import { FaixaDias } from '../components/FaixaDias';
import { JanelaValor, type ConfigJanela } from '../components/JanelaValor';
import { LinhaHabito, type ItemHabito } from '../components/LinhaHabito';
import { NotaDia } from '../components/NotaDia';
import { PrimeiroUso } from '../components/PrimeiroUso';
import { PainelRegistros } from '../components/PainelRegistros';
import { useAviso } from '../hooks/useAviso';
import { useDataHoje, useLive } from '../hooks/useLive';

interface JanelaAberta extends ConfigJanela {
  habitoId: string;
  registroId?: string;
  origem: OrigemRegistro;
}

const botaoSecundario =
  'h-11 rounded-full border-[1.5px] border-verde-texto bg-transparent px-[22px] text-[14px] font-semibold text-verde-texto';
const botaoLink = 'h-11 rounded-full border-0 bg-transparent px-3 text-[14px] font-semibold text-verde-texto underline';

export default function Hoje({ irParaAjustes, irParaHabitos }: { irParaAjustes: () => void; irParaHabitos: () => void }) {
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const hoje = useDataHoje(config.inicioDoDiaHora);
  const [escolhida, setEscolhida] = useState<DataLocal | null>(null);
  const data = escolhida ?? hoje;
  const ehHoje = data === hoje;
  const { aviso, mostrar, desfazer } = useAviso();

  const [painelId, setPainelId] = useState<string | null>(null);
  const [janela, setJanela] = useState<JanelaAberta | null>(null);
  const [notaAberta, setNotaAberta] = useState(false);
  const totalHabitos = useLive(() => db.habitos.count(), [], -1);

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

  const itemDoPainel = painelId ? (itens.find((i) => i.habito.id === painelId) ?? null) : null;
  const registrosDoPainel: Registro[] = useMemo(() => {
    if (!entrada || !painelId) return [];
    return entrada.registros
      .filter((r) => r.habitoId === painelId && r.data === data)
      .sort((a, b) => (a.horario === b.horario ? (a.criadoEm < b.criadoEm ? -1 : 1) : a.horario < b.horario ? -1 : 1));
  }, [entrada, painelId, data]);

  const horarioPadrao = () => (ehHoje ? formatarHorario(new Date()) : '12:00');

  // ----- ações -----

  async function registrar(item: ItemHabito, valor: number, origem: OrigemRegistro, horario?: string) {
    const { versao: v, habito } = item;
    const antes = item.resumo.total;
    const depois = arredondar(antes + valor);
    const cruzouMeta = v.tipo === 'quantidade' && antes < v.meta && depois >= v.meta;
    const cruzouLimite = v.tipo === 'limite' && !limiteAtingido(antes, v.meta) && limiteAtingido(depois, v.meta);
    const cruzou = cruzouMeta || cruzouLimite;
    const registro = await operacoes.registrarValor(habito.id, valor, data, origem, horario ?? horarioPadrao());
    const base = `${habito.nome} +${formatarNumero(valor)} ${v.unidade}`.trim();
    mostrar({
      rotulo: cruzouLimite ? `Quantidade atingida · ${base}` : cruzouMeta ? `Meta batida · ${base}` : base,
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

  async function alternarFolga() {
    const folgaAntes = entrada?.dia?.folga === true;
    await operacoes.salvarDia(data, { folga: !folgaAntes });
    mostrar({
      rotulo: folgaAntes ? 'Folga removida deste dia' : 'Dia marcado como folga',
      cruzou: false,
      desfazer: async () => {
        await operacoes.salvarDia(data, { folga: folgaAntes });
      },
    });
  }

  async function salvarNota(texto: string) {
    const antes = entrada?.dia?.nota ?? '';
    await operacoes.salvarDia(data, { nota: texto === '' ? undefined : texto });
    setNotaAberta(false);
    mostrar({
      rotulo: texto === '' ? 'Nota removida' : 'Nota salva',
      cruzou: false,
      desfazer: async () => {
        await operacoes.salvarDia(data, { nota: antes === '' ? undefined : antes });
      },
    });
  }

  // ----- janelas (segurar, corrigir, manual) -----

  function abrirDigitar(item: ItemHabito, bloco: number) {
    const { habito, versao: v } = item;
    setJanela({
      modo: 'adicionar',
      habitoId: habito.id,
      origem: 'digitado',
      titulo: `Registrar ${habito.nome.toLowerCase()}`,
      subtitulo: 'Quanto você fez desta vez?',
      unidade: v.unidade,
      valorInicial: bloco,
      passo: v.passoAjuste,
      rodape: `Bloco padrão: +${formatarNumero(bloco)} ${v.unidade} · você muda isso em Hábitos`,
    });
  }

  function abrirManual(item: ItemHabito) {
    const { habito, versao: v } = item;
    setJanela({
      modo: 'manual',
      habitoId: habito.id,
      origem: 'manual',
      titulo: `Registrar ${habito.nome.toLowerCase()}`,
      subtitulo: 'Registro manual',
      unidade: v.unidade,
      valorInicial: null,
      passo: v.passoAjuste,
      horarioInicial: horarioPadrao(),
      rodape: ehHoje
        ? 'Fica salvo com o horário escolhido (agora, se você não mudar).'
        : `Registro em ${dataCurta(data)}. Ajuste o horário se quiser.`,
    });
  }

  function abrirCorrigir(item: ItemHabito, registro: Registro) {
    const { habito, versao: v } = item;
    setJanela({
      modo: 'corrigir',
      habitoId: habito.id,
      registroId: registro.id,
      origem: registro.origem,
      titulo: `Corrigir registro de ${habito.nome.toLowerCase()}`,
      subtitulo: 'Digite o valor correto.',
      unidade: v.unidade,
      valorInicial: registro.valor,
      passo: v.passoAjuste,
      rodape: `Registro das ${registro.horario} · você pode excluir na lista`,
    });
  }

  async function confirmarJanela(valor: number, horario?: string) {
    if (!janela) return;
    const item = itens.find((i) => i.habito.id === janela.habitoId);
    const atual = janela;
    setJanela(null);
    if (!item) return;
    if (atual.modo === 'corrigir' && atual.registroId) {
      const antigo = await operacoes.corrigirRegistro(atual.registroId, valor);
      mostrar({
        rotulo: 'Registro corrigido',
        cruzou: false,
        desfazer: async () => {
          await operacoes.corrigirRegistro(antigo.id, antigo.valor);
        },
      });
      return;
    }
    await registrar(item, valor, atual.origem, horario);
  }

  async function excluirRegistro(registro: Registro) {
    const removido = await operacoes.excluirRegistro(registro.id);
    if (!removido) return;
    mostrar({
      rotulo: 'Registro excluído',
      cruzou: false,
      desfazer: async () => {
        await operacoes.restaurarRegistros([removido]);
      },
    });
  }

  const fechadoManual = entrada?.dia?.fechado === true;
  const emFolga = entrada?.dia?.folga === true;
  const nota = entrada?.dia?.nota ?? '';

  return (
    <div className="h-full overflow-y-auto pb-28" style={{ paddingTop: 'var(--topo-seguro)' }}>
      {!ehHoje && (
        <div className="mx-4 mb-3 flex items-center justify-between rounded-2xl bg-verde-claro px-4 py-2 text-[14px]">
          <span>
            Editando <strong>{dataCurta(data)}</strong> · {diaSemanaLongo(data).toLowerCase()}
          </span>
          <button
            type="button"
            onClick={() => setEscolhida(null)}
            className="h-11 rounded-full border-0 bg-transparent px-3 text-[14px] font-bold text-verde-texto"
          >
            Voltar para hoje
          </button>
        </div>
      )}

      <FaixaBackup />

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
        {resumo && itens.length === 0 && totalHabitos === 0 && (
          <PrimeiroUso irParaHabitos={irParaHabitos} irParaAjustes={irParaAjustes} />
        )}
        {resumo && itens.length === 0 && totalHabitos > 0 && (
          <div className="px-1 py-6 text-center text-[15px] text-texto2">
            <p>Nenhum hábito programado para este dia.</p>
            <button
              type="button"
              onClick={irParaHabitos}
              className="mt-3 h-11 rounded-full border-[1.5px] border-verde-texto bg-cartao px-5 text-[14px] font-semibold text-verde-texto"
            >
              Ver meus hábitos
            </button>
          </div>
        )}
        {itens.map((item, i) => (
          <LinhaHabito
            key={item.habito.id}
            item={item}
            ehHoje={ehHoje}
            primeira={i === 0}
            aoSomar={(valor) => void registrar(item, valor, 'bloco')}
            aoSegurar={(valor) => abrirDigitar(item, valor)}
            aoAlternar={() => void alternar(item)}
            aoDesfazerTudo={() => void desfazerTudo(item)}
            aoAbrirRegistros={() => setPainelId(item.habito.id)}
          />
        ))}
      </section>

      {config.dicaVisivel && itens.length > 0 && (
        <p className="mx-4 mt-2 text-center text-[12px] text-texto2">
          Segure um botão (+10, +250…) para digitar outro valor. Toque no ícone ou no nome do hábito para ver e
          corrigir os registros.
        </p>
      )}

      {resumo && ehHoje && (
        <div className="mx-4 mt-3 flex flex-col items-center gap-1.5">
          <button type="button" onClick={() => void finalizarOuReabrir()} className={botaoSecundario}>
            {fechadoManual ? 'Reabrir dia' : 'Finalizar dia'}
          </button>
          <div className="text-center text-[12px] text-texto2">
            {fechadoManual
              ? 'Dia finalizado. Tudo fica salvo neste iPhone.'
              : 'O dia fecha sozinho à meia-noite. Tudo fica salvo neste iPhone.'}
          </div>
        </div>
      )}

      {resumo && (
        <div className="mx-4 mt-2 flex flex-col items-center gap-1">
          {nota !== '' && (
            <p className="w-full whitespace-pre-wrap rounded-2xl border border-borda bg-cartao px-4 py-3 text-[14px]">
              <span className="font-semibold">Nota do dia: </span>
              {nota}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center">
            <button type="button" onClick={() => setNotaAberta(true)} className={botaoLink}>
              {nota === '' ? 'Nota do dia' : 'Editar nota'}
            </button>
            <button type="button" onClick={() => void alternarFolga()} className={botaoLink}>
              {emFolga ? 'Remover folga' : 'Dia de folga'}
            </button>
          </div>
        </div>
      )}

      <AvisoDesfazer aviso={aviso} aoDesfazer={() => void desfazer()} />

      {itemDoPainel && !janela && (
        <PainelRegistros
          titulo={`Registros ${ehHoje ? 'de hoje' : `de ${dataCurta(data)}`} · ${itemDoPainel.habito.nome}`}
          totalTexto={`Total: ${formatarNumero(itemDoPainel.resumo.total)} ${itemDoPainel.versao.unidade} · ${
            itemDoPainel.versao.tipo === 'limite' ? 'limite' : 'meta'
          } ${formatarNumero(itemDoPainel.versao.meta)}`}
          unidade={itemDoPainel.versao.unidade}
          registros={registrosDoPainel}
          aoCorrigir={(r) => abrirCorrigir(itemDoPainel, r)}
          aoExcluir={(r) => void excluirRegistro(r)}
          aoRegistroManual={() => abrirManual(itemDoPainel)}
          aoFechar={() => setPainelId(null)}
        />
      )}

      {janela && (
        <JanelaValor
          key={`${janela.modo}-${janela.habitoId}-${janela.registroId ?? 'novo'}`}
          config={janela}
          aoConfirmar={(valor, horario) => void confirmarJanela(valor, horario)}
          aoCancelar={() => setJanela(null)}
        />
      )}

      {notaAberta && (
        <NotaDia
          titulo={`Nota do dia ${dataCurta(data)}`}
          inicial={nota}
          aoSalvar={(t) => void salvarNota(t)}
          aoCancelar={() => setNotaAberta(false)}
        />
      )}
    </div>
  );
}
