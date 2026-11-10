import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { NavInferior, type Aba } from './components/NavInferior';
import { useAtualizacao } from './hooks/useAtualizacao';
import { estaInstalado } from './services/ambiente';
import Ajustes from './screens/Ajustes';
import EmBreve from './screens/EmBreve';
import Hoje from './screens/Hoje';

export default function App() {
  const [aba, setAba] = useState<Aba>('hoje');
  const atualizacao = useAtualizacao();
  const instalado = estaInstalado();

  return (
    <div className="mx-auto flex h-full max-w-[480px] flex-col bg-fundo">
      {!instalado && (
        <div
          role="alert"
          className="mx-4 mt-2 flex shrink-0 gap-3 rounded-2xl border border-laranja bg-laranja-claro p-3 text-[14px] text-[#7C3A06]"
          style={{ marginTop: 'var(--topo-seguro)' }}
        >
          <TriangleAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          <div>
            <strong>Você está no navegador.</strong> Os dados daqui não são os do app instalado.
          </div>
        </div>
      )}

      {atualizacao.novaVersao && (
        <div className="mx-4 mt-2 flex shrink-0 items-center justify-between gap-3 rounded-2xl bg-aviso p-3 pl-4 text-white">
          <span className="text-[14px]">Nova versão disponível</span>
          <button
            type="button"
            className="h-11 rounded-full px-4 text-[14px] font-bold text-aviso-desfazer"
            onClick={() => void atualizacao.atualizar()}
          >
            Atualizar
          </button>
        </div>
      )}

      <main className="min-h-0 flex-1">
        {aba === 'hoje' && <Hoje irParaAjustes={() => setAba('ajustes')} />}
        {aba === 'historico' && <EmBreve titulo="Histórico" fase="Fase 6" />}
        {aba === 'evolucao' && <EmBreve titulo="Evolução" fase="Fase 7" />}
        {aba === 'habitos' && <EmBreve titulo="Hábitos" fase="Fase 5" />}
        {aba === 'ajustes' && <Ajustes atualizacao={atualizacao} />}
      </main>

      <NavInferior ativa={aba} aoEscolher={setAba} />
    </div>
  );
}
