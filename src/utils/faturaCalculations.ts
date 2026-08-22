/**
 * Cálculo do resumo financeiro de uma pessoa (Juliano ou Lidiane).
 *
 * "Devido no mês":
 *  - Compras à vista: soma o valor de CADA uma que ainda não foi marcada
 *    como paga por essa pessoa (todas, valor exato de cada uma).
 *  - Compras PARCELADAS: para cada compra, soma só o valor da PRÓXIMA
 *    parcela que essa pessoa ainda não marcou como paga (nunca todas as
 *    parcelas em aberto, nunca o total da compra). Assim que essa parcela
 *    é paga, a parcela seguinte assume o lugar automaticamente no cálculo.
 *
 * Para que QUALQUER toggle que o usuário consiga clicar sempre mude o
 * valor do card, o InstallmentsPanel só permite clicar na parcela que
 * realmente está sendo contada (a próxima não paga) — as demais ficam
 * desabilitadas até chegar a vez delas.
 *
 * "Já pago" é um contador VITALÍCIO: soma tudo que essa pessoa já marcou
 * como pago (à vista de qualquer mês + qualquer parcela), independente de
 * quando foi pago.
 *
 * O "pago"/"não pago" é sempre específico de cada pessoa
 * (paga_juliano/paga_lidiane).
 *
 * Também retorna "itensDevidos": a lista detalhada de cada item que está
 * entrando na soma de "devidoNoMes", útil para conferir/depurar o valor.
 */

import type { Expense, Parcela } from '../types/expense';

export type Pessoa = 'Juliano' | 'Lidiane';

export interface ItemDevido {
  id: string;
  local: string;
  valor: number;
  descricao: string;
}

export interface ResumoAtual {
  /** Devido: à vista em aberto (todas) + próxima parcela não paga de cada compra parcelada */
  devidoNoMes: number;
  /** Contador vitalício: tudo que esta pessoa já marcou como pago, de qualquer mês */
  pagoTotal: number;
  /** Detalhamento de cada item somado em devidoNoMes, para conferência */
  itensDevidos: ItemDevido[];
}

/**
 * Converte data_compra (pode vir como "YYYY-MM-DD" simples ou como
 * timestamp completo "YYYY-MM-DDTHH:mm:ss.ssssss+00:00") para uma Date
 * local, usando apenas ano/mês/dia.
 */
export function parseDataLocal(dataStr: string): Date {
  const somenteData = dataStr.split('T')[0];
  const [ano, mes, dia] = somenteData.split('-').map(Number);
  return new Date(ano, (mes || 1) - 1, dia || 1);
}

/**
 * Retorna, dentro de uma lista de parcelas de UMA mesma compra, qual é a
 * "próxima não paga" para a pessoa informada (a de menor número que ainda
 * não foi marcada como paga por ela). Retorna undefined se todas já
 * estiverem pagas.
 */
export function encontrarProximaParcelaNaoPaga(
  parcelasDoGasto: Parcela[],
  pessoa: Pessoa
): Parcela | undefined {
  const pagoPor = (p: Parcela) => (pessoa === 'Juliano' ? p.paga_juliano : p.paga_lidiane);
  const ordenadas = [...parcelasDoGasto].sort((a, b) => a.numero_parcela - b.numero_parcela);
  return ordenadas.find((p) => !pagoPor(p));
}

export function calcularResumoAtual(
  expenses: Expense[],
  parcelas: Parcela[],
  pessoa: Pessoa,
  _hoje: Date = new Date()
): ResumoAtual {
  let devidoNoMes = 0;
  let pagoTotal = 0;
  const itensDevidos: ItemDevido[] = [];

  const pagoPor = (jaPagouJuliano: boolean, jaPagouLidiane: boolean): boolean =>
    pessoa === 'Juliano' ? jaPagouJuliano : jaPagouLidiane;

  // Compras à vista: cada uma soma no "devido" se não estiver paga por essa
  // pessoa, ou no "pago" se já estiver — sem filtro de mês.
  for (const expense of expenses) {
    if (expense.forma_pagamento !== 'a_vista') continue;

    const parte = expense.valor / 2;
    if (pagoPor(expense.paga_juliano, expense.paga_lidiane)) {
      pagoTotal += parte;
    } else {
      devidoNoMes += parte;
      itensDevidos.push({
        id: expense.id,
        local: expense.local,
        valor: parte,
        descricao: 'À vista',
      });
    }
  }

  // Agrupa parcelas por compra, somando "já pago" para todas as parcelas
  // pagas por essa pessoa, de qualquer compra.
  const parcelasPorGasto = new Map<string, Parcela[]>();
  for (const parcela of parcelas) {
    const lista = parcelasPorGasto.get(parcela.gasto_id) ?? [];
    lista.push(parcela);
    parcelasPorGasto.set(parcela.gasto_id, lista);

    if (pagoPor(parcela.paga_juliano, parcela.paga_lidiane)) {
      pagoTotal += parcela.valor_parcela / 2;
    }
  }

  // Para o "devido": em cada compra parcelada, conta só a parcela seguinte
  // que essa pessoa ainda não pagou — nunca todas as parcelas em aberto.
  for (const [gastoId, lista] of parcelasPorGasto) {
    const proximaNaoPaga = encontrarProximaParcelaNaoPaga(lista, pessoa);

    if (proximaNaoPaga) {
      const parte = proximaNaoPaga.valor_parcela / 2;
      devidoNoMes += parte;

      const gastoRelacionado = expenses.find((e) => e.id === gastoId);
      itensDevidos.push({
        id: proximaNaoPaga.id,
        local: gastoRelacionado ? gastoRelacionado.local : 'Compra parcelada',
        valor: parte,
        descricao: `Parcela ${proximaNaoPaga.numero_parcela}${
          gastoRelacionado?.numero_parcelas ? ` de ${gastoRelacionado.numero_parcelas}` : ''
        }`,
      });
    }
  }

  return { devidoNoMes, pagoTotal, itensDevidos };
}

/** Retorna { ano, mes } do mês atual (mes 0-indexado) */
export function getMesAnoAtual(hoje: Date = new Date()): { ano: number; mes: number } {
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() };
}