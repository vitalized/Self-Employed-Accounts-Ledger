import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiTransaction } from './api';
import type { Transaction } from './types';

// Convert API transaction to frontend transaction
function apiToTransaction(apiTx: ApiTransaction): Transaction {
  return {
    id: apiTx.id,
    date: apiTx.date,
    description: apiTx.description,
    reference: apiTx.reference || undefined,
    amount: parseFloat(apiTx.amount),
    merchant: apiTx.merchant,
    type: apiTx.type as any,
    category: apiTx.category || undefined,
    businessType: apiTx.businessType as any,
    status: apiTx.status as any,
    tags: apiTx.tags || [],
  };
}

// Convert frontend transaction to API transaction
function transactionToApi(tx: Partial<Transaction>): Partial<ApiTransaction> {
  return {
    date: tx.date,
    description: tx.description,
    amount: tx.amount !== undefined ? String(tx.amount) : undefined,
    merchant: tx.merchant,
    type: tx.type,
    category: tx.category,
    businessType: tx.businessType,
    status: tx.status,
    tags: tx.tags,
  } as Partial<ApiTransaction>;
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const data = await api.transactions.getAll();
      return data.map(apiToTransaction);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Transaction> }) => {
      const apiUpdates = transactionToApi(updates);
      const data = await api.transactions.update(id, apiUpdates);
      return apiToTransaction(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (transaction: Omit<Transaction, 'id'>) => {
      const apiTransaction = transactionToApi(transaction);
      const data = await api.transactions.create(apiTransaction as any);
      return apiToTransaction(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await api.transactions.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
