import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Check, Download, RefreshCw, Smartphone, TriangleAlert } from 'lucide-react';
import { db, lerContador, somarContador, type DadoTeste } from './database/db';
import { operacoes } from './database/operacoes';
import { estaInstalado, lerArmazenamento, type StatusArmazenamento } from './services/ambiente';
import { salvarArquivoTeste, type TipoTeste } from './services/arquivoTeste';

const botao =
  'min-h-[48px] rounded-full px-5 text-[15px] font-semibold active:opacity-80';
const botaoPrincipal = `${botao} bg-[#0B7A43] text-white`;
const botaoContorno = `${botao} border-[1.5px] border-[#0B7A43] bg-white text-[#0B7A43]`;
const cartao = 'rounded-2xl border border-[#E6E9E7] bg-white p-4';

export default function App() {
  const instalado = estaInstalado();
  const [dado, setDado] = useState<DadoTeste | undefined>();
  const [armaz, setArmaz] = useState<StatusArmazenamento | null>(null);
  const [mostrarComoInstalar, setMostrarComoInstalar] = useState(false);
  const [novaVersao, setNovaVersao] = useState(false);
  const [offlinePronto, setOfflinePronto] = useState(false);
  const [bancoInfo, setBancoInfo] = useState('Verificando…');
  const [msgAtualizacao, setMsgAtualizacao] = useState('');
  const [msgArquivo, setMsgArquivo] = useState('');
  const atualizarRef = useRef<((recarregar?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    void lerContador().then(setDado);
    void lerArmazenamento().then(setArmaz);
    void (async () => {
      try {
        await operacoes.garantirMeta();
        const [h, r] = await Promise.all([db.habitos.count(), db.registros.count()]);
        setBancoInfo(`formato ${db.verno} · ${h} hábitos · ${r} registros`);
      } catch {
        setBancoInfo('não foi possível abrir o banco');
      }
    })();
    atualizarRef.current = registerSW({
      onNeedRefresh: () => setNovaVersao(true),
      onOfflineReady: () => setOfflinePronto(true),
    });
  }, []);

  async function somar() {
    setDado(await somarContador());
    setArmaz(await lerArmazenamento());
  }

  async function verificarAtualizacao() {
    setMsgAtualizacao('Verificando…');
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) {
        setMsgAtualizacao('Sem internet ou o app ainda não está pronto para atualizar.');
        return;
      }
      await reg.update();
      setMsgAtualizacao(
        reg.waiting || reg.installing
          ? 'Nova versão encontrada.'
          : 'Você já está na versão mais recente.',
      );
    } catch {
      setMsgAtualizacao('Não foi possível verificar agora (sem internet?).');
    }
  }

  async function arquivo(tipo: TipoTeste) {
    setMsgArquivo(await salvarArquivoTeste(tipo));
  }

  const textoPersist =
    armaz === null
      ? 'Verificando…'
      : armaz.persistente === 'indisponivel'
        ? 'Este aparelho não informou. Não há garantia.'
        : armaz.persistente
          ? 'Concedido. Mesmo assim, não é garantia: faça backups.'
          : 'Não concedido. Faça backups com frequência.';

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 px-4"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
      }}
    >
      <header>
        <div className="text-[13px] font-semibold tracking-wider text-[#5B6560]">
          FASE 2 · APP DE TESTE
        </div>
        <h1 className="text-[28px] font-bold leading-tight">Habit Tracker</h1>
      </header>

      {!instalado && (
        <div
          role="alert"
          className="flex gap-3 rounded-2xl border border-[#B45309] bg-[#FFF7ED] p-4 text-[15px] text-[#7C3A06]"
        >
          <TriangleAlert className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
          <div>
            <strong>Você está no navegador.</strong> Os dados daqui não são os do app instalado.
          </div>
        </div>
      )}

      {novaVersao && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#1B1F1D] p-3 pl-4 text-white">
          <span className="text-[14px]">Nova versão disponível</span>
          <button
            type="button"
            className="min-h-[44px] rounded-full px-4 text-[14px] font-bold text-[#8FE0B2]"
            onClick={() => void atualizarRef.current?.(true)}
          >
            Atualizar
          </button>
        </div>
      )}

      <section className={cartao} aria-labelledby="t-dado">
        <h2 id="t-dado" className="text-[16px] font-semibold">
          Dado de teste
        </h2>
        <p className="mt-1 text-[14px] text-[#5B6560]">
          Toque, feche o app, ative o modo avião e abra de novo. O número deve continuar igual.
        </p>
        <div className="my-3 text-[40px] font-bold">{dado?.valor ?? 0}</div>
        <div className="mb-3 text-[13px] text-[#5B6560]">
          {dado ? `Última gravação: ${dado.atualizadoEm}` : 'Nada gravado ainda.'}
        </div>
        <button type="button" className={botaoPrincipal} onClick={() => void somar()}>
          + Gravar 1
        </button>
      </section>

      <section className={cartao} aria-labelledby="t-amb">
        <h2 id="t-amb" className="text-[16px] font-semibold">
          Ambiente
        </h2>
        <ul className="mt-2 space-y-2 text-[14px]">
          <li className="flex items-center gap-2">
            <Smartphone size={18} aria-hidden="true" />
            Aberto como app instalado: <strong>{instalado ? 'sim' : 'não'}</strong>
          </li>
          <li>
            Armazenamento persistente: <strong>{textoPersist}</strong>
          </li>
          <li>
            Espaço usado:{' '}
            <strong>{armaz?.usadoKB === null || !armaz ? 'não informado' : `${armaz.usadoKB} KB`}</strong>
          </li>
          <li>
            Banco de dados: <strong>{bancoInfo}</strong>
          </li>
          <li className="flex items-center gap-2">
            <Check size={18} aria-hidden="true" />
            Pronto para usar sem internet:{' '}
            <strong>{offlinePronto ? 'sim' : 'ainda não confirmado'}</strong>
          </li>
        </ul>
      </section>

      <section className={cartao} aria-labelledby="t-arq">
        <h2 id="t-arq" className="text-[16px] font-semibold">
          Teste de salvar arquivo
        </h2>
        <p className="mt-1 text-[14px] text-[#5B6560]">
          Toque em um botão, escolha &quot;Salvar em Arquivos&quot; e confira se o arquivo aparece.
          Teste os dois tipos.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={botaoContorno} onClick={() => void arquivo('json')}>
            <Download className="mr-1 inline" size={16} aria-hidden="true" />
            Arquivo .json
          </button>
          <button type="button" className={botaoContorno} onClick={() => void arquivo('txt')}>
            <Download className="mr-1 inline" size={16} aria-hidden="true" />
            Arquivo .txt
          </button>
        </div>
        {msgArquivo && <p className="mt-3 text-[14px]">{msgArquivo}</p>}
      </section>

      <section className={cartao} aria-labelledby="t-ver">
        <h2 id="t-ver" className="text-[16px] font-semibold">
          Versão {__APP_VERSION__}
        </h2>
        <button type="button" className={`${botaoContorno} mt-3`} onClick={() => void verificarAtualizacao()}>
          <RefreshCw className="mr-1 inline" size={16} aria-hidden="true" />
          Verificar atualização
        </button>
        {msgAtualizacao && <p className="mt-3 text-[14px]">{msgAtualizacao}</p>}
      </section>

      <button
        type="button"
        className={botaoContorno}
        onClick={() => setMostrarComoInstalar((v) => !v)}
        aria-expanded={mostrarComoInstalar}
      >
        Como instalar no iPhone
      </button>
      {mostrarComoInstalar && (
        <ol className={`${cartao} list-decimal space-y-2 pl-8 text-[15px]`}>
          <li>Abra este endereço no <strong>Safari</strong> (não use outro navegador).</li>
          <li>Na barra do Safari, toque nos três pontinhos <strong>(⋯)</strong> para abrir o menu.</li>
          <li>Toque em <strong>Adicionar à Tela de Início</strong>. Se não estiver no menu, toque em <strong>Compartilhar</strong> e role a lista até achar essa opção.</li>
          <li>Deixe ativada a opção <strong>Abrir como app web</strong> e toque em <strong>Adicionar</strong>.</li>
          <li>
            Abra sempre pelo <strong>ícone</strong> novo. Se apagar o ícone, os dados do app são
            apagados junto.
          </li>
        </ol>
      )}
    </div>
  );
}
