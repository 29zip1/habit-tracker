import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, History, Upload } from 'lucide-react';
import { db } from '../database/db';
import { listarCopias, ROTULO_MOTIVO } from '../database/copias';
import { restaurarComSeguranca } from '../database/restauracao';
import { operacoes } from '../database/operacoes';
import { useArquivosBackup } from '../hooks/useArquivosBackup';
import { useLive } from '../hooks/useLive';
import { diasDesde } from '../services/avisoBackup';
import { validarBackup, type ResumoBackup } from '../services/backup';
import { baixarArquivo, compartilharArquivo } from '../services/compartilhar';
import { dataLogica } from '../services/datas';
import { dataCurta } from '../services/textos';
import { CONFIG_PADRAO, type Copia } from '../types';

const botao = 'min-h-[48px] rounded-full px-5 text-[15px] font-semibold active:opacity-80';
const botaoPrincipal = `${botao} bg-verde text-white`;
const botaoContorno = `${botao} border-[1.5px] border-verde-texto bg-cartao text-verde-texto`;
const cartao = 'rounded-2xl border border-borda bg-cartao p-4';

function dataHoraBr(iso: string): string {
  const d = new Date(iso);
  return `${dataCurta(dataLogica(d, 0))}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Previa {
  origem: 'arquivo' | 'copia';
  rotulo: string;
  texto: string;
  resumo: ResumoBackup;
}

/** RF-61, RF-64, RF-69: salvar backup, exportar CSV, restaurar e cópias automáticas. */
export function SecaoBackup() {
  const arquivos = useArquivosBackup();
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const copias = useLive(() => listarCopias(db), [], [] as Copia[]);
  const seletor = useRef<HTMLInputElement>(null);

  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [verCopias, setVerCopias] = useState(false);

  async function salvarBackup() {
    if (!arquivos) return;
    setErro('');
    const r = await compartilharArquivo(arquivos.backup, 'Backup do Habit Tracker');
    if (r === 'indisponivel') {
      baixarArquivo(arquivos.backup);
    }
    if (r === 'compartilhado' || r === 'indisponivel') {
      // O iPhone não avisa se você de fato salvou; marcamos quando o compartilhamento termina sem cancelar.
      await operacoes.salvarConfig({ ultimoBackup: new Date().toISOString() });
      setMensagem(
        r === 'compartilhado'
          ? 'Backup enviado para o compartilhamento. Confira em Arquivos se ele foi salvo.'
          : 'Backup baixado.',
      );
    } else if (r === 'cancelado') {
      setMensagem('Você cancelou. O backup não foi salvo.');
    } else {
      setErro('Não foi possível abrir o compartilhamento. Tente de novo.');
    }
  }

  async function exportarCsv() {
    if (!arquivos) return;
    setErro('');
    const r = await compartilharArquivo(arquivos.csv, 'Registros do Habit Tracker');
    if (r === 'indisponivel') baixarArquivo(arquivos.csv);
    setMensagem(
      r === 'cancelado' ? 'Você cancelou a exportação.' : r === 'erro' ? '' : 'Planilha enviada para o compartilhamento.',
    );
    if (r === 'erro') setErro('Não foi possível abrir o compartilhamento. Tente de novo.');
  }

  async function exportarCopia(c: Copia) {
    const arquivo = new File([c.conteudo], `habit-tracker-copia-${c.data}.json`, { type: 'application/json' });
    const r = await compartilharArquivo(arquivo, 'Cópia do Habit Tracker');
    if (r === 'indisponivel') baixarArquivo(arquivo);
  }

  async function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro('');
    setMensagem('');
    const texto = await arquivo.text();
    const v = await validarBackup(texto);
    if (!v.ok) {
      setErro(v.erro);
      return;
    }
    setPrevia({ origem: 'arquivo', rotulo: arquivo.name, texto, resumo: v.resumo });
  }

  async function verPreviaDaCopia(c: Copia) {
    setErro('');
    const v = await validarBackup(c.conteudo);
    if (!v.ok) {
      setErro(`Esta cópia não passou na verificação: ${v.erro}`);
      return;
    }
    setPrevia({ origem: 'copia', rotulo: `${ROTULO_MOTIVO[c.motivo]} · ${dataHoraBr(c.criadaEm)}`, texto: c.conteudo, resumo: v.resumo });
  }

  async function confirmarRestauracao() {
    if (!previa) return;
    setRestaurando(true);
    const hoje = dataLogica(new Date(), (await operacoes.lerConfig()).inicioDoDiaHora);
    const r = await restaurarComSeguranca(db, previa.texto, __APP_VERSION__, hoje);
    setRestaurando(false);
    setPrevia(null);
    if (r.ok) {
      setMensagem(
        `Restaurado: ${r.resumo.habitos} hábitos e ${r.resumo.registros} registros.${
          r.copiaDeSegurancaCriada ? ' Seus dados de antes ficaram guardados em Cópias automáticas.' : ''
        }`,
      );
    } else {
      setErro(r.erro);
    }
  }

  const ultimo = config.ultimoBackup;
  const textoUltimo = ultimo
    ? `Último backup: ${dataHoraBr(ultimo)} (há ${diasDesde(ultimo, new Date())} dia(s))`
    : 'Você ainda não salvou nenhum backup.';

  return (
    <>
      <section className={cartao} aria-labelledby="t-bk">
        <h2 id="t-bk" className="text-[16px] font-semibold">
          Backup e restauração
        </h2>
        <p className="mt-1 text-[14px] text-texto2">
          Salve o backup no <strong>iCloud Drive</strong> (Arquivos). É a única proteção contra perder tudo se o
          iPhone apagar os dados do app ou se você apagar o ícone.
        </p>
        <p className="mt-2 text-[14px]">
          <strong>{textoUltimo}</strong>
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={botaoPrincipal} disabled={!arquivos} onClick={() => void salvarBackup()}>
            <Download className="mr-1 inline" size={16} aria-hidden="true" />
            Salvar backup
          </button>
          <button type="button" className={botaoContorno} disabled={!arquivos} onClick={() => void exportarCsv()}>
            <FileSpreadsheet className="mr-1 inline" size={16} aria-hidden="true" />
            Exportar planilha (CSV)
          </button>
        </div>

        <div className="mt-2">
          <button type="button" className={botaoContorno} onClick={() => seletor.current?.click()}>
            <Upload className="mr-1 inline" size={16} aria-hidden="true" />
            Restaurar de um arquivo
          </button>
          <input
            ref={seletor}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              void escolherArquivo(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        <label className="mt-4 flex min-h-11 items-center justify-between gap-3 text-[15px]">
          <span>Avisar quando o backup passar de</span>
          <select
            aria-label="Dias para o aviso de backup"
            value={config.avisoBackupDias}
            onChange={(e) => void operacoes.salvarConfig({ avisoBackupDias: Number(e.target.value) })}
            className="h-11 rounded-xl border-[1.5px] border-cinza-anel bg-cartao px-3 text-[15px] text-texto"
          >
            {[3, 7, 14, 30].map((n) => (
              <option key={n} value={n}>
                {n} dias
              </option>
            ))}
          </select>
        </label>

        <label className="mt-2 flex min-h-11 items-center justify-between gap-3 text-[15px]">
          <span>
            Manter o aviso na tela Hoje até eu fazer o backup
            <span className="block text-[13px] text-texto2">
              Sem o botão &quot;Depois&quot;: a faixa só some quando o backup é salvo.
            </span>
          </span>
          <input
            type="checkbox"
            checked={config.avisoBackupFixo === true}
            onChange={(e) => void operacoes.salvarConfig({ avisoBackupFixo: e.target.checked })}
            className="size-6 shrink-0 accent-verde"
          />
        </label>

        <p className="mt-3 text-[13px] text-texto2">
          Dica: crie no app <strong>Lembretes</strong> do iPhone um lembrete que se repete toda semana:
          &quot;Salvar backup do Habit Tracker&quot;. O app não consegue criar esse lembrete sozinho.
        </p>

        {mensagem && <p className="mt-3 text-[14px]">{mensagem}</p>}
        {erro && (
          <p role="alert" className="mt-3 rounded-xl border border-laranja bg-laranja-claro p-3 text-[14px] text-laranja-texto">
            {erro}
          </p>
        )}
      </section>

      <section className={cartao} aria-labelledby="t-cp">
        <h2 id="t-cp" className="text-[16px] font-semibold">
          Cópias automáticas
        </h2>
        <p className="mt-1 text-[14px] text-texto2">
          Estas cópias ficam <strong>neste iPhone, junto com seus dados</strong>. Elas <strong>não substituem</strong> o
          backup em arquivo (iCloud/Arquivos). Servem para desfazer erros: uma por dia, as últimas 14, e uma antes de
          restaurar ou atualizar.
        </p>
        <button
          type="button"
          className={`${botaoContorno} mt-3`}
          aria-expanded={verCopias}
          onClick={() => setVerCopias((v) => !v)}
        >
          <History className="mr-1 inline" size={16} aria-hidden="true" />
          {verCopias ? 'Ocultar cópias' : `Ver cópias (${copias.length})`}
        </button>
        {verCopias && (
          <ul className="mt-3 flex list-none flex-col p-0">
            {copias.length === 0 && <li className="text-[14px] text-texto2">Nenhuma cópia ainda.</li>}
            {copias.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 border-t border-linha py-3">
                <div>
                  <div className="text-[15px] font-semibold">{dataHoraBr(c.criadaEm)}</div>
                  <div className="text-[13px] text-texto2">
                    {ROTULO_MOTIVO[c.motivo]} · {c.habitos} hábitos · {c.registros} registros
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={`${botaoContorno} !min-h-11 !px-4 !text-[14px]`} onClick={() => void verPreviaDaCopia(c)}>
                    Restaurar
                  </button>
                  <button type="button" className={`${botaoContorno} !min-h-11 !px-4 !text-[14px]`} onClick={() => void exportarCopia(c)}>
                    Exportar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {previa && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-[rgba(27,31,29,0.45)]">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmar restauração"
            className="mx-auto flex max-h-full w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-3xl bg-cartao px-5 pt-5"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
          >
            <div className="text-[18px] font-bold">Restaurar este backup?</div>
            <div className="rounded-2xl bg-verde-claro p-3 text-[14px]">
              <div className="font-semibold">{previa.rotulo}</div>
              <div>
                Feito em {dataHoraBr(previa.resumo.criadoEm)} · app {previa.resumo.versaoApp}
              </div>
              <div>
                {previa.resumo.habitos} hábitos · {previa.resumo.registros} registros ·{' '}
                {previa.resumo.marcacoes} marcações
              </div>
              <div>
                Período:{' '}
                {previa.resumo.periodo
                  ? `${previa.resumo.periodo.de.split('-').reverse().join('/')} a ${previa.resumo.periodo.ate.split('-').reverse().join('/')}`
                  : 'sem registros'}
              </div>
            </div>
            <p className="text-[14px]">
              Isso <strong>substitui tudo</strong> que está no app agora pelo conteúdo deste backup. Antes, o app
              guarda uma cópia dos seus dados atuais em Cópias automáticas, para você poder voltar atrás.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={restaurando}
                onClick={() => setPrevia(null)}
                className="h-12 flex-1 rounded-full border-[1.5px] border-cinza-anel bg-cartao text-[15px] font-semibold text-texto"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={restaurando}
                onClick={() => void confirmarRestauracao()}
                className="h-12 flex-1 rounded-full border-0 bg-verde text-[15px] font-bold text-white"
              >
                {restaurando ? 'Restaurando…' : 'Restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
