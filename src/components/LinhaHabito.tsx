import { Check } from 'lucide-react';
import type { ResumoHabito } from '../services/calculos';
import type { Habito, VersaoHabito } from '../types';
import {
  formatarNumero,
  rotuloBloco,
  textoConclusao,
  textoLimite,
  textoLimiteAtingido,
  textoQuantidade,
  textoSemanal,
} from '../services/textos';
import { useSegurar } from '../hooks/useSegurar';
import { corDoDesenho } from '../services/habitos';
import { IconeHabito } from './icones';

export interface ItemHabito {
  habito: Habito;
  versao: VersaoHabito;
  resumo: ResumoHabito;
}

interface Props {
  item: ItemHabito;
  ehHoje: boolean;
  primeira: boolean;
  aoSomar: (valor: number) => void;
  /** RF-10: segurar o botão de bloco abre a janela para digitar outro valor. */
  aoSegurar: (valor: number) => void;
  aoAlternar: () => void;
  aoDesfazerTudo: () => void;
  /** RF-16: tocar no ícone ou no nome abre os registros do dia. */
  aoAbrirRegistros: () => void;
}

function CheckBotao({ feito, aria, aoTocar }: { feito: boolean; aria: string; aoTocar: () => void }) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={aoTocar}
      className="flex size-11 shrink-0 items-center justify-center border-0 bg-transparent p-0"
    >
      {feito ? (
        <span className="flex size-8 items-center justify-center rounded-full bg-verde">
          <Check size={18} strokeWidth={3} color="#fff" aria-hidden="true" />
        </span>
      ) : (
        <span className="box-border size-8 rounded-full border-2 border-cinza-anel bg-cartao" />
      )}
    </button>
  );
}

function BotaoBloco({
  rotulo,
  aria,
  aoToque,
  aoSegurar,
}: {
  rotulo: string;
  aria: string;
  aoToque: () => void;
  aoSegurar: () => void;
}) {
  const gestos = useSegurar(aoToque, aoSegurar);
  return (
    <button
      type="button"
      aria-label={aria}
      {...gestos}
      className="sem-selecao h-11 min-w-[52px] rounded-full border-[1.5px] border-borda-bloco bg-cartao px-3 text-[14px] font-semibold text-verde-texto"
    >
      {rotulo}
    </button>
  );
}

/** Linhas de hábito: RF-05 a RF-14b. A posição nunca muda ao concluir (RF-05). */
export function LinhaHabito({
  item,
  ehHoje,
  primeira,
  aoSomar,
  aoSegurar,
  aoAlternar,
  aoDesfazerTudo,
  aoAbrirRegistros,
}: Props) {
  const { habito, versao: v, resumo: r } = item;
  const quantidade = v.tipo === 'quantidade';
  const limite = v.tipo === 'limite';
  const semanal = v.tipo === 'semanal';
  const conclusao = v.tipo === 'conclusao';
  const temRegistros = quantidade || limite;

  const feito = quantidade ? r.metaBatida : limite ? r.limiteAtingido : r.marcadoNoDia;
  const superada = quantidade && r.metaSuperada;
  const acimaDoLimite = limite && r.statusLimite === 'acima';

  let texto = '';
  let verdePct = 0;
  let laranjaPct = 0;
  let temBarra = true;
  if (conclusao) {
    texto = textoConclusao(r.marcadoNoDia, ehHoje);
    temBarra = false;
  } else if (semanal) {
    texto = textoSemanal(r.contagemSemana ?? 0, v.meta, r.marcadoNoDia, ehHoje);
    verdePct = Math.round(Math.min((r.contagemSemana ?? 0) / v.meta, 1) * 100);
  } else if (quantidade) {
    texto = textoQuantidade(r.total, v.meta, v.unidade);
    verdePct = Math.round(Math.min(r.total / v.meta, 1) * 100); // sempre verde, sem trecho amarelo (RF-12)
  } else {
    texto = r.limiteAtingido ? textoLimiteAtingido(r.total, v.unidade) : textoLimite(r.total, v.meta, v.unidade);
    const t = Math.max(r.total, v.meta);
    verdePct = Math.round((Math.min(r.total, v.meta) / t) * 100);
    laranjaPct = Math.round((Math.max(r.total - v.meta, 0) / t) * 100);
  }

  const nome = habito.nome; // sempre o nome que a pessoa escolheu
  const nomeRiscado = conclusao && feito;
  const ariaRegistros = `Ver e corrigir registros de ${habito.nome}`;

  const icone = (
    <>
      <IconeHabito nome={habito.icone} cor={feito ? '#FFFFFF' : corDoDesenho(habito.cor)} />
    </>
  );
  const classeIcone = `flex size-10 shrink-0 items-center justify-center rounded-xl border-0 p-0 transition-colors duration-300 ${
    superada ? 'shadow-[0_0_0_3px_var(--color-ouro)]' : ''
  }`;
  // RF-30f: o ícone usa a cor do hábito; feito = bloco cheio na cor, desenho branco.
  const estiloIcone = { background: feito ? habito.cor : `color-mix(in srgb, ${habito.cor} 20%, transparent)` };

  const corpo = (
    <>
      <div className={`truncate text-[16px] font-semibold leading-tight ${nomeRiscado ? 'text-texto2 line-through' : ''}`}>
        {nome}
      </div>
      <div
        className={`text-[13px] ${
          acimaDoLimite ? 'font-semibold text-laranja' : feito ? 'font-semibold text-verde-escuro' : 'text-texto2'
        }`}
      >
        {texto}
      </div>
      {temBarra && (
        <div className={`flex h-1.5 overflow-hidden rounded-[3px] ${feito ? 'bg-trilho-ok' : 'bg-trilho'}`}>
          <div className="barra h-1.5 bg-verde-barra" style={{ width: `${verdePct}%` }} />
          {limite && <div className="barra h-1.5 bg-laranja" style={{ width: `${laranjaPct}%` }} />}
        </div>
      )}
    </>
  );
  const classeCorpo = 'flex min-w-0 flex-1 flex-col gap-1';

  return (
    <div
      className={`-mx-4 flex min-h-[64px] items-center gap-3 px-4 py-2.5 transition-colors duration-300 ${
        primeira ? '' : `border-t ${feito ? 'border-verde-borda' : 'border-linha'}`
      } ${feito ? 'bg-verde-linha' : ''}`}
    >
      {temRegistros ? (
        <button type="button" aria-label={ariaRegistros} onClick={aoAbrirRegistros} className={classeIcone} style={estiloIcone}>
          {icone}
        </button>
      ) : (
        <div aria-hidden="true" className={classeIcone} style={estiloIcone}>
          {icone}
        </div>
      )}

      {temRegistros ? (
        <button
          type="button"
          aria-label={ariaRegistros}
          onClick={aoAbrirRegistros}
          className={`${classeCorpo} min-h-11 cursor-pointer border-0 bg-transparent p-0 text-left text-texto`}
        >
          {corpo}
        </button>
      ) : (
        <div className={classeCorpo}>{corpo}</div>
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        {temRegistros &&
          v.blocos.map((b) => (
            <BotaoBloco
              key={b}
              rotulo={rotuloBloco(b, v.unidade, v.blocos.length)}
              aria={`Adicionar ${formatarNumero(b)} ${v.unidade} em ${habito.nome}. Segure para digitar outro valor`}
              aoToque={() => aoSomar(b)}
              aoSegurar={() => aoSegurar(b)}
            />
          ))}
        {(quantidade || limite) && feito && (
          <CheckBotao
            feito
            aria={`${limite ? 'Quantidade atingida' : 'Meta batida'}. Toque para desfazer todo o registro de ${habito.nome} neste dia`}
            aoTocar={aoDesfazerTudo}
          />
        )}
        {(conclusao || semanal) && (
          <CheckBotao
            feito={r.marcadoNoDia}
            aria={`${habito.nome}: ${r.marcadoNoDia ? 'feito. Toque para desmarcar' : 'pendente. Toque para marcar'}`}
            aoTocar={aoAlternar}
          />
        )}
      </div>
    </div>
  );
}
