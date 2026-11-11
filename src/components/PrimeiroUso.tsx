import { useState } from 'react';
import { db } from '../database/db';
import { operacoes } from '../database/operacoes';
import { dataLogica } from '../services/datas';
import { aplicarImportacao } from '../services/importacao';
import { MODELOS_PRIMEIRO_USO } from '../services/modelos';
import { descreverVersao } from '../services/habitos';
import { ImportarHabitos } from './ImportarHabitos';

interface Props {
  irParaHabitos: () => void;
  irParaAjustes: () => void;
}

/** RF-34: tela de primeiro uso (nenhum hábito ainda). Modelos genéricos, criar do zero, importar, restaurar. */
export function PrimeiroUso({ irParaHabitos, irParaAjustes }: Props) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  function alternar(nome: string) {
    setMarcados((a) => {
      const n = new Set(a);
      if (n.has(nome)) n.delete(nome);
      else n.add(nome);
      return n;
    });
  }

  async function criar() {
    setOcupado(true);
    setErro('');
    try {
      const config = await operacoes.lerConfig();
      const hoje = dataLogica(new Date(), config.inicioDoDiaHora);
      await aplicarImportacao(
        db,
        operacoes,
        MODELOS_PRIMEIRO_USO.filter((m) => marcados.has(m.nome)),
        __APP_VERSION__,
        hoje,
      );
    } catch {
      setErro('Não consegui criar os hábitos. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="py-4">
      <h2 className="px-1 text-[18px] font-bold">Vamos começar</h2>
      <p className="mt-1 px-1 text-[14px] text-texto2">
        Marque modelos para criar de uma vez (você pode mudar tudo depois), ou comece do zero.
      </p>

      <ul className="mt-3 flex flex-col">
        {MODELOS_PRIMEIRO_USO.map((m) => {
          const ligado = marcados.has(m.nome);
          return (
            <li key={m.nome}>
              <label className="flex min-h-[56px] items-center justify-between gap-3 border-t border-linha px-1 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[16px] font-semibold">{m.nome}</span>
                  <span className="truncate text-[13px] text-texto2">
                    {descreverVersao({ ...m, id: '', habitoId: '', vigenteDesde: '' })}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={ligado}
                  onChange={() => alternar(m.nome)}
                  aria-label={`Criar o hábito ${m.nome}`}
                  className="size-6 shrink-0 accent-verde"
                />
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-col items-stretch gap-2 px-1">
        <button
          type="button"
          disabled={marcados.size === 0 || ocupado}
          onClick={() => void criar()}
          className={`h-12 rounded-full border-0 text-[15px] font-bold text-white ${marcados.size === 0 ? 'bg-cinza-anel' : 'bg-verde'}`}
        >
          {marcados.size === 0
            ? 'Marque os modelos que quiser'
            : `Criar ${marcados.size} ${marcados.size === 1 ? 'hábito' : 'hábitos'}`}
        </button>
        {erro && (
          <p role="alert" className="rounded-xl border border-laranja bg-laranja-claro p-2.5 text-[14px] text-laranja-texto">
            {erro}
          </p>
        )}
        <button
          type="button"
          onClick={irParaHabitos}
          className="h-12 rounded-full border-[1.5px] border-verde-texto bg-cartao text-[15px] font-semibold text-verde-texto"
        >
          Criar do zero
        </button>
        <ImportarHabitos
          rotulo="Importar meus hábitos"
          className="h-12 w-full rounded-full border-[1.5px] border-verde-texto bg-cartao text-[15px] font-semibold text-verde-texto"
        />
        <button
          type="button"
          onClick={irParaAjustes}
          className="h-11 rounded-full border-0 bg-transparent text-[14px] font-semibold text-verde-texto underline"
        >
          Já tenho backup? Restaurar
        </button>
      </div>
    </div>
  );
}
