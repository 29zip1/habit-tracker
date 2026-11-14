import { useState } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { FormularioHabito } from '../components/FormularioHabito';
import { IconeHabito } from '../components/icones';
import { ListaOrdenavel } from '../components/ListaOrdenavel';
import { criarCopiaDeSeguranca } from '../database/copias';
import { db } from '../database/db';
import { operacoes } from '../database/operacoes';
import { useArquivosBackup } from '../hooks/useArquivosBackup';
import { useDataHoje, useLive } from '../hooks/useLive';
import { versaoVigente, type HabitoCompleto } from '../services/calculos';
import { baixarArquivo, compartilharArquivo } from '../services/compartilhar';
import { corDoDesenho, descreverVersao } from '../services/habitos';
import { CONFIG_PADRAO } from '../types';

type Edicao = { modo: 'novo' } | { modo: 'editar'; id: string };
/**
 * RF-32b. 'escolha' = o que fazer com o histórico; 'tudo1' e 'tudo2' = apagar tudo (dupla
 * confirmação); 'manter' = apagar mantendo o histórico.
 */
type PassoExcluir = 0 | 'escolha' | 'tudo1' | 'tudo2' | 'manter';

function versaoParaMostrar(h: HabitoCompleto, hoje: string) {
  return (
    versaoVigente(h.versoes, hoje) ??
    [...h.versoes].sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? -1 : 1))[0]
  );
}

interface LinhaProps {
  h: HabitoCompleto;
  hoje: string;
  aoAbrir: () => void;
  aoReativar?: () => void;
}

function Linha({ h, hoje, aoAbrir, aoReativar }: LinhaProps) {
  const v = versaoParaMostrar(h, hoje);
  const ordenavel = !aoReativar;
  return (
    <div className="-mx-4 flex min-h-[64px] items-center gap-1 px-4 py-2.5">
      <button
        type="button"
        onClick={aoAbrir}
        aria-label={`Editar ${h.habito.nome}`}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left text-texto"
      >
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${h.habito.cor} 20%, transparent)` }}
        >
          <IconeHabito nome={h.habito.icone} cor={corDoDesenho(h.habito.cor)} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[16px] font-semibold leading-tight">{h.habito.nome}</span>
          <span className="truncate text-[13px] text-texto2">{v ? descreverVersao(v) : ''}</span>
        </span>
      </button>
      {ordenavel && <GripVertical size={20} className="shrink-0 text-texto2 opacity-50" aria-hidden="true" />}
      {aoReativar && (
        <button
          type="button"
          onClick={aoReativar}
          className="h-11 shrink-0 rounded-full border-[1.5px] border-verde-texto bg-transparent px-4 text-[14px] font-semibold text-verde-texto"
        >
          Reativar
        </button>
      )}
    </div>
  );
}

const botaoContorno = 'h-12 flex-1 rounded-full border-[1.5px] border-cinza-anel bg-cartao text-[15px] font-semibold text-texto';

/** Aba Hábitos (Fase 5): lista, criar, editar, reordenar, duplicar, arquivar, reativar e excluir de vez. */
export default function Habitos() {
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const hoje = useDataHoje(config.inicioDoDiaHora);
  const habitos = useLive(() => operacoes.lerHabitosCompletos(), [], null as HabitoCompleto[] | null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [confirmandoArquivar, setConfirmandoArquivar] = useState(false);
  const [passoExcluir, setPassoExcluir] = useState<PassoExcluir>(0);
  const [msgBackup, setMsgBackup] = useState('');
  const [erro, setErro] = useState('');

  const ativos = (habitos ?? []).filter((h) => h.habito.status === 'ativo');
  const arquivados = (habitos ?? []).filter((h) => h.habito.status === 'arquivado');
  const editado = edicao?.modo === 'editar' ? (habitos ?? []).find((h) => h.habito.id === edicao.id) : undefined;
  const arquivosBackup = useArquivosBackup(passoExcluir === 'tudo1');

  function fecharTudo() {
    setEdicao(null);
    setConfirmandoArquivar(false);
    setPassoExcluir(0);
    setMsgBackup('');
  }

  async function arquivar() {
    if (!editado) return;
    await operacoes.arquivarHabito(editado.habito.id, hoje);
    fecharTudo();
  }

  async function duplicar() {
    if (!editado) return;
    try {
      const r = await operacoes.duplicarHabito(editado.habito.id, hoje);
      setEdicao({ modo: 'editar', id: r.habito.id });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui duplicar.');
    }
  }

  async function salvarBackupAntes() {
    if (!arquivosBackup) return;
    const r = await compartilharArquivo(arquivosBackup.backup, 'Backup do Habit Tracker');
    if (r === 'indisponivel') baixarArquivo(arquivosBackup.backup);
    if (r === 'compartilhado' || r === 'indisponivel') {
      await operacoes.salvarConfig({ ultimoBackup: new Date().toISOString() });
      setMsgBackup('Backup salvo. Agora você pode continuar.');
    } else if (r === 'erro') {
      setMsgBackup('Não consegui salvar o backup agora. Você pode tentar de novo.');
    }
  }

  async function removerMantendo() {
    if (!editado) return;
    try {
      // Cópia automática antes (RF-69), mesmo sem apagar registros.
      await criarCopiaDeSeguranca(db, 'antes-excluir', __APP_VERSION__, hoje);
      await operacoes.removerMantendoHistorico(editado.habito.id, hoje);
      fecharTudo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui apagar.');
      setPassoExcluir(0);
    }
  }

  async function excluirParaSempre() {
    if (!editado) return;
    try {
      // RF-65/RF-69: cópia automática antes de apagar.
      await criarCopiaDeSeguranca(db, 'antes-excluir', __APP_VERSION__, hoje);
      await operacoes.excluirHabito(editado.habito.id);
      fecharTudo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir.');
      setPassoExcluir(0);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-8" style={{ paddingTop: 'var(--topo-seguro)' }}>
      <div className="mx-auto flex max-w-[480px] flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[28px] font-bold leading-tight">Hábitos</h1>
          <button
            type="button"
            onClick={() => setEdicao({ modo: 'novo' })}
            className="flex h-11 items-center gap-1.5 rounded-full border-0 bg-verde px-4 text-[15px] font-semibold text-white"
          >
            <Plus size={18} aria-hidden="true" />
            Novo hábito
          </button>
        </div>

        {erro && (
          <p role="alert" className="rounded-xl border border-laranja bg-laranja-claro p-3 text-[14px] text-laranja-texto">
            {erro}
          </p>
        )}

        {habitos !== null && ativos.length === 0 && (
          <p className="rounded-2xl border border-borda bg-cartao p-4 text-[15px] text-texto2">
            Você não tem hábitos ativos. Toque em <strong>Novo hábito</strong> para criar um.
          </p>
        )}

        {ativos.length > 0 && (
          <section className="rounded-[20px] border border-borda bg-cartao px-4" aria-label="Hábitos ativos">
            <ListaOrdenavel
              ids={ativos.map((h) => h.habito.id)}
              aoReordenar={(novos) => void operacoes.definirOrdem(novos)}
            >
              {ativos.map((h) => (
                <Linha key={h.habito.id} h={h} hoje={hoje} aoAbrir={() => setEdicao({ modo: 'editar', id: h.habito.id })} />
              ))}
            </ListaOrdenavel>
          </section>
        )}
        {ativos.length > 1 && (
          <p className="-mt-2 text-[13px] text-texto2">Dica: segure um hábito e arraste para mudar a ordem.</p>
        )}

        {arquivados.length > 0 && (
          <section aria-labelledby="t-arq">
            <h2 id="t-arq" className="mb-2 text-[15px] font-semibold text-texto2">
              Arquivados
            </h2>
            <div className="rounded-[20px] border border-borda bg-cartao px-4">
              {arquivados.map((h, i) => (
                <div key={h.habito.id} className={i > 0 ? 'border-t border-linha' : ''}>
                <Linha
                  h={h}
                  hoje={hoje}
                  aoAbrir={() => setEdicao({ modo: 'editar', id: h.habito.id })}
                  aoReativar={() => void operacoes.reativarHabito(h.habito.id)}
                />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-texto2">
              Hábitos arquivados somem da tela Hoje e o histórico deles fica guardado. Para apagar, toque no hábito.
            </p>
          </section>
        )}
      </div>

      {edicao && (edicao.modo === 'novo' || editado) && (
        <FormularioHabito
          key={edicao.modo === 'editar' ? edicao.id : 'novo'}
          habito={editado}
          hoje={hoje}
          categoriasUsadas={(habitos ?? []).map((h) => h.habito.categoria)}
          outrosHabitos={(habitos ?? [])
            .filter((h) => h.habito.id !== editado?.habito.id)
            .map((h) => ({ id: h.habito.id, nome: h.habito.nome, cor: h.habito.cor, icone: h.habito.icone }))}
          aoFechar={fecharTudo}
          aoArquivar={editado && editado.habito.status === 'ativo' ? () => setConfirmandoArquivar(true) : undefined}
          aoDuplicar={editado ? () => void duplicar() : undefined}
          aoExcluir={editado ? () => setPassoExcluir('escolha') : undefined}
        />
      )}

      {confirmandoArquivar && editado && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-[rgba(27,31,29,0.45)]">
          <div
            role="alertdialog"
            aria-label="Confirmar arquivamento"
            className="mx-auto flex w-full max-w-[480px] flex-col gap-3 rounded-t-3xl bg-cartao px-5 pt-5"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
          >
            <div className="text-[18px] font-bold">Arquivar “{editado.habito.nome}”?</div>
            <p className="text-[14px] text-texto2">
              Ele some da tela Hoje a partir de hoje. Tudo que você registrou fica guardado e continua valendo no
              histórico. Você pode reativar quando quiser.
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setConfirmandoArquivar(false)} className={botaoContorno}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void arquivar()}
                className="h-12 flex-[1.4] rounded-full border-0 bg-verde text-[15px] font-bold text-white"
              >
                Arquivar
              </button>
            </div>
          </div>
        </div>
      )}

      {passoExcluir !== 0 && editado && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-[rgba(27,31,29,0.45)]">
          <div
            role="alertdialog"
            aria-label="Apagar hábito"
            className="mx-auto flex w-full max-w-[480px] flex-col gap-3 rounded-t-3xl bg-cartao px-5 pt-5"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
          >
            {passoExcluir === 'escolha' && (
              <>
                <div className="text-[18px] font-bold">Apagar “{editado.habito.nome}”</div>
                <p className="text-[14px] text-texto2">O que fazer com o histórico dele?</p>
                <button
                  type="button"
                  onClick={() => setPassoExcluir('manter')}
                  className="flex min-h-[64px] flex-col items-start rounded-xl border-[1.5px] border-cinza-anel bg-cartao px-3 py-2 text-left"
                >
                  <span className="text-[15px] font-semibold text-texto">Apagar o hábito e manter o histórico</span>
                  <span className="text-[13px] text-texto2">
                    Ele continua hoje e some a partir de amanhã. Tudo que foi registrado, hoje e antes, fica guardado.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPassoExcluir('tudo1')}
                  className="flex min-h-[64px] flex-col items-start rounded-xl border-[1.5px] border-laranja bg-cartao px-3 py-2 text-left"
                >
                  <span className="text-[15px] font-semibold text-laranja-texto">Apagar o hábito e o histórico</span>
                  <span className="text-[13px] text-texto2">
                    Apaga também todos os registros, de hoje e dos dias anteriores. Não dá para desfazer.
                  </span>
                </button>
                <button type="button" onClick={() => setPassoExcluir(0)} className={botaoContorno}>
                  Cancelar
                </button>
              </>
            )}

            {passoExcluir === 'manter' && (
              <>
                <div className="text-[18px] font-bold">Apagar “{editado.habito.nome}” e manter o histórico?</div>
                <p className="text-[14px] text-texto2">
                  O hábito some da aba Hábitos agora e <strong>não pode ser reativado</strong>. Hoje ele continua na tela
                  Hoje e conta no percentual; <strong>a partir de amanhã</strong> não aparece mais. Os registros de hoje e
                  dos dias anteriores ficam guardados, e os dias passados não mudam. O app guarda uma cópia automática antes.
                </p>
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => setPassoExcluir('escolha')} className={botaoContorno}>
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => void removerMantendo()}
                    className="h-12 flex-[1.4] rounded-full border-0 bg-verde text-[15px] font-bold text-white"
                  >
                    Apagar e manter histórico
                  </button>
                </div>
              </>
            )}

            {passoExcluir === 'tudo1' && (
              <>
                <div className="text-[18px] font-bold">Apagar “{editado.habito.nome}” e o histórico?</div>
                <p className="text-[14px] text-texto2">
                  Isso apaga o hábito <strong>e todos os registros dele</strong>, de hoje e dos dias anteriores. Não dá
                  para desfazer sem restaurar uma cópia.
                </p>
                <button
                  type="button"
                  disabled={!arquivosBackup}
                  onClick={() => void salvarBackupAntes()}
                  className="h-12 rounded-full border-[1.5px] border-verde-texto bg-cartao text-[15px] font-semibold text-verde-texto"
                >
                  Salvar backup antes
                </button>
                {msgBackup && <p className="text-[14px]">{msgBackup}</p>}
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => setPassoExcluir('escolha')} className={botaoContorno}>
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassoExcluir('tudo2')}
                    className="h-12 flex-[1.4] rounded-full border-[1.5px] border-laranja bg-transparent text-[15px] font-bold text-laranja-texto"
                  >
                    Continuar
                  </button>
                </div>
              </>
            )}

            {passoExcluir === 'tudo2' && (
              <>
                <div className="text-[18px] font-bold">Tem certeza?</div>
                <p className="text-[14px] text-texto2">
                  “{editado.habito.nome}” e seus registros serão apagados agora. O app guarda uma cópia automática antes
                  (em Ajustes, “Antes de excluir”).
                </p>
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => setPassoExcluir(0)} className={botaoContorno}>
                    Não apagar
                  </button>
                  <button
                    type="button"
                    onClick={() => void excluirParaSempre()}
                    className="h-12 flex-[1.4] rounded-full border-0 bg-vermelho text-[15px] font-bold text-aviso-texto"
                  >
                    Apagar para sempre
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
