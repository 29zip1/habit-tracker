import { useRef, useState } from 'react';
import Dexie from 'dexie';
import { db } from '../database/db';
import { abrirBancoComSeguranca } from '../database/iniciar';
import { aplicarBackup, nomeArquivoBackup, serializarBackup, validarBackup, type ArquivoBackup, type ResumoBackup } from '../services/backup';
import { baixarArquivo, compartilharArquivo } from '../services/compartilhar';
import { dataLogica } from '../services/datas';

const botao = 'min-h-[48px] rounded-full px-5 text-[15px] font-semibold';

interface Props {
  erro: string;
  dadosLegados: ArquivoBackup | null;
  aoTentarDeNovo: () => void;
  aoRecuperar: () => void;
}

/**
 * RF-63: se o banco não abrir, o app NÃO começa do zero em silêncio. Explica,
 * oferece salvar o que for legível e restaurar um backup.
 */
export function TelaFalhaBanco({ erro, dadosLegados, aoTentarDeNovo, aoRecuperar }: Props) {
  const seletor = useRef<HTMLInputElement>(null);
  const [mensagem, setMensagem] = useState('');
  const [previa, setPrevia] = useState<{ texto: string; resumo: ResumoBackup } | null>(null);
  const versaoNova = erro.includes('mais nova');
  const temLegado = !!dadosLegados && (dadosLegados.contagens.habitos > 0 || dadosLegados.contagens.registros > 0);

  async function salvarLegado() {
    if (!dadosLegados) return;
    const arquivo = new File([serializarBackup(dadosLegados)], nomeArquivoBackup(new Date(), 'json', 'habit-tracker-dados-lidos'), {
      type: 'application/json',
    });
    const r = await compartilharArquivo(arquivo, 'Dados lidos do Habit Tracker');
    if (r === 'indisponivel') baixarArquivo(arquivo);
  }

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    const texto = await arquivo.text();
    const v = await validarBackup(texto);
    if (!v.ok) {
      setMensagem(v.erro);
      return;
    }
    setMensagem('');
    setPrevia({ texto, resumo: v.resumo });
  }

  async function restaurarSubstituindoBanco() {
    if (!previa) return;
    const v = await validarBackup(previa.texto);
    if (!v.ok) return;
    try {
      db.close();
      await Dexie.delete(db.name);
      const r = await abrirBancoComSeguranca(db, __APP_VERSION__, dataLogica(new Date(), 0));
      if (!r.ok) throw new Error(r.erro);
      await aplicarBackup(db, v.arquivo);
      aoRecuperar();
    } catch {
      setMensagem('Não consegui restaurar. Seus dados não foram alterados além do que já estava com problema.');
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-[480px] flex-col gap-4 overflow-y-auto bg-fundo px-5" style={{ paddingTop: 'var(--topo-seguro)', paddingBottom: 32 }}>
      <h1 className="text-[24px] font-bold leading-tight">Não consegui abrir seus dados</h1>
      <p className="text-[15px]">{erro}</p>
      <p className="text-[14px] text-texto2">
        O app <strong>não vai começar do zero</strong> sem você saber. Nada foi apagado por isso.
      </p>

      <div className="flex flex-col gap-2">
        <button type="button" onClick={aoTentarDeNovo} className={`${botao} bg-verde text-white`}>
          Tentar de novo
        </button>
        {temLegado && (
          <button type="button" onClick={() => void salvarLegado()} className={`${botao} border-[1.5px] border-verde-texto bg-cartao text-verde-texto`}>
            Salvar os dados que consegui ler
          </button>
        )}
        {!versaoNova && (
          <button type="button" onClick={() => seletor.current?.click()} className={`${botao} border-[1.5px] border-verde-texto bg-cartao text-verde-texto`}>
            Já tenho backup? Restaurar
          </button>
        )}
        <input
          ref={seletor}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            void escolher(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {mensagem && (
        <p role="alert" className="rounded-xl border border-laranja bg-laranja-claro p-3 text-[14px] text-laranja-texto">
          {mensagem}
        </p>
      )}

      {previa && (
        <div role="alertdialog" aria-label="Confirmar restauração" className="rounded-2xl border border-borda bg-cartao p-4 text-[14px]">
          <div className="text-[16px] font-bold">Restaurar este backup?</div>
          <p className="mt-2">
            {previa.resumo.habitos} hábitos · {previa.resumo.registros} registros. O banco que não abre será
            substituído por este backup.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setPrevia(null)} className={`${botao} flex-1 border-[1.5px] border-cinza-anel bg-cartao text-texto`}>
              Cancelar
            </button>
            <button type="button" onClick={() => void restaurarSubstituindoBanco()} className={`${botao} flex-1 bg-verde text-white`}>
              Restaurar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
