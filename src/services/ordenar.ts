// RF-33b: contas para reordenar a lista segurando e arrastando. Sem tela, só números.

/**
 * Para onde vai o item arrastado? `meios` são os pontos do meio de todas as linhas,
 * na posição ORIGINAL; `indice` é a linha que está sendo arrastada e `centro` é onde
 * está o meio dela agora. O destino é quantas OUTRAS linhas ficam acima do centro.
 */
export function posicaoDeDestino(meios: number[], indice: number, centro: number): number {
  let acima = 0;
  meios.forEach((m, j) => {
    if (j !== indice && m < centro) acima++;
  });
  return acima;
}

/** Nova lista com o item de `de` colocado em `para`. Não altera a original. */
export function moverItem<T>(lista: T[], de: number, para: number): T[] {
  if (de < 0 || de >= lista.length) return [...lista];
  const alvo = Math.max(0, Math.min(para, lista.length - 1));
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(alvo, 0, item);
  return nova;
}

/**
 * Quanto a linha `k` precisa andar para abrir espaço, enquanto a linha `de` é
 * arrastada até `para`: sobe uma altura se o item passou por ela para baixo, desce
 * se passou para cima, fica parada nos outros casos.
 */
export function deslocamentoDaLinha(k: number, de: number, para: number, altura: number): number {
  if (k === de) return 0;
  if (de < k && k <= para) return -altura;
  if (para <= k && k < de) return altura;
  return 0;
}

/**
 * Impede que a linha arrastada saia da lista: o meio dela fica entre o meio da
 * primeira e o da última linha. Sem isso, arrastar para fora aumentava a área
 * rolável e a rolagem automática descia sem parar.
 */
export function limitarDeslocamento(meios: number[], indice: number, dy: number): number {
  if (meios.length === 0) return 0;
  // 1 px de folga além do meio da primeira/última linha: sem ela, o meio da linha
  // arrastada empata com o da última e a conta pararia na penúltima posição.
  const minimo = meios[0] - meios[indice] - 1;
  const maximo = meios[meios.length - 1] - meios[indice] + 1;
  return Math.max(minimo, Math.min(maximo, dy));
}
