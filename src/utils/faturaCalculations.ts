/**
 * Cálculo do resumo financeiro de uma pessoa (Juliano ou Lidiane).
 *
 * "Devido no mês" é dividido em dois valores separados, para dar controle
 * independente sobre cada tipo de gasto:
 *  - devidoAvista: soma de CADA compra à vista que ainda não foi marcada
 *    como paga por essa pessoa.
 *  - devidoParcelas: soma de CADA parcela que essa pessoa ainda não marcou
 *    como paga (parcela 1, 2, 3, 4... todas, não só a próxima).
 *  - devidoNoMes: soma dos dois acima, mantido para quem ainda usa o total
 *    combinado.
 *
 * Qualquer toggle clicado — parcela (em qualquer ordem) ou à vista — muda
 * o campo correspondente exatamente pelo valor daquele item: marcar como
 * pago subtrai; desmarcar devolve.
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
  tipo: 'a_vista' | 'parcela';
}

export interface ResumoAtual {
  /** Soma de cada compra à vista não paga por essa pessoa */
  devidoAvista: number;
  /** Soma de cada parcela não paga por essa pessoa (todas, não só a próxima) */
  devidoParcelas: number;
  /** devidoAvista + devidoParcelas, mantido para uso combinado */
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

export function calcularResumoAtual(
  expenses: Expense[],
  parcelas: Parcela[],
  pessoa: Pessoa,
  _hoje: Date = new Date()
): ResumoAtual {
  let devidoAvista = 0;
  let devidoParcelas = 0;
  let pagoTotal = 0;
  const itensDevidos: ItemDevido[] = [];

  const pagoPor = (jaPagouJuliano: boolean, jaPagouLidiane: boolean): boolean =>
    pessoa === 'Juliano' ? jaPagouJuliano : jaPagouLidiane;

  // Compras à vista: cada uma soma no "devidoAvista" se não estiver paga
  // por essa pessoa, ou no "pago" se já estiver — sem filtro de mês.
  for (const expense of expenses) {
    if (expense.forma_pagamento !== 'a_vista') continue;

    const parte = expense.valor / 2;
    if (pagoPor(expense.paga_juliano, expense.paga_lidiane)) {
      pagoTotal += parte;
    } else {
      devidoAvista += parte;
      itensDevidos.push({
        id: expense.id,
        local: expense.local,
        valor: parte,
        descricao: 'À vista',
        tipo: 'a_vista',
      });
    }
  }

  // Parcelas: CADA parcela conta individualmente (paga ou não) no
  // "devidoParcelas" — sem escolher "só a próxima". Qualquer toggle, em
  // qualquer ordem, reflete direto no card pelo valor exato daquela parcela.
  for (const parcela of parcelas) {
    const parte = parcela.valor_parcela / 2;

    if (pagoPor(parcela.paga_juliano, parcela.paga_lidiane)) {
      pagoTotal += parte;
    } else {
      devidoParcelas += parte;

      const gastoRelacionado = expenses.find((e) => e.id === parcela.gasto_id);
      itensDevidos.push({
        id: parcela.id,
        local: gastoRelacionado ? gastoRelacionado.local : 'Compra parcelada',
        valor: parte,
        descricao: `Parcela ${parcela.numero_parcela}${
          gastoRelacionado?.numero_parcelas ? ` de ${gastoRelacionado.numero_parcelas}` : ''
        }`,
        tipo: 'parcela',
      });
    }
  }

  return {
    devidoAvista,
    devidoParcelas,
    devidoNoMes: devidoAvista + devidoParcelas,
    pagoTotal,
    itensDevidos,
  };
}

/** Retorna { ano, mes } do mês atual (mes 0-indexado) */
export function getMesAnoAtual(hoje: Date = new Date()): { ano: number; mes: number } {
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() };
}