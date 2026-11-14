import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useAreaVisivel } from '../hooks/useAreaVisivel';
import {
  ajustarCor,
  CLARIDADE_MINIMA,
  claridadeMaxima,
  corDeHsl,
  GRADE_CORES,
  hslDaCor,
  normalizarHex,
} from '../services/cores';
import { corDoDesenho } from '../services/habitos';
import { IconeHabito } from './icones';

export interface CorDeOutroHabito {
  id: string;
  nome: string;
  cor: string;
  icone: string;
}

interface Props {
  corAtual: string;
  icone: string;
  outrosHabitos: CorDeOutroHabito[];
  aoUsar: (cor: string) => void;
  aoCancelar: () => void;
}

type Aba = 'cores' | 'personalizada' | 'habito';
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'cores', rotulo: 'Cores' },
  { id: 'personalizada', rotulo: 'Personalizada' },
  { id: 'habito', rotulo: 'De outro hábito' },
];

const AVISO_ESCURECIDA = 'Escurecemos um pouco para o ícone continuar legível.';

/** Prévia do ícone: pendente (bloco suave) e feito (bloco cheio), no modo claro e no escuro. */
function Previa({ cor, icone }: { cor: string; icone: string }) {
  const bloco = (feito: boolean) => (
    <span
      className="flex size-10 items-center justify-center rounded-xl"
      style={{ background: feito ? cor : `color-mix(in srgb, ${cor} 20%, transparent)` }}
    >
      <IconeHabito nome={icone} cor={feito ? '#FFFFFF' : corDoDesenho(cor)} />
    </span>
  );
  return (
    <div className="flex gap-2" aria-label="Prévia do ícone nos modos claro e escuro">
      <div className="flex flex-1 items-center justify-center gap-3 rounded-2xl border border-borda bg-white p-2.5">
        {bloco(false)}
        {bloco(true)}
      </div>
      <div
        className="flex flex-1 items-center justify-center gap-3 rounded-2xl border border-[#2e3a33] p-2.5"
        style={{ background: '#1a201c', ['--clareia-icone' as string]: '55%' }}
      >
        {bloco(false)}
        {bloco(true)}
      </div>
    </div>
  );
}

function Barra({
  rotulo,
  min,
  max,
  valor,
  aoMudar,
  fundo,
}: {
  rotulo: string;
  min: number;
  max: number;
  valor: number;
  aoMudar: (v: number) => void;
  fundo: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[14px] font-semibold">
      {rotulo}
      <input
        type="range"
        aria-label={rotulo}
        min={min}
        max={max}
        value={Math.min(Math.max(valor, min), max)}
        onChange={(e) => aoMudar(Number(e.target.value))}
        className="barra-cor h-8 w-full"
        style={{ background: fundo }}
      />
    </label>
  );
}

/**
 * RF-78: janela "Mais cores" — grade pronta, personalizada (barras e código) e
 * "conta-gotas" que pega a cor de outro hábito (o conta-gotas de tela não existe no Safari do iPhone).
 */
export function SeletorCor({ corAtual, icone, outrosHabitos, aoUsar, aoCancelar }: Props) {
  const area = useAreaVisivel();
  const [aba, setAba] = useState<Aba>('cores');
  const [escolha, setEscolha] = useState(corAtual);
  const [aviso, setAviso] = useState('');
  const [hsl, setHsl] = useState(() => hslDaCor(corAtual));
  const [textoHex, setTextoHex] = useState(corAtual);
  const hexInvalido = aba === 'personalizada' && normalizarHex(textoHex) === null;

  const maxClaridade = useMemo(() => claridadeMaxima(hsl.h, hsl.s), [hsl.h, hsl.s]);
  const claridade = Math.min(Math.max(hsl.l, CLARIDADE_MINIMA), maxClaridade);

  useEffect(() => {
    setTextoHex(escolha);
  }, [escolha]);

  /** Qualquer cor que chegue de fora (grade, hábito, código) passa pelo ajuste de legibilidade. */
  function escolher(hex: string, sincronizarBarras = true) {
    const { cor, ajustada } = ajustarCor(hex);
    setEscolha(cor);
    setAviso(ajustada ? AVISO_ESCURECIDA : '');
    if (sincronizarBarras) setHsl(hslDaCor(cor));
  }

  function mudarBarras(novo: Partial<typeof hsl>) {
    const prox = { ...hsl, ...novo };
    prox.l = Math.min(Math.max(prox.l, CLARIDADE_MINIMA), claridadeMaxima(prox.h, prox.s));
    setHsl(prox);
    setEscolha(corDeHsl(prox));
    setAviso('');
  }

  function digitarHex(texto: string) {
    setTextoHex(texto);
    const hex = normalizarHex(texto);
    if (hex) escolher(hex);
  }

  const mostrarPontos = (hex: string) => (
    <Check size={16} strokeWidth={3} color="#fff" aria-hidden="true" className={escolha === hex ? '' : 'hidden'} />
  );

  return (
    <div
      className={`fixed left-0 right-0 z-[70] flex flex-col justify-end bg-[rgba(27,31,29,0.45)] ${area ? '' : 'inset-0'}`}
      style={area ? { top: area.top, height: area.height } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) aoCancelar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mais cores"
        className="mx-auto flex max-h-full w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-3xl bg-cartao px-5 pt-5"
        style={{ paddingBottom: area?.tecladoAberto ? '12px' : 'max(env(safe-area-inset-bottom), 24px)' }}
      >
        <div className="text-[18px] font-bold">Escolher cor</div>

        <Previa cor={escolha} icone={icone} />
        {aviso && (
          <p role="status" className="m-0 rounded-xl bg-aviso px-3 py-2 text-[13px] text-aviso-texto">
            {aviso}
          </p>
        )}

        <div role="tablist" aria-label="Tipo de escolha" className="flex gap-1.5">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
              className={`h-11 flex-1 rounded-full border-[1.5px] px-2 text-[13px] font-semibold ${
                aba === a.id ? 'border-verde bg-verde text-white' : 'border-borda-bloco bg-cartao text-verde-texto'
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {aba === 'cores' && (
          <div role="tabpanel" aria-label="Cores prontas" className="flex flex-col gap-1.5">
            {[0, 1, 2, 3].map((tom) => (
              <div key={tom} className="flex justify-between">
                {GRADE_CORES.map((coluna) => {
                  const c = coluna[tom];
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      aria-pressed={escolha === c}
                      onClick={() => escolher(c)}
                      className={`flex size-[30px] items-center justify-center rounded-full border-0 p-0 ${
                        escolha === c ? 'ring-[3px] ring-texto ring-offset-2 ring-offset-cartao' : ''
                      }`}
                      style={{ background: c }}
                    >
                      {mostrarPontos(c)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {aba === 'personalizada' && (
          <div role="tabpanel" aria-label="Cor personalizada" className="flex flex-col gap-3">
            <Barra
              rotulo="Matiz"
              min={0}
              max={360}
              valor={hsl.h}
              aoMudar={(h) => mudarBarras({ h })}
              fundo="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
            />
            <Barra
              rotulo="Intensidade"
              min={20}
              max={100}
              valor={hsl.s}
              aoMudar={(s) => mudarBarras({ s })}
              fundo={`linear-gradient(to right,${corDeHsl({ h: hsl.h, s: 20, l: 50 })},${corDeHsl({ h: hsl.h, s: 100, l: 50 })})`}
            />
            <Barra
              rotulo="Claridade"
              min={CLARIDADE_MINIMA}
              max={maxClaridade}
              valor={claridade}
              aoMudar={(l) => mudarBarras({ l })}
              fundo={`linear-gradient(to right,${corDeHsl({ h: hsl.h, s: hsl.s, l: CLARIDADE_MINIMA })},${corDeHsl({ h: hsl.h, s: hsl.s, l: maxClaridade })})`}
            />
            <label className="flex flex-col gap-1 text-[14px] font-semibold">
              Código da cor
              <input
                type="text"
                aria-label="Código da cor"
                aria-invalid={hexInvalido}
                value={textoHex}
                maxLength={8}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => digitarHex(e.target.value)}
                className="box-border h-12 w-full rounded-xl border-[1.5px] border-cinza-anel bg-cartao px-3 text-[16px] font-normal uppercase text-texto"
              />
            </label>
            {hexInvalido && (
              <p role="alert" className="m-0 text-[13px] text-laranja-texto">
                Código inválido. Use 6 letras e números (0 a 9 e A a F), como #0B7A43.
              </p>
            )}
          </div>
        )}

        {aba === 'habito' && (
          <div role="tabpanel" aria-label="Cor de outro hábito" className="flex flex-col">
            {outrosHabitos.length === 0 && (
              <p className="m-0 py-2 text-[14px] text-texto2">Você ainda não tem outros hábitos para copiar a cor.</p>
            )}
            {outrosHabitos.map((h) => (
              <button
                key={h.id}
                type="button"
                aria-label={`Pegar a cor de ${h.nome}`}
                onClick={() => escolher(h.cor)}
                className="flex min-h-12 items-center gap-3 border-0 border-t border-linha bg-transparent px-1 py-1.5 text-left"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: h.cor }}
                >
                  <IconeHabito nome={h.icone} cor="#FFFFFF" tamanho={20} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-texto">{h.nome}</span>
                <span className="text-[13px] text-texto2">{h.cor}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={aoCancelar}
            className="h-12 flex-1 rounded-full border-[1.5px] border-verde-texto bg-cartao text-[15px] font-semibold text-verde-texto"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={hexInvalido}
            onClick={() => aoUsar(escolha)}
            className="h-12 flex-1 rounded-full border-0 bg-verde text-[15px] font-bold text-white disabled:bg-cinza-anel"
          >
            Usar esta cor
          </button>
        </div>
      </div>
    </div>
  );
}
