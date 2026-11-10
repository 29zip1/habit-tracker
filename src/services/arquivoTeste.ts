// Teste de salvar arquivo pelo compartilhamento do iPhone (T-61c / RF-61).
// Só funciona a partir de um toque do usuário.
export type TipoTeste = 'json' | 'txt';

export async function salvarArquivoTeste(tipo: TipoTeste): Promise<string> {
  const agora = new Date();
  const dataNome = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, '0'),
    String(agora.getDate()).padStart(2, '0'),
  ].join('-');

  const conteudo =
    tipo === 'json'
      ? JSON.stringify({ app: 'habit-tracker', teste: true, criadoEm: agora.toLocaleString('pt-BR') }, null, 2)
      : `Arquivo de teste do Habit Tracker\nCriado em ${agora.toLocaleString('pt-BR')}\n`;
  const arquivo = new File(
    [conteudo],
    `habit-tracker-teste-${dataNome}.${tipo}`,
    { type: tipo === 'json' ? 'application/json' : 'text/plain' },
  );

  if (!navigator.canShare || !navigator.canShare({ files: [arquivo] })) {
    return 'Este aparelho não aceita compartilhar este tipo de arquivo.';
  }
  try {
    await navigator.share({ files: [arquivo], title: 'Teste de arquivo' });
    return 'Compartilhamento aberto. Se você salvou, procure o arquivo em Arquivos.';
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === 'AbortError') {
      return 'Você cancelou o compartilhamento.';
    }
    return 'Não foi possível abrir o compartilhamento.';
  }
}
