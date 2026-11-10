import { useEffect, useState } from 'react';
import { Check, Download, RefreshCw, Smartphone } from 'lucide-react';
import { db, lerContador, somarContador, type DadoTeste } from '../database/db';
import { operacoes } from '../database/operacoes';
import { dataLogica } from '../services/datas';
import { CONFIG_PADRAO } from '../types';
import { estaInstalado, lerArmazenamento, type StatusArmazenamento } from '../services/ambiente';
import { salvarArquivoTeste, type TipoTeste } from '../services/arquivoTeste';
import { carregarExemplos } from '../services/exemplos';
import { useLive } from '../hooks/useLive';
import type { useAtualizacao } from '../hooks/useAtualizacao';

const botao = 'min-h-[48px] rounded-full px-5 text-[15px] font-semibold active:opacity-80';
const botaoPrincipal = `${botao} bg-verde text-white`;
const botaoContorno = `${botao} border-[1.5px] border-verde bg-cartao text-verde`;
const cartao = 'rounded-2xl border border-borda bg-cartao p-4';

export default function Ajustes({ atualizacao }: { atualizacao: ReturnType<typeof useAtualizacao> }) {
  const instalado = estaInstalado();
  const [dado, setDado] = useState<DadoTeste | undefined>();
  const [armaz, setArmaz] = useState<StatusArmazenamento | null>(null);
  const [bancoInfo, setBancoInfo] = useState('Verificando…');
  const [mostrarComoInstalar, setMostrarComoInstalar] = useState(false);
  const [msgArquivo, setMsgArquivo] = useState('');
  const [msgExemplo, setMsgExemplo] = useState('');
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const quantosExemplos = useLive(
    () => db.habitos.filter((h) => h.exemplo === true).count(),
    [],
    0,
  );

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
  }, [quantosExemplos]);

  async function somar() {
    setDado(await somarContador());
    setArmaz(await lerArmazenamento());
  }

  async function arquivo(tipo: TipoTeste) {
    setMsgArquivo(await salvarArquivoTeste(tipo));
  }

  async function criarExemplos() {
    const config = await operacoes.lerConfig();
    const n = await carregarExemplos(operacoes, dataLogica(new Date(), config.inicioDoDiaHora));
    setMsgExemplo(`${n} hábitos de exemplo criados. Veja na aba Hoje.`);
  }

  async function removerExemplos() {
    const r = await operacoes.removerExemplos();
    setConfirmandoRemocao(false);
    setMsgExemplo(`Removidos ${r.habitos} hábitos de exemplo e ${r.registros} registros deles.`);
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
      className="h-full overflow-y-auto px-4 pb-8"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}
    >
      <div className="mx-auto flex max-w-[480px] flex-col gap-4">
        <h1 className="text-[28px] font-bold leading-tight">Ajustes</h1>

        <section className={cartao} aria-labelledby="t-ex">
          <h2 id="t-ex" className="text-[16px] font-semibold">
            Hábitos de exemplo (temporário)
          </h2>
          <p className="mt-1 text-[14px] text-texto2">
            Para testar a tela Hoje. São 7 hábitos genéricos, sem nada pessoal. A criação dos seus hábitos chega
            numa próxima fase; estes exemplos saem então.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={botaoPrincipal}
              disabled={quantosExemplos > 0}
              style={quantosExemplos > 0 ? { opacity: 0.5 } : undefined}
              onClick={() => void criarExemplos()}
            >
              Carregar hábitos de exemplo
            </button>
            <button
              type="button"
              className={botaoContorno}
              disabled={quantosExemplos === 0}
              style={quantosExemplos === 0 ? { opacity: 0.5 } : undefined}
              onClick={() => setConfirmandoRemocao(true)}
            >
              Apagar hábitos de exemplo
            </button>
          </div>
          {confirmandoRemocao && (
            <div role="alertdialog" aria-label="Confirmar remoção" className="mt-3 rounded-xl border border-laranja bg-laranja-claro p-3 text-[14px]">
              <p>
                Vou apagar <strong>só os {quantosExemplos} hábitos de exemplo</strong> e tudo que foi registrado neles.
                Isso não pode ser desfeito. Seus outros dados não são tocados.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className={botaoContorno} onClick={() => setConfirmandoRemocao(false)}>
                  Cancelar
                </button>
                <button type="button" className={`${botao} bg-vermelho text-white`} onClick={() => void removerExemplos()}>
                  Apagar exemplos
                </button>
              </div>
            </div>
          )}
          {msgExemplo && <p className="mt-3 text-[14px]">{msgExemplo}</p>}
        </section>

        <section className={cartao} aria-labelledby="t-tela">
          <h2 id="t-tela" className="text-[16px] font-semibold">
            Tela Hoje
          </h2>
          <label className="mt-2 flex min-h-11 items-center justify-between gap-3 text-[15px]">
            <span>Mostrar a dica de uso embaixo da lista</span>
            <input
              type="checkbox"
              checked={config.dicaVisivel}
              onChange={(e) => void operacoes.salvarConfig({ dicaVisivel: e.target.checked })}
              className="size-6 accent-[#0B7A43]"
            />
          </label>
        </section>

        <section className={cartao} aria-labelledby="t-dado">
          <h2 id="t-dado" className="text-[16px] font-semibold">
            Dado de teste
          </h2>
          <p className="mt-1 text-[14px] text-texto2">
            Toque, feche o app, ative o modo avião e abra de novo. O número deve continuar igual.
          </p>
          <div className="my-3 text-[40px] font-bold">{dado?.valor ?? 0}</div>
          <div className="mb-3 text-[13px] text-texto2">
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
              Espaço usado: <strong>{armaz?.usadoKB == null ? 'não informado' : `${armaz.usadoKB} KB`}</strong>
            </li>
            <li>
              Banco de dados: <strong>{bancoInfo}</strong>
            </li>
            <li className="flex items-center gap-2">
              <Check size={18} aria-hidden="true" />
              Pronto para usar sem internet:{' '}
              <strong>{atualizacao.offlinePronto ? 'sim' : 'ainda não confirmado'}</strong>
            </li>
          </ul>
        </section>

        <section className={cartao} aria-labelledby="t-arq">
          <h2 id="t-arq" className="text-[16px] font-semibold">
            Teste de salvar arquivo
          </h2>
          <p className="mt-1 text-[14px] text-texto2">
            Toque em um botão, escolha &quot;Salvar em Arquivos&quot; e confira se o arquivo aparece.
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
          <button type="button" className={`${botaoContorno} mt-3`} onClick={() => void atualizacao.verificar()}>
            <RefreshCw className="mr-1 inline" size={16} aria-hidden="true" />
            Verificar atualização
          </button>
          {atualizacao.mensagem && <p className="mt-3 text-[14px]">{atualizacao.mensagem}</p>}
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
              Abra sempre pelo <strong>ícone</strong> novo. Se apagar o ícone, os dados do app são apagados junto.
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
