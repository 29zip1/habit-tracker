import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { FormularioHabito } from '../components/FormularioHabito';
import { IconeHabito } from '../components/icones';
import { operacoes } from '../database/operacoes';
import { useDataHoje, useLive } from '../hooks/useLive';
import { versaoVigente, type HabitoCompleto } from '../services/calculos';
import { descreverVersao } from '../services/habitos';
import { CONFIG_PADRAO } from '../types';

type Edicao = { modo: 'novo' } | { modo: 'editar'; id: string };

function versaoParaMostrar(h: HabitoCompleto, hoje: string) {
  return (
    versaoVigente(h.versoes, hoje) ??
    [...h.versoes].sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? -1 : 1))[0]
  );
}

function Linha({ h, hoje, aoAbrir, aoReativar }: { h: HabitoCompleto; hoje: string; aoAbrir: () => void; aoReativar?: () => void }) {
  const v = versaoParaMostrar(h, hoje);
  return (
    <div className="-mx-4 flex min-h-[64px] items-center gap-3 border-t border-linha px-4 py-2.5 first:border-t-0">
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
          <IconeHabito nome={h.habito.icone} cor={h.habito.cor} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[16px] font-semibold leading-tight">{h.habito.nome}</span>
          <span className="truncate text-[13px] text-texto2">{v ? descreverVersao(v) : ''}</span>
        </span>
        {!aoReativar && <ChevronRight size={18} className="shrink-0 text-texto2" aria-hidden="true" />}
      </button>
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

/** Aba Hábitos (Fase 5): lista, criar, editar, arquivar e reativar. */
export default function Habitos() {
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const hoje = useDataHoje(config.inicioDoDiaHora);
  const habitos = useLive(() => operacoes.lerHabitosCompletos(), [], null as HabitoCompleto[] | null);
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [confirmandoArquivar, setConfirmandoArquivar] = useState(false);

  const ativos = (habitos ?? []).filter((h) => h.habito.status === 'ativo');
  const arquivados = (habitos ?? []).filter((h) => h.habito.status === 'arquivado');
  const editado = edicao?.modo === 'editar' ? (habitos ?? []).find((h) => h.habito.id === edicao.id) : undefined;

  async function arquivar() {
    if (!editado) return;
    await operacoes.arquivarHabito(editado.habito.id, hoje);
    setConfirmandoArquivar(false);
    setEdicao(null);
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

        {habitos !== null && ativos.length === 0 && (
          <p className="rounded-2xl border border-borda bg-cartao p-4 text-[15px] text-texto2">
            Você ainda não tem hábitos. Toque em <strong>Novo hábito</strong> para criar o primeiro.
          </p>
        )}

        {ativos.length > 0 && (
          <section className="rounded-[20px] border border-borda bg-cartao px-4" aria-label="Hábitos ativos">
            {ativos.map((h) => (
              <Linha key={h.habito.id} h={h} hoje={hoje} aoAbrir={() => setEdicao({ modo: 'editar', id: h.habito.id })} />
            ))}
          </section>
        )}

        {arquivados.length > 0 && (
          <section aria-labelledby="t-arq">
            <h2 id="t-arq" className="mb-2 text-[15px] font-semibold text-texto2">
              Arquivados
            </h2>
            <div className="rounded-[20px] border border-borda bg-cartao px-4">
              {arquivados.map((h) => (
                <Linha
                  key={h.habito.id}
                  h={h}
                  hoje={hoje}
                  aoAbrir={() => setEdicao({ modo: 'editar', id: h.habito.id })}
                  aoReativar={() => void operacoes.reativarHabito(h.habito.id)}
                />
              ))}
            </div>
            <p className="mt-2 text-[13px] text-texto2">
              Hábitos arquivados somem da tela Hoje. O histórico deles fica guardado.
            </p>
          </section>
        )}
      </div>

      {edicao && (edicao.modo === 'novo' || editado) && (
        <FormularioHabito
          key={edicao.modo === 'editar' ? edicao.id : 'novo'}
          habito={editado}
          hoje={hoje}
          aoFechar={() => {
            setEdicao(null);
            setConfirmandoArquivar(false);
          }}
          aoArquivar={editado && editado.habito.status === 'ativo' ? () => setConfirmandoArquivar(true) : undefined}
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
              <button
                type="button"
                onClick={() => setConfirmandoArquivar(false)}
                className="h-12 flex-1 rounded-full border-[1.5px] border-cinza-anel bg-cartao text-[15px] font-semibold text-texto"
              >
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
    </div>
  );
}
