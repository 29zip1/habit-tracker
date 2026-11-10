import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { criarCopiaDeSeguranca } from '../database/copias';
import { db } from '../database/db';
import { operacoes } from '../database/operacoes';
import { dataLogica } from '../services/datas';

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
    // RF-71 / RF-65: antes de trocar de versão, guarda uma cópia dos dados.
    try {
      const config = await operacoes.lerConfig();
      await criarCopiaDeSeguranca(db, 'antes-atualizar', __APP_VERSION__, dataLogica(new Date(), config.inicioDoDiaHora));
    } catch {
      /* se a cópia falhar, a atualização continua: ela nunca apaga o banco */
    }
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
