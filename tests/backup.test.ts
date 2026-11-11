import { afterEach, describe, expect, it, vi } from 'vitest';
import { listarCopias } from '../src/database/copias';
import { restaurarComSeguranca } from '../src/database/restauracao';
import {
  aplicarBackup,
  gerarBackup,
  lerDadosDoBanco,
  nomeArquivoBackup,
  serializarBackup,
  validarBackup,
} from '../src/services/backup';
import { fecharTodos, HOJE, novoBancoDeTeste, popular } from './apoioBanco';

afterEach(fecharTodos);

async function backupDeTeste() {
  const a = novoBancoDeTeste();
  await popular(a.ops);
  const arquivo = await gerarBackup(a.db, '9.9.9', new Date(2026, 10, 10, 19, 25));
  return { a, arquivo, texto: serializarBackup(arquivo) };
}

/** Altera o conteúdo do JSON sem recalcular a verificação, como se o arquivo tivesse sido mexido. */
function adulterar(texto: string, mexer: (o: any) => void): string {
  const o = JSON.parse(texto);
  mexer(o);
  return JSON.stringify(o);
}

describe('T-61 · gerar o arquivo de backup', () => {
  it('traz hábitos, versões, registros, marcações, dias, configurações e a versão do formato', async () => {
    const { arquivo } = await backupDeTeste();
    expect(arquivo.formato).toBe('habit-tracker-backup');
    expect(arquivo.versaoBackup).toBe(1);
    expect(arquivo.versaoApp).toBe('9.9.9');
    expect(arquivo.contagens).toEqual({ habitos: 3, versoes: 3, registros: 3, marcacoes: 2, dias: 1 });
    expect(arquivo.dados.config?.inicioSemana).toBe(0);
    expect(arquivo.integridade.startsWith('sha256:')).toBe(true);
  });

  it('T-62c: a opção "aviso fixo" vai no backup, e valor que não é verdadeiro/falso é recusado', async () => {
    const { arquivo } = await backupDeTeste();
    const comFixo = { ...arquivo, dados: { ...arquivo.dados, config: { ...arquivo.dados.config!, avisoBackupFixo: true } } };
    expect(JSON.parse(serializarBackup(comFixo)).dados.config.avisoBackupFixo).toBe(true);
    const ruim = adulterar(serializarBackup(arquivo), (o) => {
      o.dados.config.avisoBackupFixo = 'sim';
    });
    expect((await validarBackup(ruim)).ok).toBe(false);
  });

  it('o nome do arquivo leva a data e a hora', () => {
    expect(nomeArquivoBackup(new Date(2026, 10, 10, 19, 25))).toBe('habit-tracker-backup-2026-11-10-1925.json');
    expect(nomeArquivoBackup(new Date(2026, 0, 5, 7, 3), 'csv', 'habit-tracker-registros')).toBe(
      'habit-tracker-registros-2026-01-05-0703.csv',
    );
  });
});

describe('T-64 · ida e volta (salvar e restaurar)', () => {
  it('um backup válido é aceito e mostra o resumo (hábitos, registros, período)', async () => {
    const { texto } = await backupDeTeste();
    const r = await validarBackup(texto);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.resumo).toMatchObject({ habitos: 3, registros: 3, marcacoes: 2, versaoApp: '9.9.9' });
      expect(r.resumo.periodo).toEqual({ de: '2026-11-09', ate: '2026-11-10' });
    }
  });

  it('restaurar num banco vazio devolve exatamente os mesmos dados', async () => {
    const { a, texto } = await backupDeTeste();
    const b = novoBancoDeTeste();
    const r = await restaurarComSeguranca(b.db, texto, '9.9.9', HOJE);
    expect(r.ok).toBe(true);
    const originais = await lerDadosDoBanco(a.db);
    const restaurados = await lerDadosDoBanco(b.db);
    // o "último backup" é o único campo que muda, de propósito
    expect({ ...restaurados, config: { ...restaurados.config, ultimoBackup: undefined } }).toEqual({
      ...originais,
      config: { ...originais.config, ultimoBackup: undefined },
    });
  });

  it('restaurar SUBSTITUI tudo e não duplica, mesmo restaurando duas vezes', async () => {
    const { texto } = await backupDeTeste();
    const b = novoBancoDeTeste();
    await b.ops.criarHabito({
      nome: 'Outro', icone: 'x', cor: '#000', categoria: 'g', tipo: 'conclusao', unidade: '', meta: 1, vigenteDesde: '2026-01-01',
    });
    await restaurarComSeguranca(b.db, texto, '9.9.9', HOJE);
    await restaurarComSeguranca(b.db, texto, '9.9.9', HOJE);
    expect(await b.db.habitos.count()).toBe(3); // "Outro" saiu, nada duplicou
    expect(await b.db.registros.count()).toBe(3);
    expect(await b.db.marcacoes.count()).toBe(2);
  });

  it('o último backup passa a ser a data do arquivo restaurado', async () => {
    const { arquivo, texto } = await backupDeTeste();
    const b = novoBancoDeTeste();
    await restaurarComSeguranca(b.db, texto, '9.9.9', HOJE);
    expect((await b.ops.lerConfig()).ultimoBackup).toBe(arquivo.criadoEm);
  });
});

describe('T-64b · arquivo inválido é recusado e nada muda', () => {
  const casos: [string, (t: string) => string][] = [
    ['texto qualquer', () => 'isto não é json'],
    ['JSON de outro tipo', () => JSON.stringify({ ola: 1 })],
    ['arquivo cortado ao meio', (t) => t.slice(0, Math.floor(t.length / 2))],
    ['versão de backup mais nova', (t) => adulterar(t, (o) => (o.versaoBackup = 99))],
    ['quantidades que não batem', (t) => adulterar(t, (o) => (o.contagens.registros = 99))],
    ['registro removido (contagem confere, mas integridade não)', (t) =>
      adulterar(t, (o) => { o.dados.registros.pop(); o.contagens.registros = o.dados.registros.length; })],
    ['valor alterado à mão', (t) => adulterar(t, (o) => (o.dados.registros[0].valor = 9999))],
    ['sem verificação de integridade', (t) => adulterar(t, (o) => (o.integridade = ''))],
    ['data inválida', (t) => adulterar(t, (o) => (o.dados.registros[0].data = '2026-02-30'))],
    ['valor negativo', (t) => adulterar(t, (o) => (o.dados.registros[0].valor = -5))],
    ['horário inválido', (t) => adulterar(t, (o) => (o.dados.registros[0].horario = '25:99'))],
    ['id repetido', (t) => adulterar(t, (o) => (o.dados.registros[1].id = o.dados.registros[0].id))],
    ['registro de hábito inexistente', (t) => adulterar(t, (o) => (o.dados.registros[0].habitoId = 'nao-existe'))],
    ['lista de hábitos faltando', (t) => adulterar(t, (o) => delete o.dados.habitos)],
    ['marcação duplicada', (t) =>
      adulterar(t, (o) => { o.dados.marcacoes.push({ ...o.dados.marcacoes[0], id: 'outra' }); o.contagens.marcacoes += 1; })],
  ];

  it.each(casos)('recusa: %s', async (_nome, deformar) => {
    const { texto } = await backupDeTeste();
    const r = await validarBackup(deformar(texto));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.length).toBeGreaterThan(10);
  });

  it('restaurar um arquivo inválido não altera nem um dado e não cria cópia', async () => {
    const { texto } = await backupDeTeste();
    const b = novoBancoDeTeste();
    await popular(b.ops);
    const antes = await lerDadosDoBanco(b.db);
    const r = await restaurarComSeguranca(b.db, adulterar(texto, (o) => (o.dados.registros[0].valor = 7)), '9.9.9', HOJE);
    expect(r.ok).toBe(false);
    expect(await lerDadosDoBanco(b.db)).toEqual(antes);
    expect(await listarCopias(b.db)).toHaveLength(0);
  });
});

describe('T-64 e T-65 · cópia de segurança antes de restaurar', () => {
  it('guarda o estado atual ANTES de substituir, e dá para voltar atrás', async () => {
    const { texto } = await backupDeTeste();
    const b = await (async () => {
      const x = novoBancoDeTeste();
      await x.ops.criarHabito({
        nome: 'Só meu', icone: 'x', cor: '#000', categoria: 'g', tipo: 'conclusao', unidade: '', meta: 1, vigenteDesde: '2026-01-01',
      });
      return x;
    })();
    const antes = await lerDadosDoBanco(b.db);

    const r = await restaurarComSeguranca(b.db, texto, '9.9.9', HOJE);
    expect(r.ok && r.copiaDeSegurancaCriada).toBe(true);
    expect((await b.db.habitos.toArray()).map((h) => h.nome)).not.toContain('Só meu');

    const copias = await listarCopias(b.db);
    expect(copias).toHaveLength(1);
    expect(copias[0].motivo).toBe('antes-restaurar');
    expect(copias[0].protegidaAte).toBeTruthy();

    const volta = await restaurarComSeguranca(b.db, copias[0].conteudo, '9.9.9', HOJE);
    expect(volta.ok).toBe(true);
    expect((await b.db.habitos.toArray()).map((h) => h.nome)).toEqual(['Só meu']);
    const depois = await lerDadosDoBanco(b.db);
    expect(depois.habitos).toEqual(antes.habitos);
  });

  it('restaurar num banco vazio não precisa de cópia de segurança', async () => {
    const { texto } = await backupDeTeste();
    const b = novoBancoDeTeste();
    const r = await restaurarComSeguranca(b.db, texto, '9.9.9', HOJE);
    expect(r.ok && r.copiaDeSegurancaCriada).toBe(false);
  });
});

describe('restauração tudo-ou-nada', () => {
  it('se a gravação falha no meio, o banco continua exatamente como estava', async () => {
    const { texto } = await backupDeTeste();
    const b = novoBancoDeTeste();
    await b.ops.criarHabito({
      nome: 'Intacto', icone: 'x', cor: '#000', categoria: 'g', tipo: 'conclusao', unidade: '', meta: 1, vigenteDesde: '2026-01-01',
    });
    const antes = await lerDadosDoBanco(b.db);

    const proto = Object.getPrototypeOf(b.db.dias);
    const original = proto.bulkAdd;
    const espiao = vi.spyOn(proto, 'bulkAdd').mockImplementation(function (this: { name: string }, ...args: unknown[]) {
      if (this.name === 'dias') return Promise.reject(new Error('falha simulada'));
      return original.apply(this, args);
    });

    const validacao = await validarBackup(texto);
    expect(validacao.ok).toBe(true);
    await expect(aplicarBackup(b.db, (validacao as any).arquivo)).rejects.toThrow();
    espiao.mockRestore();

    expect(await lerDadosDoBanco(b.db)).toEqual(antes); // nada pela metade
  });
});
