// Compartilhamento de arquivo pelo iPhone (testado na Fase 1: .json e .txt funcionam).
// Precisa de um toque do usuário. Quem chama deve ter o arquivo PRONTO antes do
// toque, para o iPhone não perder a permissão do gesto enquanto o arquivo é gerado.
export type ResultadoCompartilhar = 'compartilhado' | 'cancelado' | 'indisponivel' | 'erro';

export async function compartilharArquivo(arquivo: File, titulo: string): Promise<ResultadoCompartilhar> {
  if (!navigator.canShare || !navigator.canShare({ files: [arquivo] })) return 'indisponivel';
  try {
    await navigator.share({ files: [arquivo], title: titulo });
    return 'compartilhado';
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') return 'cancelado';
    return 'erro';
  }
}

/** Plano B (computador ou navegador sem compartilhamento): baixa o arquivo. */
export function baixarArquivo(arquivo: File): void {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
