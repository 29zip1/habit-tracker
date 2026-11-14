import { useEffect, useRef, useState } from 'react';
import { Check, RefreshCw, Smartphone } from 'lucide-react';
import { db } from '../database/db';
import { operacoes } from '../database/operacoes';
import { dataLogica } from '../services/datas';
import { CONFIG_PADRAO } from '../types';
import { estaInstalado, lerArmazenamento, type StatusArmazenamento } from '../services/ambiente';
import { ImportarHabitos } from '../components/ImportarHabitos';
import { criarCopiaDeSeguranca } from '../database/copias';
import { SecaoBackup } from '../components/SecaoBackup';
import { useLive } from '../hooks/useLive';
import type { useAtualizacao } from '../hooks/useAtualizacao';

const botao = 'min-h-[48px] rounded-full px-5 text-[15px] font-semibold active:opacity-80';
const botaoContorno = `${botao} border-[1.5px] border-verde-texto bg-cartao text-verde-texto`;
const cartao = 'rounded-2xl border border-borda bg-cartao p-4';

export default function Ajustes({ atualizacao }: { atualizacao: ReturnType<typeof useAtualizacao> }) {
  const instalado = estaInstalado();
  const [armaz, setArmaz] = useState<StatusArmazenamento | null>(null);
  const [bancoInfo, setBancoInfo] = useState('Verificando…');
  const [mostrarComoInstalar, setMostrarComoInstalar] = useState(false);
  const passosRef = useRef<HTMLOListElement>(null);
  const [msgExemplo, setMsgExemplo] = useState('');
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const quantosExemplos = useLive(
    () => db.habitos.filter((h) => h.exemplo === true).count(),
    [],
    0,
  );

  useEffect(() => {
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

  // RF-76: ao abrir "Como instalar", a tela rola até os passos para o usuário perceber.
  useEffect(() => {
    if (!mostrarComoInstalar) return;
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    passosRef.current?.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' });
  }, [mostrarComoInstalar]);

  async function removerExemplos() {
    // RF-65/RF-69: antes de excluir, guarda uma cópia dos dados.
    const cfg = await operacoes.lerConfig();
    await criarCopiaDeSeguranca(db, 'antes-excluir', __APP_VERSION__, dataLogica(new Date(), cfg.inicioDoDiaHora));
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
      style={{ paddingTop: 'var(--topo-seguro)' }}
    >
      <div className="mx-auto flex max-w-[480px] flex-col gap-4">
        <h1 className="text-[28px] font-bold leading-tight">Ajustes</h1>

        <SecaoBackup />

        <section className={cartao} aria-labelledby="t-imp">
          <h2 id="t-imp" className="text-[16px] font-semibold">
            Importar hábitos
          </h2>
          <p className="mt-1 text-[14px] text-texto2">
            Escolha um arquivo de hábitos (por exemplo, o que você guardou no iCloud Drive). Só acrescenta hábitos novos:
            os que você já tem e seus registros não mudam, e hábitos com o mesmo nome são pulados.
          </p>
          <div className="mt-3">
            <ImportarHabitos />
          </div>
        </section>

        {quantosExemplos > 0 && (
        <section className={cartao} aria-labelledby="t-ex">
          <h2 id="t-ex" className="text-[16px] font-semibold">
            Hábitos de exemplo
          </h2>
          <p className="mt-1 text-[14px] text-texto2">
            Estes são os hábitos de exemplo que você carregou antes. Quando quiser, apague todos de uma vez (os hábitos
            que você criou ou importou não são tocados).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
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
                <button type="button" className={`${botao} bg-vermelho text-aviso-texto`} onClick={() => void removerExemplos()}>
                  Apagar exemplos
                </button>
              </div>
            </div>
          )}
          {msgExemplo && <p className="mt-3 text-[14px]">{msgExemplo}</p>}
        </section>
        )}

        <section className={cartao} aria-labelledby="t-tela">
          <h2 id="t-tela" className="text-[16px] font-semibold">
            Tela Hoje
          </h2>
          <div role="radiogroup" aria-label="Tema" className="mt-3 flex gap-2">
            {(
              [
                ['sistema', 'Sistema'],
                ['claro', 'Claro'],
                ['escuro', 'Escuro'],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={config.tema === valor}
                onClick={() => void operacoes.salvarConfig({ tema: valor })}
                className={`h-11 flex-1 rounded-full border-[1.5px] text-[14px] font-semibold ${
                  config.tema === valor
                    ? 'border-verde bg-verde text-white'
                    : 'border-borda-bloco bg-cartao text-verde-texto'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
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
          <ol ref={passosRef} className={`${cartao} list-decimal space-y-2 pl-8 text-[15px]`}>
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
