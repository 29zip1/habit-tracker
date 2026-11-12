/** Cartão de número do resumo (Histórico e Evolução). */
export function Cartao({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-borda bg-cartao p-3">
      <span className="text-[13px] text-texto2">{titulo}</span>
      <span className="text-[22px] font-bold leading-tight">{valor}</span>
      {detalhe && <span className="text-[12px] text-texto2">{detalhe}</span>}
    </div>
  );
}
