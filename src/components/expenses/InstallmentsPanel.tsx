/**
 * Componente InstallmentsPanel - Lista as parcelas de um gasto, com checkbox
 * para marcar cada parcela como paga, mostrando a parte (metade) de cada uma.
 *
 * Todas as parcelas são clicáveis, em qualquer ordem — o card de "Falta
 * Pagar" soma cada parcela individualmente, então qualquer toggle sempre
 * muda o valor exatamente pelo valor daquela parcela.
 */

import React from 'react';
import { useParcelas } from '../../hooks/useParcelas';
import { formatCurrency } from '../../utils/formatCurrency';
import type { Parcela } from '../../types/expense';

interface InstallmentsPanelProps {
  gastoId: string;
  /**
   * Se informado, o painel controla o pagamento ESPECÍFICO dessa pessoa
   * (paga_juliano / paga_lidiane) em vez do campo genérico "paga".
   * Deixe undefined para manter o comportamento antigo (campo único "paga").
   */
  pessoa?: 'Juliano' | 'Lidiane';
  /** Chamado depois que uma parcela é marcada/desmarcada como paga, com a
   * parcela já atualizada — para o componente pai atualizar o card sem
   * precisar rebuscar tudo do banco (evita condição de corrida em cliques
   * rápidos). */
  onParcelaToggled?: (parcelaAtualizada: Parcela) => void;
}

export const InstallmentsPanel: React.FC<InstallmentsPanelProps> = ({
  gastoId,
  pessoa,
  onParcelaToggled,
}) => {
  const { parcelas, loading, error, togglePaga, togglePagaPessoa } = useParcelas(gastoId);

  const isPagaPeloUsuario = (parcela: Parcela): boolean => {
    if (pessoa === 'Juliano') return parcela.paga_juliano;
    if (pessoa === 'Lidiane') return parcela.paga_lidiane;
    return parcela.paga;
  };

  const handleToggle = async (parcela: Parcela) => {
    const novoPaga = !isPagaPeloUsuario(parcela);
    const atualizada = pessoa
      ? await togglePagaPessoa(parcela.id, pessoa, novoPaga)
      : await togglePaga(parcela.id, novoPaga);

    onParcelaToggled?.(atualizada);
  };

  if (loading) {
    return <p className="text-sm text-gray-500 py-3">Carregando parcelas...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600 py-3">Erro ao carregar parcelas: {error}</p>;
  }

  if (parcelas.length === 0) {
    return <p className="text-sm text-gray-500 py-3">Nenhuma parcela encontrada.</p>;
  }

  return (
    <div className="space-y-2 py-3">
      {parcelas.map((parcela) => {
        const paga = isPagaPeloUsuario(parcela);

        return (
          <div
            key={parcela.id}
            className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
              paga ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleToggle(parcela)}
                title={paga ? 'Marcar como não paga' : 'Marcar como paga'}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                  paga
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-white border-gray-300 text-transparent hover:border-blue-400'
                }`}
              >
                ✓
              </button>
              <span className="text-sm font-medium text-gray-700">
                Parcela {parcela.numero_parcela}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">{formatCurrency(parcela.valor_parcela)}</span>
              <span className="font-semibold text-gray-800">
                Sua parte: {formatCurrency(parcela.valor_parcela / 2)}
              </span>
              {paga && (
                <span className="text-green-700 font-semibold text-xs bg-green-100 px-2 py-0.5 rounded-full">
                  Pago
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};