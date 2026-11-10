import { ICONES_NAVEGACAO } from './icones';

export type Aba = 'hoje' | 'historico' | 'evolucao' | 'habitos' | 'ajustes';

const ABAS: { id: Aba; rotulo: string; aria: string }[] = [
  { id: 'hoje', rotulo: 'Hoje', aria: 'Hoje' },
  { id: 'historico', rotulo: 'Histórico', aria: 'Histórico' },
  { id: 'evolucao', rotulo: 'Evolução', aria: 'Evolução' },
  { id: 'habitos', rotulo: 'Hábitos', aria: 'Hábitos' },
  { id: 'ajustes', rotulo: 'Ajustes', aria: 'Ajustes' },
];

/** RF-04: navegação inferior fixa, respeitando a área segura do iPhone. */
export function NavInferior({ ativa, aoEscolher }: { ativa: Aba; aoEscolher: (aba: Aba) => void }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="flex shrink-0 justify-between border-t border-borda bg-cartao px-2 pt-2"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      {ABAS.map((aba) => {
        const Icone = ICONES_NAVEGACAO[aba.id];
        const ativaAgora = ativa === aba.id;
        return (
          <button
            key={aba.id}
            type="button"
            aria-label={ativaAgora ? `${aba.aria} (tela atual)` : aba.aria}
            aria-current={ativaAgora ? 'page' : undefined}
            onClick={() => aoEscolher(aba.id)}
            className={`flex h-[52px] flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 ${
              ativaAgora ? 'text-verde-texto' : 'text-texto2'
            }`}
          >
            <Icone size={22} strokeWidth={2} aria-hidden="true" />
            <span className={`text-[12px] ${ativaAgora ? 'font-bold' : ''}`}>{aba.rotulo}</span>
          </button>
        );
      })}
    </nav>
  );
}
