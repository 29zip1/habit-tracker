import { useRef, useState } from 'react';
import { db } from '../database/db';
import { operacoes } from '../database/operacoes';
import { dataLogica } from '../services/datas';
import {
  aplicarImportacao,
  lerArquivoHabitos,
  preverImportacao,
  type PreviaImportacao,
} from '../services/importacao';

interface Props {
  rotulo?: string;
  className?: string;
}

/** RF-34: escolher um arquivo de hábitos, ver a prévia e confirmar. Só acrescenta hábitos. */
export function ImportarHabitos({ rotulo = 'Importar de um arquivo', className }: Props) {
  const seletor = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<(PreviaImportacao & { arquivo: string }) | null>(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function escolher(arquivo: File | undefined) {
    setErro('');
    setMensagem('');
    setPrevia(null);
    if (!arquivo) return;
    try {
      const texto = await arquivo.text();
      const r = lerArquivoHabitos(texto);
      if (!r.ok) {
        setErro(`${r.erro} Nada foi alterado.`);
        return;
      }
      const p = await preverImportacao(db, r.habitos);
      if (p.novos.length === 0) {
        setMensagem('Todos os hábitos deste arquivo já existem aqui. Nada foi alterado.');
        return;
      }
      setPrevia({ ...p, arquivo: texto });
    } catch {
      setErro('Não consegui ler este arquivo. Nada foi alterado.');
    }
  }

  async function confirmar() {
    if (!previa) return;
    const r = lerArquivoHabitos(previa.arquivo);
    if (!r.ok) return;
    setOcupado(true);
    try {
      const config = await operacoes.lerConfig();
      const hoje = dataLogica(new Date(), config.inicioDoDiaHora);
      const res = await aplicarImportacao(db, operacoes, r.habitos, __APP_VERSION__, hoje);
      setPrevia(null);
      setMensagem(
        `${res.criados} ${res.criados === 1 ? 'hábito criado' : 'hábitos criados'}` +
          (res.puladosJaExistem > 0
          ? ` e ${res.puladosJaExistem} ${res.puladosJaExistem === 1 ? 'pulado (já existia)' : 'pulados (já existiam)'}`
          : '') +
          '. Veja na aba Hábitos.',
      );
    } catch {
      setErro('Não consegui importar. Nada foi alterado.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => seletor.current?.click()}
        className={
          className ??
          'min-h-[48px] rounded-full border-[1.5px] border-verde-texto bg-cartao px-5 text-[15px] font-semibold text-verde-texto'
        }
      >
        {rotulo}
      </button>
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

      {previa && (
        <div role="alertdialog" aria-label="Confirmar importação" className="mt-3 rounded-xl border border-borda bg-cartao p-3 text-left text-[14px]">
          <p className="font-semibold">
            Vou criar {previa.novos.length} {previa.novos.length === 1 ? 'hábito' : 'hábitos'}:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {previa.novos.map((h) => (
              <li key={h.nome}>{h.nome}</li>
            ))}
          </ul>
          {previa.jaExistem.length > 0 && (
            <p className="mt-2 text-texto2">
              {previa.jaExistem.length} já {previa.jaExistem.length === 1 ? 'existe' : 'existem'} aqui e{' '}
              {previa.jaExistem.length === 1 ? 'será pulado' : 'serão pulados'}.
            </p>
          )}
          <p className="mt-2 text-texto2">Seus hábitos e registros atuais não mudam. Uma cópia automática é guardada antes.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPrevia(null)}
              className="h-11 flex-1 rounded-full border-[1.5px] border-cinza-anel bg-cartao text-[15px] font-semibold text-texto"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void confirmar()}
              className="h-11 flex-[1.4] rounded-full border-0 bg-verde text-[15px] font-bold text-white"
            >
              Importar
            </button>
          </div>
        </div>
      )}
      {mensagem && <p className="mt-3 text-[14px]">{mensagem}</p>}
      {erro && (
        <p role="alert" className="mt-3 rounded-xl border border-laranja bg-laranja-claro p-3 text-[14px] text-laranja-texto">
          {erro}
        </p>
      )}
    </div>
  );
}
