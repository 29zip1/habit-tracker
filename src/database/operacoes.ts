// Operações no banco. Cada função grava na hora (RF-60): não existe "salvar".
// Nenhuma função aqui apaga dados sozinha (RF-66). As que removem registros
// devolvem o que removeram, para a tela poder oferecer "Desfazer" (RF-15).
import type {
  ConfigApp,
  DataLocal,
  Dia,
  Frequencia,
  Habito,
  Marcacao,
  OrigemRegistro,
  Registro,
  TipoHabito,
  VersaoHabito,
} from '../types';
import { CONFIG_PADRAO, VERSAO_FORMATO_BANCO } from '../types';
import { entraNoPercentualPadrao, type EntradaDia, type HabitoCompleto } from '../services/calculos';
import {
  diasDaSemana,
  ehDataValida,
  formatarHorario,
  intervaloDeDatas,
  somarDias,
} from '../services/datas';
import { BancoHabitos, db as bancoPadrao } from './db';

const agora = () => new Date().toISOString();
const novoId = () => crypto.randomUUID();

export interface DadosVersao {
  tipo: TipoHabito;
  unidade: string;
  meta: number;
  blocos?: number[];
  frequencia?: Frequencia;
  entraNoPercentual?: boolean;
  passoAjuste?: number;
}

export interface NovoHabito extends DadosVersao {
  nome: string;
  descricao?: string;
  icone: string;
  cor: string;
  categoria: string;
  dataInicial?: DataLocal;
  dataFinal?: DataLocal;
  vigenteDesde: DataLocal;
  exemplo?: boolean;
}

export function validarVersao(d: DadosVersao): void {
  if (!(d.meta > 0) || !Number.isFinite(d.meta)) throw new Error('A meta precisa ser maior que zero.');
  if (d.tipo === 'semanal' && (!Number.isInteger(d.meta) || d.meta > 7)) {
    throw new Error('Meta semanal deve ser um número inteiro de 1 a 7.');
  }
  const blocos = d.blocos ?? [];
  if (blocos.length > 3) throw new Error('No máximo 3 blocos.');
  if (blocos.some((b) => !(b > 0) || !Number.isFinite(b))) {
    throw new Error('Os blocos precisam ser números maiores que zero.');
  }
  if ((d.tipo === 'quantidade' || d.tipo === 'limite') && blocos.length < 1) {
    throw new Error('Hábitos de quantidade e de limite precisam de pelo menos 1 bloco.');
  }
  if (d.frequencia?.tipo === 'dias') {
    const dias = d.frequencia.dias;
    if (dias.length === 0 || dias.some((x) => !Number.isInteger(x) || x < 0 || x > 6)) {
      throw new Error('Dias da semana inválidos.');
    }
  }
}

function montarVersao(habitoId: string, vigenteDesde: DataLocal, d: DadosVersao): VersaoHabito {
  if (!ehDataValida(vigenteDesde)) throw new Error('Data de vigência inválida.');
  validarVersao(d);
  return {
    id: novoId(),
    habitoId,
    vigenteDesde,
    tipo: d.tipo,
    unidade: d.unidade,
    meta: d.meta,
    blocos: d.tipo === 'quantidade' || d.tipo === 'limite' ? (d.blocos ?? []) : [],
    frequencia: d.tipo === 'semanal' ? { tipo: 'todos' } : (d.frequencia ?? { tipo: 'todos' }),
    entraNoPercentual: d.entraNoPercentual ?? entraNoPercentualPadrao(d.tipo),
    passoAjuste: d.passoAjuste ?? 1,
  };
}

export class Operacoes {
  constructor(private readonly db: BancoHabitos = bancoPadrao) {}

  // ----- Metadados -----

  /** Grava o marcador de existência e a versão do formato (RF-63, RF-66). */
  async garantirMeta(): Promise<void> {
    const existente = await this.db.meta.get('criadoEm');
    if (!existente) await this.db.meta.put({ chave: 'criadoEm', valor: agora() });
    await this.db.meta.put({ chave: 'versaoFormato', valor: VERSAO_FORMATO_BANCO });
  }

  // ----- Configurações -----

  async lerConfig(): Promise<ConfigApp> {
    return (await this.db.config.get('config')) ?? { ...CONFIG_PADRAO };
  }

  async salvarConfig(parcial: Partial<Omit<ConfigApp, 'id'>>): Promise<ConfigApp> {
    if (parcial.inicioDoDiaHora !== undefined && !(parcial.inicioDoDiaHora >= 0 && parcial.inicioDoDiaHora <= 5)) {
      throw new Error('O início do dia vai de 00:00 a 05:00.');
    }
    if (parcial.inicioSemana !== undefined && !(parcial.inicioSemana >= 0 && parcial.inicioSemana <= 6)) {
      throw new Error('Início da semana inválido.');
    }
    const novo = { ...(await this.lerConfig()), ...parcial, id: 'config' as const };
    await this.db.config.put(novo);
    return novo;
  }

  // ----- Hábitos e versões -----

  async criarHabito(d: NovoHabito): Promise<{ habito: Habito; versao: VersaoHabito }> {
    if (!d.nome.trim()) throw new Error('O hábito precisa de um nome.');
    const versao = montarVersao('', d.vigenteDesde, d);
    return this.db.transaction('rw', this.db.habitos, this.db.versoes, async () => {
      const todos = await this.db.habitos.toArray();
      const ordem = todos.reduce((m, h) => Math.max(m, h.ordem), -1) + 1;
      const t = agora();
      const habito: Habito = {
        id: novoId(),
        nome: d.nome.trim(),
        descricao: d.descricao,
        icone: d.icone,
        cor: d.cor,
        categoria: d.categoria,
        ordem,
        status: 'ativo',
        dataInicial: d.dataInicial,
        dataFinal: d.dataFinal,
        exemplo: d.exemplo,
        criadoEm: t,
        editadoEm: t,
      };
      const v = { ...versao, habitoId: habito.id };
      await this.db.habitos.add(habito);
      await this.db.versoes.add(v);
      return { habito, versao: v };
    });
  }

  /**
   * RF-31 / RF-C7: mudar meta, blocos, unidade ou frequência cria uma NOVA versão
   * a partir de uma data. Versões antigas nunca são alteradas, então o histórico
   * mantém a meta da época. Se já existir versão com a mesma data, ela é substituída.
   */
  async adicionarVersao(
    habitoId: string,
    vigenteDesde: DataLocal,
    mudancas: Partial<DadosVersao>,
  ): Promise<VersaoHabito> {
    return this.db.transaction('rw', this.db.versoes, this.db.habitos, async () => {
      const versoes = await this.db.versoes.where('habitoId').equals(habitoId).toArray();
      const base = versoes
        .filter((v) => v.vigenteDesde <= vigenteDesde)
        .sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? -1 : 1))
        .pop() ?? versoes.sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? -1 : 1))[0];
      if (!base) throw new Error('Hábito não encontrado.');
      const dados: DadosVersao = { ...base, ...mudancas };
      const nova = montarVersao(habitoId, vigenteDesde, dados);
      const mesmaData = versoes.find((v) => v.vigenteDesde === vigenteDesde);
      if (mesmaData) nova.id = mesmaData.id;
      await this.db.versoes.put(nova);
      await this.db.habitos.update(habitoId, { editadoEm: agora() });
      return nova;
    });
  }

  async editarHabito(
    id: string,
    campos: Partial<Pick<Habito, 'nome' | 'descricao' | 'icone' | 'cor' | 'categoria' | 'dataInicial' | 'dataFinal' | 'ordem'>>,
  ): Promise<void> {
    if (campos.nome !== undefined && !campos.nome.trim()) throw new Error('O hábito precisa de um nome.');
    await this.db.habitos.update(id, { ...campos, editadoEm: agora() });
  }

  /**
   * RF-31: salva a edição do formulário. Os campos do hábito valem na hora; a
   * configuração (`versao`, só quando mudou) vira uma nova versão a partir de
   * `vigenteDesde`, sem tocar no passado. Tudo ou nada.
   */
  async salvarEdicao(
    id: string,
    campos: Parameters<Operacoes['editarHabito']>[1],
    versao: DadosVersao | null,
    vigenteDesde: DataLocal,
  ): Promise<void> {
    await this.db.transaction('rw', this.db.habitos, this.db.versoes, async () => {
      await this.editarHabito(id, campos);
      if (versao) await this.adicionarVersao(id, vigenteDesde, versao);
    });
  }

  /** RF-32: esconde o hábito a partir de uma data; o histórico fica. */
  async arquivarHabito(id: string, aPartirDe: DataLocal): Promise<void> {
    await this.db.habitos.update(id, { status: 'arquivado', arquivadoEm: aPartirDe, editadoEm: agora() });
  }

  async reativarHabito(id: string): Promise<void> {
    await this.db.habitos.update(id, { status: 'ativo', arquivadoEm: undefined, editadoEm: agora() });
  }

  /** RF-33: troca a posição do hábito ativo com o vizinho. Devolve false se já está na ponta. */
  async moverHabito(id: string, direcao: -1 | 1): Promise<boolean> {
    return this.db.transaction('rw', this.db.habitos, async () => {
      const ativos = (await this.db.habitos.orderBy('ordem').toArray()).filter((h) => h.status === 'ativo');
      const i = ativos.findIndex((h) => h.id === id);
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= ativos.length) return false;
      const t = agora();
      await this.db.habitos.update(ativos[i].id, { ordem: ativos[j].ordem, editadoEm: t });
      await this.db.habitos.update(ativos[j].id, { ordem: ativos[i].ordem, editadoEm: t });
      return true;
    });
  }

  /**
   * RF-33b: grava a nova ordem dos hábitos ATIVOS (arrastar e soltar). Reaproveita as
   * mesmas posições que eles já ocupavam, então os arquivados não mudam de lugar.
   */
  async definirOrdem(idsAtivosNaNovaOrdem: string[]): Promise<void> {
    await this.db.transaction('rw', this.db.habitos, async () => {
      if (new Set(idsAtivosNaNovaOrdem).size !== idsAtivosNaNovaOrdem.length) throw new Error('Ordem com hábito repetido.');
      const hs = await this.db.habitos.bulkGet(idsAtivosNaNovaOrdem);
      if (hs.some((h) => !h || h.status !== 'ativo')) throw new Error('A ordem só vale para hábitos ativos.');
      const posicoes = hs.map((h) => (h as Habito).ordem).sort((a, b) => a - b);
      const t = agora();
      for (let i = 0; i < idsAtivosNaNovaOrdem.length; i++) {
        await this.db.habitos.update(idsAtivosNaNovaOrdem[i], { ordem: posicoes[i], editadoEm: t });
      }
    });
  }

  /**
   * RF-33: cria "Nome (cópia)" logo abaixo do original, com a configuração que vale
   * em `hoje`. Sem registros, marcações nem histórico.
   */
  async duplicarHabito(id: string, hoje: DataLocal): Promise<{ habito: Habito; versao: VersaoHabito }> {
    return this.db.transaction('rw', this.db.habitos, this.db.versoes, async () => {
      const original = await this.db.habitos.get(id);
      if (!original) throw new Error('Hábito não encontrado.');
      const versoes = (await this.db.versoes.where('habitoId').equals(id).toArray()).sort((a, b) =>
        a.vigenteDesde < b.vigenteDesde ? -1 : 1,
      );
      const v = versoes.filter((x) => x.vigenteDesde <= hoje).pop() ?? versoes[0];
      if (!v) throw new Error('Hábito sem configuração.');
      const nome = `${original.nome} (cópia)`.slice(0, 60);
      const criado = await this.criarHabito({
        nome,
        descricao: original.descricao,
        icone: original.icone,
        cor: original.cor,
        categoria: original.categoria,
        tipo: v.tipo,
        unidade: v.unidade,
        meta: v.meta,
        blocos: v.blocos,
        frequencia: v.frequencia,
        entraNoPercentual: v.entraNoPercentual,
        passoAjuste: v.passoAjuste,
        vigenteDesde: hoje,
      });
      // posição: logo abaixo do original; os de baixo descem uma casa
      const abaixo = await this.db.habitos.where('ordem').above(original.ordem).toArray();
      for (const h of abaixo) {
        if (h.id !== criado.habito.id) await this.db.habitos.update(h.id, { ordem: h.ordem + 1 });
      }
      await this.db.habitos.update(criado.habito.id, { ordem: original.ordem + 1 });
      return { ...criado, habito: { ...criado.habito, ordem: original.ordem + 1 } };
    });
  }

  /**
   * RF-32: apaga de vez um hábito ARQUIVADO, com versões, registros e marcações.
   * Não toca em nenhum outro hábito. Quem chama guarda a cópia de segurança antes.
   */
  async excluirHabito(id: string): Promise<{ registros: number; marcacoes: number }> {
    return this.db.transaction(
      'rw',
      [this.db.habitos, this.db.versoes, this.db.registros, this.db.marcacoes],
      async () => {
        const h = await this.db.habitos.get(id);
        if (!h) throw new Error('Hábito não encontrado.');
        if (h.status !== 'arquivado') throw new Error('Só dá para excluir de vez um hábito arquivado.');
        const regs = await this.db.registros.where('habitoId').equals(id).primaryKeys();
        const marcs = await this.db.marcacoes.where('habitoId').equals(id).primaryKeys();
        await this.db.registros.bulkDelete(regs);
        await this.db.marcacoes.bulkDelete(marcs);
        await this.db.versoes.where('habitoId').equals(id).delete();
        await this.db.habitos.delete(id);
        return { registros: regs.length, marcacoes: marcs.length };
      },
    );
  }

  // ----- Registros (RF-18) -----

  async registrarValor(
    habitoId: string,
    valor: number,
    data: DataLocal,
    origem: OrigemRegistro,
    horario: string = formatarHorario(new Date()),
  ): Promise<Registro> {
    if (!(valor > 0) || !Number.isFinite(valor)) throw new Error('O valor precisa ser maior que zero.');
    if (!ehDataValida(data)) throw new Error('Data inválida.');
    const t = agora();
    const registro: Registro = {
      id: novoId(),
      habitoId,
      valor,
      data,
      horario,
      origem,
      criadoEm: t,
      editadoEm: t,
    };
    await this.db.registros.add(registro);
    return registro;
  }

  /** Corrige o valor de um registro. Devolve o registro anterior (para Desfazer). */
  async corrigirRegistro(id: string, novoValor: number): Promise<Registro> {
    if (!(novoValor > 0) || !Number.isFinite(novoValor)) throw new Error('O valor precisa ser maior que zero.');
    const antigo = await this.db.registros.get(id);
    if (!antigo) throw new Error('Registro não encontrado.');
    await this.db.registros.update(id, { valor: novoValor, editadoEm: agora() });
    return antigo;
  }

  async excluirRegistro(id: string): Promise<Registro | undefined> {
    const antigo = await this.db.registros.get(id);
    if (antigo) await this.db.registros.delete(id);
    return antigo;
  }

  /** RF-13: desfaz todo o registro do hábito naquele dia. Devolve o que foi removido. */
  async excluirRegistrosDoDia(habitoId: string, data: DataLocal): Promise<Registro[]> {
    return this.db.transaction('rw', this.db.registros, async () => {
      const removidos = await this.db.registros.where('[habitoId+data]').equals([habitoId, data]).toArray();
      await this.db.registros.bulkDelete(removidos.map((r) => r.id));
      return removidos;
    });
  }

  async restaurarRegistros(registros: Registro[]): Promise<void> {
    await this.db.registros.bulkPut(registros);
  }

  // ----- Marcações (conclusão e semanal) -----

  /** Marca ou desmarca. Devolve true se ficou marcado. No máximo 1 por hábito por dia. */
  async alternarMarcacao(habitoId: string, data: DataLocal): Promise<boolean> {
    return this.db.transaction('rw', this.db.marcacoes, async () => {
      const existente = await this.db.marcacoes.where('[habitoId+data]').equals([habitoId, data]).first();
      if (existente) {
        await this.db.marcacoes.delete(existente.id);
        return false;
      }
      const m: Marcacao = { id: novoId(), habitoId, data, criadoEm: agora() };
      await this.db.marcacoes.add(m);
      return true;
    });
  }

  // ----- Dias (fechado, folga, nota) -----

  async lerDia(data: DataLocal): Promise<Dia> {
    return (await this.db.dias.get(data)) ?? { data, fechado: false, folga: false };
  }

  async salvarDia(data: DataLocal, parcial: Partial<Omit<Dia, 'data'>>): Promise<Dia> {
    if (parcial.nota !== undefined && parcial.nota.length > 280) {
      throw new Error('A nota do dia aceita até 280 caracteres.');
    }
    const novo: Dia = { ...(await this.lerDia(data)), ...parcial, data };
    await this.db.dias.put(novo);
    return novo;
  }

  // ----- Leitura para os cálculos -----

  async lerHabitosCompletos(): Promise<HabitoCompleto[]> {
    const [habitos, versoes] = await Promise.all([
      this.db.habitos.orderBy('ordem').toArray(),
      this.db.versoes.toArray(),
    ]);
    return habitos.map((habito) => ({
      habito,
      versoes: versoes.filter((v) => v.habitoId === habito.id),
    }));
  }

  /** Entradas de vários dias de uma vez (faixa dos 7 dias, calendário). */
  async carregarEntradasDoIntervalo(
    inicio: DataLocal,
    fim: DataLocal,
    hoje: DataLocal,
  ): Promise<EntradaDia[]> {
    const config = await this.lerConfig();
    const inicioMarcacoes = somarDias(inicio, -7);
    const [habitos, registros, marcacoes, dias] = await Promise.all([
      this.lerHabitosCompletos(),
      this.db.registros.where('data').between(inicio, fim, true, true).toArray(),
      this.db.marcacoes.where('data').between(inicioMarcacoes, fim, true, true).toArray(),
      this.db.dias.where('data').between(inicio, fim, true, true).toArray(),
    ]);
    const porData = new Map(dias.map((d) => [d.data, d]));
    return intervaloDeDatas(inicio, fim).map((data) => ({
      data,
      hoje,
      habitos,
      registros,
      marcacoes,
      dia: porData.get(data),
      inicioSemana: config.inicioSemana,
    }));
  }

  // ----- Hábitos de exemplo (temporário, Fase 3) -----

  /**
   * Remove SOMENTE hábitos marcados como exemplo, com seus registros, marcações
   * e versões. Nunca toca em hábitos reais. Só é chamado por ação do usuário,
   * depois de confirmação.
   */
  async removerExemplos(): Promise<{ habitos: number; registros: number }> {
    return this.db.transaction(
      'rw',
      [this.db.habitos, this.db.versoes, this.db.registros, this.db.marcacoes],
      async () => {
        const ex = await this.db.habitos.filter((h) => h.exemplo === true).toArray();
        const ids = ex.map((h) => h.id);
        const regs = await this.db.registros.where('habitoId').anyOf(ids).primaryKeys();
        await this.db.registros.bulkDelete(regs);
        await this.db.marcacoes.where('habitoId').anyOf(ids).delete();
        await this.db.versoes.where('habitoId').anyOf(ids).delete();
        await this.db.habitos.bulkDelete(ids);
        return { habitos: ids.length, registros: regs.length };
      },
    );
  }

  /** Monta tudo que `calcularDia` precisa para uma data. */
  async carregarEntradaDoDia(data: DataLocal, hoje: DataLocal): Promise<EntradaDia> {
    const config = await this.lerConfig();
    const semana = diasDaSemana(data, config.inicioSemana);
    const [habitos, registros, marcacoes, dia] = await Promise.all([
      this.lerHabitosCompletos(),
      this.db.registros.where('data').equals(data).toArray(),
      this.db.marcacoes.where('data').between(semana[0], semana[6], true, true).toArray(),
      this.lerDia(data),
    ]);
    return { data, hoje, habitos, registros, marcacoes, dia, inicioSemana: config.inicioSemana };
  }
}

export const operacoes = new Operacoes();
