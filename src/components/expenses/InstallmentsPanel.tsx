/**
 * Componente InstallmentsPanel - Lista as parcelas de um gasto, com checkbox
 * para marcar cada parcela como paga, mostrando a parte (metade) de cada uma.
 *
 * Só é possível clicar em:
 *  - Uma parcela já paga (para desmarcar);
 *  - A PRÓXIMA parcela não paga (a "da vez"), na ordem 1, 2, 3...
 *
 * As demais parcelas não pagas ficam desabilitadas, porque o card de "Falta
 * Pagar" só conta a próxima parcela de cada compra — clicar fora de ordem
 * não teria nenhum efeito nela, então preferimos nem deixar clicar.
 */

import React from 'react';
import { useParcelas } from '../../hooks/useParcelas';
import { formatCurrency } from '../../utils/formatCurrency';
import { encontrarProximaParcelaNaoPaga } from '../../utils/faturaCalculations';
import type { Parcela } from '../../types/expense';

interface InstallmentsPanelProps {
  gastoId: string;
  /**
   * Se informado, o painel controla o pagamento ESPECÍFICO dessa pessoa
   * (paga_juliano / paga_lidiane) em vez do campo genérico "paga", e só
   * libera o clique na parcela "da vez" dessa pessoa.
   * Deixe undefined para manter o comportamento antigo (campo único "paga",
   * todas as parcelas clicáveis).
   */
  pessoa?: 'Juliano' | 'Lidiane';
  /** Chamado depois que uma parcela é marcada/desmarcada como paga,
   * para o componente pai atualizar contadores que dependem disso
   * (ex: "X de Y pagas" na área de Parcelas Pendentes) */
  onParcelaToggled?: () => void;
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

  // A parcela "da vez" (a próxima não paga) para esta pessoa — só ela e as
  // já pagas ficam clicáveis. Sem "pessoa" definida, mantém tudo clicável
  // (comportamento antigo).
  const proximaNaoPagaId = pessoa
    ? encontrarProximaParcelaNaoPaga(parcelas, pessoa)?.id
    : undefined;

  const podeClicar = (parcela: Parcela): boolean => {
    if (!pessoa) return true; // comportamento antigo: sempre clicável
    if (isPagaPeloUsuario(parcela)) return true; // sempre pode desmarcar a que já está paga
    return parcela.id === proximaNaoPagaId; // só a próxima não paga pode ser marcada
  };

  const handleToggle = async (parcela: Parcela) => {
    if (!podeClicar(parcela)) return;

    const novoPaga = !isPagaPeloUsuario(parcela);
    if (pessoa) {
      await togglePagaPessoa(parcela.id, pessoa, novoPaga);
    } else {
      await togglePaga(parcela.id, novoPaga);
    }
    onParcelaToggled?.();
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
        const clicavel = podeClicar(parcela);

        return (
          <div
            key={parcela.id}
            className={`flex items-center justify-between px-4 py-2 rounded-lg border ${
              paga
                ? 'bg-green-50 border-green-200'
                : clicavel
                ? 'bg-gray-50 border-gray-200'
                : 'bg-gray-50 border-gray-100 opacity-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleToggle(parcela)}
                disabled={!clicavel}
                title={
                  paga
                    ? 'Marcar como não paga'
                    : clicavel
                    ? 'Marcar como paga'
                    : 'Marque as parcelas anteriores primeiro'
                }
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                  paga
                    ? 'bg-green-600 border-green-600 text-white'
                    : clicavel
                    ? 'bg-white border-gray-300 text-transparent hover:border-blue-400'
                    : 'bg-gray-100 border-gray-200 text-transparent cursor-not-allowed'
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