/**
 * Serviço para operações com parcelas de gastos parcelados
 */

import { supabase } from './supabaseClient';
import type { Parcela } from '../types/expense';

const TABLE_NAME = 'parcelas';

/**
 * Busca as parcelas de um gasto específico
 */
export const getParcelasByGastoId = async (gastoId: string): Promise<Parcela[]> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('gasto_id', gastoId)
    .order('numero_parcela', { ascending: true });

  if (error) {
    console.error('Erro ao buscar parcelas:', error);
    throw error;
  }

  return data || [];
};

/**
 * Busca todas as parcelas de todos os gastos (usado para calcular status "Pago")
 */
export const getAllParcelas = async (): Promise<Parcela[]> => {
  const { data, error } = await supabase.from(TABLE_NAME).select('*');

  if (error) {
    console.error('Erro ao buscar todas as parcelas:', error);
    throw error;
  }

  return data || [];
};

/**
 * Cria as parcelas de um gasto parcelado, dividindo o valor total igualmente.
 * A última parcela absorve qualquer diferença de arredondamento.
 * "paga" NÃO é enviada aqui: é uma coluna gerada automaticamente pelo banco
 * a partir de paga_juliano/paga_lidiane, e começa como false por padrão
 * assim que as duas colunas nascem como false.
 */
export const createParcelasForExpense = async (
  gastoId: string,
  valorTotal: number,
  numeroParcelas: number
): Promise<void> => {
  const valorBase = Math.floor((valorTotal / numeroParcelas) * 100) / 100;
  const totalBase = valorBase * (numeroParcelas - 1);
  const valorUltima = Math.round((valorTotal - totalBase) * 100) / 100;

  const parcelas = Array.from({ length: numeroParcelas }, (_, i) => ({
    gasto_id: gastoId,
    numero_parcela: i + 1,
    valor_parcela: i === numeroParcelas - 1 ? valorUltima : valorBase,
    paga_juliano: false,
    paga_lidiane: false,
  }));

  const { error } = await supabase.from(TABLE_NAME).insert(parcelas);

  if (error) {
    console.error('Erro ao criar parcelas:', error);
    throw error;
  }
};

/**
 * Marca ou desmarca uma parcela como paga para AMBAS as pessoas de uma vez
 * (campo antigo — mantido por compatibilidade). O campo "paga" e
 * "data_pagamento" são recalculados automaticamente pelo banco.
 */
export const toggleParcelaPaga = async (id: string, paga: boolean): Promise<Parcela> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ paga_juliano: paga, paga_lidiane: paga })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar parcela:', error);
    throw error;
  }

  return data;
};

/**
 * Marca ou desmarca a parte de UMA pessoa (Juliano ou Lidiane) como paga
 * nesta parcela.
 *
 * IMPORTANTE: atualiza SOMENTE o campo dessa pessoa, em uma única operação
 * atômica — sem ler o estado atual antes. Isso é o que permite clicar em
 * qualquer parcela, de qualquer compra, a qualquer momento, em qualquer
 * ordem (adiantar parcela 3 antes da 2, por exemplo) sem que um clique
 * "atropele" outro.
 *
 * "paga" (combinado) e "data_pagamento" são recalculados automaticamente
 * pelo banco (coluna gerada + trigger), então não precisam ser enviados
 * por aqui.
 */
export const toggleParcelaPagaPessoa = async (
  id: string,
  pessoa: 'Juliano' | 'Lidiane',
  novoPaga: boolean
): Promise<Parcela> => {
  const campo = pessoa === 'Juliano' ? 'paga_juliano' : 'paga_lidiane';

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update({ [campo]: novoPaga })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar parcela por pessoa:', error);
    throw error;
  }

  return data;
};