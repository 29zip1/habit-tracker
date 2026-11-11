import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { operacoes } from '../database/operacoes';
import { useAreaVisivel } from '../hooks/useAreaVisivel';
import { versaoVigente, type HabitoCompleto } from '../services/calculos';
import { ehDataValida } from '../services/datas';
import { dataCurta } from '../services/textos';
import {
  NOMES_DIAS,
  OUTRA_UNIDADE,
  PALETA_CORES,
  TIPOS,
  UNIDADES,
  formularioVazio,
  habitoParaFormulario,
  lerFormulario,
  listarCategorias,
  versaoMudou,
  type FormHabito,
} from '../services/habitos';
import type { DataLocal, TipoHabito } from '../types';
import { GRUPOS_ICONES, IconeHabito } from './icones';

interface Props {
  /** undefined = criar um hábito novo. */
  habito?: HabitoCompleto;
  hoje: DataLocal;
  aoFechar: () => void;
  aoArquivar?: () => void;
  aoDuplicar?: () => void;
  /** Só para hábito arquivado (RF-32). */
  aoExcluir?: () => void;
  /** Categorias já usadas em outros hábitos (viram botões). */
  categoriasUsadas?: string[];
}

const campoTexto =
  'box-border h-12 w-full min-w-0 max-w-full rounded-xl border-[1.5px] border-cinza-anel bg-cartao px-3 text-[16px] text-texto';
const rotulo = 'text-[14px] font-semibold text-texto';
const ajuda = 'text-[13px] text-texto2';

/** Criar e editar hábito (RF-30, RF-31). Tela cheia, com rolagem. */
export function FormularioHabito({ habito, hoje, aoFechar, aoArquivar, aoDuplicar, aoExcluir, categoriasUsadas = [] }: Props) {
  const editando = habito !== undefined;
  const versaoAtual = useMemo(() => {
    if (!habito) return undefined;
    return (
      versaoVigente(habito.versoes, hoje) ??
      [...habito.versoes].sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? -1 : 1))[0]
    );
  }, [habito, hoje]);

  const [f, setF] = useState<FormHabito>(() =>
    habito && versaoAtual ? habitoParaFormulario(habito.habito, versaoAtual) : formularioVazio(),
  );
  const [escrevendoCategoria, setEscrevendoCategoria] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [perguntaVigencia, setPerguntaVigencia] = useState(false);
  const [vigencia, setVigencia] = useState<'hoje' | 'outra'>('hoje');
  const [outraData, setOutraData] = useState(hoje);
  const area = useAreaVisivel();

  const mudar = <K extends keyof FormHabito>(campo: K, valor: FormHabito[K]) => {
    setF((a) => ({ ...a, [campo]: valor }));
    setErro('');
  };

  function escolherTipo(tipo: TipoHabito) {
    setF((a) => ({
      ...a,
      tipo,
      meta: tipo === 'conclusao' ? '1' : tipo === 'semanal' ? '5' : a.tipo === 'semanal' || a.tipo === 'conclusao' ? '30' : a.meta,
      blocos: a.blocos.length > 0 ? a.blocos : ['10'],
    }));
    setErro('');
  }

  const categorias = listarCategorias(categoriasUsadas, escrevendoCategoria ? '' : f.categoria);
  const temBlocos = f.tipo === 'quantidade' || f.tipo === 'limite';
  const temUnidade = temBlocos;

  async function salvar(vigenteDesde: DataLocal) {
    const r = lerFormulario(f);
    if (!r.ok) {
      setErro(r.erro);
      setPerguntaVigencia(false);
      return;
    }
    setSalvando(true);
    try {
      if (!habito) {
        await operacoes.criarHabito({
          ...r.campos,
          ...r.versao,
          vigenteDesde: r.campos.dataInicial ?? hoje,
        });
      } else {
        const mudou = versaoAtual ? versaoMudou(versaoAtual, r.versao) : true;
        await operacoes.salvarEdicao(habito.habito.id, r.campos, mudou ? r.versao : null, vigenteDesde);
      }
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar. Tente de novo.');
      setPerguntaVigencia(false);
    } finally {
      setSalvando(false);
    }
  }

  function aoTocarSalvar() {
    const r = lerFormulario(f);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    if (habito && versaoAtual && versaoMudou(versaoAtual, r.versao)) {
      setPerguntaVigencia(true);
      return;
    }
    void salvar(hoje);
  }

  const dataVigenciaValida = vigencia === 'hoje' || ehDataValida(outraData);

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 flex touch-pan-y flex-col overflow-hidden bg-fundo"
      style={area ? { top: area.top, height: area.height } : { bottom: 0 }}
    >
      <div
        className="mx-auto flex w-full max-w-[480px] flex-1 flex-col overflow-hidden"
        style={{ paddingTop: area?.tecladoAberto ? '8px' : 'var(--topo-seguro)' }}
      >
        <div className="flex items-center justify-between px-4 pb-2">
          <h1 className="text-[22px] font-bold">{editando ? 'Editar hábito' : 'Novo hábito'}</h1>
          <button
            type="button"
            aria-label="Fechar sem salvar"
            onClick={aoFechar}
            className="flex size-11 items-center justify-center rounded-full border-0 bg-transparent text-texto2"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-6"
          onFocus={(e) => {
            // Teclado aberto: leva o campo tocado para o meio da área visível,
            // para a pessoa ver o que está digitando.
            const campo = e.target;
            if (!(campo instanceof HTMLInputElement || campo instanceof HTMLSelectElement)) return;
            for (const ms of [150, 450]) {
              window.setTimeout(() => campo.scrollIntoView({ block: 'center', behavior: 'smooth' }), ms);
            }
          }}
        >
          <div className="flex min-w-0 flex-col gap-5">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={rotulo}>Nome</span>
              <input
                type="text"
                value={f.nome}
                maxLength={60}
                placeholder="Ex.: Ler um livro"
                onChange={(e) => mudar('nome', e.target.value)}
                className={campoTexto}
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={rotulo}>Descrição (opcional)</span>
              <input
                type="text"
                value={f.descricao}
                maxLength={100}
                onChange={(e) => mudar('descricao', e.target.value)}
                className={campoTexto}
              />
            </label>

            <fieldset className="flex flex-col gap-2 border-0 p-0">
              <legend className={`${rotulo} mb-1.5`}>Tipo de hábito</legend>
              {TIPOS.map((t) => (
                <button
                  key={t.tipo}
                  type="button"
                  aria-pressed={f.tipo === t.tipo}
                  onClick={() => escolherTipo(t.tipo)}
                  className={`flex min-h-[56px] flex-col items-start rounded-xl border-[1.5px] px-3 py-2 text-left ${
                    f.tipo === t.tipo ? 'border-verde-texto bg-verde-claro' : 'border-cinza-anel bg-cartao'
                  }`}
                >
                  <span className="text-[15px] font-semibold text-texto">{t.nome}</span>
                  <span className={ajuda}>{t.ajuda}</span>
                </button>
              ))}
              {editando && (
                <p className={ajuda}>
                  Mudar o tipo vale só a partir de uma data que você escolhe ao salvar. Os dias que já passaram não mudam.
                </p>
              )}
            </fieldset>

            {f.tipo !== 'conclusao' && (
              <div className="flex flex-col gap-3">
                {temUnidade && (
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className={rotulo}>Unidade</span>
                    <select
                      value={f.unidade}
                      onChange={(e) => mudar('unidade', e.target.value)}
                      className={campoTexto}
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      <option value={OUTRA_UNIDADE}>Outra…</option>
                    </select>
                    {f.unidade === OUTRA_UNIDADE && (
                      <input
                        type="text"
                        aria-label="Unidade personalizada"
                        value={f.unidadeOutra}
                        maxLength={12}
                        placeholder="Ex.: capítulos"
                        onChange={(e) => mudar('unidadeOutra', e.target.value)}
                        className={campoTexto}
                      />
                    )}
                  </label>
                )}

                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className={rotulo}>
                    {f.tipo === 'semanal' ? 'Quantas vezes por semana' : f.tipo === 'limite' ? 'Limite por dia' : 'Meta por dia'}
                  </span>
                  <input
                    type="text"
                    inputMode={f.tipo === 'semanal' ? 'numeric' : 'decimal'}
                    value={f.meta}
                    onChange={(e) => mudar('meta', e.target.value)}
                    className={campoTexto}
                  />
                  {f.tipo === 'semanal' && <span className={ajuda}>De 1 a 7.</span>}
                </label>
              </div>
            )}

            {temBlocos && (
              <fieldset className="flex flex-col gap-2 border-0 p-0">
                <legend className={`${rotulo} mb-1.5`}>Botões para somar (de 1 a 3)</legend>
                <div className="flex flex-wrap items-center gap-2">
                  {f.blocos.map((b, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-[16px] font-semibold text-texto2">+</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Botão ${i + 1}`}
                        value={b}
                        onChange={(e) => mudar('blocos', f.blocos.map((x, j) => (j === i ? e.target.value : x)))}
                        className="box-border h-12 w-[84px] rounded-xl border-[1.5px] border-cinza-anel bg-cartao px-3 text-center text-[16px] text-texto"
                      />
                      {f.blocos.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Tirar o botão ${i + 1}`}
                          onClick={() => mudar('blocos', f.blocos.filter((_, j) => j !== i))}
                          className="flex size-11 items-center justify-center rounded-full border-0 bg-transparent text-texto2"
                        >
                          <X size={18} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                  {f.blocos.length < 3 && (
                    <button
                      type="button"
                      onClick={() => mudar('blocos', [...f.blocos, ''])}
                      className="h-11 rounded-full border-[1.5px] border-verde-texto bg-transparent px-4 text-[14px] font-semibold text-verde-texto"
                    >
                      + Botão
                    </button>
                  )}
                </div>
                <label className="mt-2 flex flex-col gap-1.5">
                  <span className={rotulo}>Passo dos botões − e + ao digitar</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={f.passo}
                    onChange={(e) => mudar('passo', e.target.value)}
                    className={`${campoTexto} w-[120px]`}
                  />
                </label>
              </fieldset>
            )}

            {f.tipo !== 'semanal' && (
              <fieldset className="flex flex-col gap-2 border-0 p-0">
                <legend className={`${rotulo} mb-1.5`}>Em quais dias</legend>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-pressed={f.dias === null}
                    onClick={() => mudar('dias', null)}
                    className={`h-11 flex-1 rounded-full border-[1.5px] text-[14px] font-semibold ${
                      f.dias === null ? 'border-verde-texto bg-verde-claro text-verde-texto' : 'border-cinza-anel bg-cartao text-texto'
                    }`}
                  >
                    Todos os dias
                  </button>
                  <button
                    type="button"
                    aria-pressed={f.dias !== null}
                    onClick={() => mudar('dias', f.dias ?? [1, 2, 3, 4, 5])}
                    className={`h-11 flex-1 rounded-full border-[1.5px] text-[14px] font-semibold ${
                      f.dias !== null ? 'border-verde-texto bg-verde-claro text-verde-texto' : 'border-cinza-anel bg-cartao text-texto'
                    }`}
                  >
                    Dias escolhidos
                  </button>
                </div>
                {f.dias !== null && (
                  <div className="flex justify-between gap-1">
                    {NOMES_DIAS.map((nome, d) => {
                      const ligado = f.dias?.includes(d) ?? false;
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={ligado}
                          onClick={() =>
                            mudar('dias', ligado ? (f.dias ?? []).filter((x) => x !== d) : [...(f.dias ?? []), d])
                          }
                          className={`h-11 min-w-0 flex-1 rounded-xl border-[1.5px] px-0 text-[13px] font-semibold ${
                            ligado ? 'border-verde bg-verde text-white' : 'border-cinza-anel bg-cartao text-texto'
                          }`}
                        >
                          {nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            )}

            <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
              <span>
                Entra no percentual do dia
                <span className={`block ${ajuda}`}>Desligado: o hábito aparece, mas não conta na média.</span>
              </span>
              <input
                type="checkbox"
                checked={f.entra}
                onChange={(e) => mudar('entra', e.target.checked)}
                className="size-6 shrink-0 accent-verde"
              />
            </label>

            <fieldset className="flex flex-col gap-2 border-0 p-0">
              <legend className={`${rotulo} mb-1.5`}>Ícone</legend>
              {GRUPOS_ICONES.map((g) => (
                <div key={g.nome} className="flex flex-col gap-1.5">
                  <div className="text-[13px] font-semibold text-texto2">{g.nome}</div>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.keys(g.icones).map((nome) => (
                      <button
                        key={nome}
                        type="button"
                        aria-label={`Ícone ${nome}`}
                        aria-pressed={f.icone === nome}
                        onClick={() => mudar('icone', nome)}
                        className={`flex h-12 items-center justify-center rounded-xl border-[1.5px] p-0 ${
                          f.icone === nome ? 'border-verde-texto bg-verde-claro' : 'border-cinza-anel bg-cartao'
                        }`}
                      >
                        <IconeHabito nome={nome} cor="var(--color-texto)" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>

            <fieldset className="flex flex-col gap-2 border-0 p-0">
              <legend className={`${rotulo} mb-1.5`}>Cor</legend>
              <div className="flex flex-wrap gap-2.5">
                {PALETA_CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    aria-pressed={f.cor === c}
                    onClick={() => mudar('cor', c)}
                    className={`size-11 rounded-full border-0 p-0 ${f.cor === c ? 'ring-[3px] ring-texto ring-offset-2 ring-offset-fundo' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <p className={ajuda}>A cor aparece no ícone do hábito, na aba Hábitos e na tela Hoje.</p>
            </fieldset>

            <fieldset className="flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className={`${rotulo} mb-1.5`}>Categoria</legend>
              <div className="flex flex-wrap gap-2">
                {categorias.map((c) => {
                  const marcada = c.toLowerCase() === f.categoria.trim().toLowerCase() && !escrevendoCategoria;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={marcada}
                      onClick={() => {
                        setEscrevendoCategoria(false);
                        mudar('categoria', c);
                      }}
                      className={`h-11 rounded-full border-[1.5px] px-4 text-[14px] font-semibold ${
                        marcada ? 'border-verde-texto bg-verde-claro text-verde-texto' : 'border-cinza-anel bg-cartao text-texto'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={escrevendoCategoria}
                  onClick={() => {
                    setEscrevendoCategoria(true);
                    mudar('categoria', '');
                  }}
                  className={`h-11 rounded-full border-[1.5px] px-4 text-[14px] font-semibold ${
                    escrevendoCategoria ? 'border-verde-texto bg-verde-claro text-verde-texto' : 'border-verde-texto bg-transparent text-verde-texto'
                  }`}
                >
                  + Outra
                </button>
              </div>
              {escrevendoCategoria && (
                <input
                  type="text"
                  aria-label="Nome da nova categoria"
                  value={f.categoria}
                  maxLength={30}
                  placeholder="Ex.: Leitura"
                  onChange={(e) => mudar('categoria', e.target.value)}
                  className={campoTexto}
                />
              )}
            </fieldset>

            <div className="flex min-w-0 flex-col gap-5">
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className={rotulo}>Começa em (opcional)</span>
                <input type="date" value={f.dataInicial} onChange={(e) => mudar('dataInicial', e.target.value)} className={`${campoTexto} appearance-none text-left`} />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5">
                <span className={rotulo}>Termina em (opcional)</span>
                <input type="date" value={f.dataFinal} onChange={(e) => mudar('dataFinal', e.target.value)} className={`${campoTexto} appearance-none text-left`} />
              </label>
            </div>

            {editando && aoDuplicar && (
              <button
                type="button"
                onClick={aoDuplicar}
                className="h-12 rounded-full border-[1.5px] border-verde-texto bg-transparent text-[15px] font-semibold text-verde-texto"
              >
                Duplicar este hábito
              </button>
            )}
            {editando && aoArquivar && (
              <button
                type="button"
                onClick={aoArquivar}
                className="h-12 rounded-full border-[1.5px] border-laranja bg-transparent text-[15px] font-semibold text-laranja-texto"
              >
                Arquivar este hábito
              </button>
            )}
            {editando && aoExcluir && (
              <button
                type="button"
                onClick={aoExcluir}
                className="h-12 rounded-full border-[1.5px] border-laranja bg-transparent text-[15px] font-semibold text-laranja-texto"
              >
                Excluir de vez…
              </button>
            )}
          </div>
        </div>

        <div
          className="border-t border-borda bg-fundo px-4 pt-3"
          style={{ paddingBottom: area?.tecladoAberto ? '12px' : 'max(env(safe-area-inset-bottom), 16px)' }}
        >
          {erro && (
            <p role="alert" className="mb-2 rounded-xl border border-laranja bg-laranja-claro p-2.5 text-[14px] text-laranja-texto">
              {erro}
            </p>
          )}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={aoFechar}
              className="h-12 flex-1 rounded-full border-[1.5px] border-cinza-anel bg-cartao text-[15px] font-semibold text-texto"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={aoTocarSalvar}
              className="h-12 flex-[1.4] rounded-full border-0 bg-verde text-[15px] font-bold text-white"
            >
              {editando ? 'Salvar' : 'Criar hábito'}
            </button>
          </div>
        </div>
      </div>

      {perguntaVigencia && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end bg-[rgba(27,31,29,0.45)]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPerguntaVigencia(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Valer a partir de"
            className="mx-auto flex w-full max-w-[480px] flex-col gap-3 rounded-t-3xl bg-cartao px-5 pt-5"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
          >
            <div className="text-[18px] font-bold">Valer a partir de quando?</div>
            <p className="text-[14px] text-texto2">
              Você mudou a configuração do hábito. Os dias anteriores à data escolhida ficam como eram, sem alteração.
            </p>
            <button
              type="button"
              aria-pressed={vigencia === 'hoje'}
              onClick={() => setVigencia('hoje')}
              className={`min-h-12 rounded-xl border-[1.5px] px-3 text-left text-[15px] font-semibold ${
                vigencia === 'hoje' ? 'border-verde-texto bg-verde-claro' : 'border-cinza-anel bg-cartao'
              }`}
            >
              Hoje ({dataCurta(hoje)})
            </button>
            {/* O seletor de data fica invisível por cima do botão: tocar em "Outra data" já abre o calendário. */}
            <div
              className={`relative flex min-h-12 items-center overflow-hidden rounded-xl border-[1.5px] px-3 text-[15px] font-semibold ${
                vigencia === 'outra' ? 'border-verde-texto bg-verde-claro' : 'border-cinza-anel bg-cartao'
              }`}
            >
              {vigencia === 'outra' && ehDataValida(outraData)
                ? `Outra data: ${outraData.slice(8, 10)}/${outraData.slice(5, 7)}/${outraData.slice(0, 4)}`
                : 'Outra data (toque para escolher)'}
              <input
                type="date"
                aria-label="Outra data: escolher a data de início da mudança"
                value={outraData}
                onFocus={() => setVigencia('outra')}
                onChange={(e) => {
                  setOutraData(e.target.value);
                  setVigencia('outra');
                }}
                className="absolute inset-0 h-full w-full min-w-0 max-w-full cursor-pointer appearance-none opacity-0"
              />
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setPerguntaVigencia(false)}
                className="h-12 flex-1 rounded-full border-[1.5px] border-cinza-anel bg-cartao text-[15px] font-semibold text-texto"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!dataVigenciaValida || salvando}
                onClick={() => void salvar(vigencia === 'hoje' ? hoje : outraData)}
                className={`h-12 flex-[1.4] rounded-full border-0 text-[15px] font-bold text-white ${
                  dataVigenciaValida ? 'bg-verde' : 'bg-cinza-anel'
                }`}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
