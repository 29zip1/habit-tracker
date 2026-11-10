import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/** Nova versão do app (RF-71): avisa, e só aplica na hora quando o usuário toca. */
export function useAtualizacao() {
  const [novaVersao, setNovaVersao] = useState(false);
  const [offlinePronto, setOfflinePronto] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const atualizarRef = useRef<((recarregar?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    atualizarRef.current = registerSW({
      onNeedRefresh: () => setNovaVersao(true),
      onOfflineReady: () => setOfflinePronto(true),
    });
  }, []);

  async function atualizar() {
    await atualizarRef.current?.(true);
  }

  async function verificar() {
    setMensagem('Verificando…');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) {
        setMensagem('Sem internet ou o app ainda não está pronto para atualizar.');
        return;
      }
      await reg.update();
      setMensagem(
        reg.waiting || reg.installing ? 'Nova versão encontrada.' : 'Você já está na versão mais recente.',
      );
    } catch {
      setMensagem('Não foi possível verificar agora (sem internet?).');
    }
  }

  return { novaVersao, offlinePronto, mensagem, atualizar, verificar };
}
