import { useCallback, useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { NavInferior, type Aba } from './components/NavInferior';
import { TelaFalhaBanco } from './components/TelaFalhaBanco';
import { db } from './database/db';
import { abrirBancoComSeguranca } from './database/iniciar';
import { useAtualizacao } from './hooks/useAtualizacao';
import { useCopiaDiaria } from './hooks/useCopiaDiaria';
import { useTema } from './hooks/useTema';
import { dataLogica } from './services/datas';
import { estaInstalado } from './services/ambiente';
import type { ArquivoBackup } from './services/backup';
import Ajustes from './screens/Ajustes';
import EmBreve from './screens/EmBreve';
import Habitos from './screens/Habitos';
import Hoje from './screens/Hoje';

function AppPronto() {
  const [aba, setAba] = useState<Aba>('hoje');
  const atualizacao = useAtualizacao();
  useTema();
  useCopiaDiaria();
  const instalado = estaInstalado();

  return (
    <div className="mx-auto flex h-full max-w-[480px] flex-col bg-fundo">
      {!instalado && (
        <div
          role="alert"
          className="mx-4 mt-2 flex shrink-0 gap-3 rounded-2xl border border-laranja bg-laranja-claro p-3 text-[14px] text-laranja-texto"
          style={{ marginTop: 'var(--topo-seguro)' }}
        >
          <TriangleAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          <div>
            <strong>Você está no navegador.</strong> Os dados daqui não são os do app instalado.
          </div>
        </div>
      )}

      {atualizacao.novaVersao && (
        <div className="mx-4 mt-2 flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-aviso p-3 pl-4 text-aviso-texto">
          <span className="text-[14px]">
            Nova versão disponível
            <span className="block text-[12px] opacity-80">Uma cópia dos seus dados é guardada antes. Se quiser, salve também um backup em Ajustes.</span>
          </span>
          <button
            type="button"
            className="h-11 shrink-0 rounded-full px-4 text-[14px] font-bold text-aviso-desfazer"
            onClick={() => void atualizacao.atualizar()}
          >
            Atualizar
          </button>
        </div>
      )}

      <main className="min-h-0 flex-1">
        {aba === 'hoje' && <Hoje irParaAjustes={() => setAba('ajustes')} irParaHabitos={() => setAba('habitos')} />}
        {aba === 'historico' && <EmBreve titulo="Histórico" fase="Fase 6" />}
        {aba === 'evolucao' && <EmBreve titulo="Evolução" fase="Fase 7" />}
        {aba === 'habitos' && <Habitos />}
        {aba === 'ajustes' && <Ajustes atualizacao={atualizacao} />}
      </main>

      <NavInferior ativa={aba} aoEscolher={setAba} />
    </div>
  );
}

type Abertura = { estado: 'abrindo' } | { estado: 'ok' } | { estado: 'falha'; erro: string; dadosLegados: ArquivoBackup | null };

/** Abre o banco com proteção antes de mostrar qualquer tela (RF-63, RF-71). */
export default function App() {
  const [abertura, setAbertura] = useState<Abertura>({ estado: 'abrindo' });

  const abrir = useCallback(async () => {
    setAbertura({ estado: 'abrindo' });
    const r = await abrirBancoComSeguranca(db, __APP_VERSION__, dataLogica(new Date(), 0));
    setAbertura(r.ok ? { estado: 'ok' } : { estado: 'falha', erro: r.erro, dadosLegados: r.dadosLegados });
  }, []);

  useEffect(() => {
    void abrir();
  }, [abrir]);

  if (abertura.estado === 'abrindo') {
    return (
      <div className="flex h-full items-center justify-center bg-fundo text-[15px] text-texto2" role="status">
        Abrindo seus dados…
      </div>
    );
  }
  if (abertura.estado === 'falha') {
    return (
      <TelaFalhaBanco
        erro={abertura.erro}
        dadosLegados={abertura.dadosLegados}
        aoTentarDeNovo={() => void abrir()}
        aoRecuperar={() => void abrir()}
      />
    );
  }
  return <AppPronto />;
}
