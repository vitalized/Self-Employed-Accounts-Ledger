// API client for backend communication
const API_BASE = '/api';

export interface ApiTransaction {
  id: string;
  userId?: string | null;
  date: string;
  description: string;
  reference?: string | null;
  amount: string;
  merchant: string;
  type: string;
  category?: string | null;
  businessType?: string | null;
  status: string;
  tags: string[];
  createdAt: string;
}

export const api = {
  transactions: {
    async getAll(): Promise<ApiTransaction[]> {
      const res = await fetch(`${API_BASE}/transactions`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    },

    async get(id: string): Promise<ApiTransaction> {
      const res = await fetch(`${API_BASE}/transactions/${id}`);
      if (!res.ok) throw new Error('Failed to fetch transaction');
      return res.json();
    },

    async create(transaction: Omit<ApiTransaction, 'id' | 'createdAt'>): Promise<ApiTransaction> {
      const res = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction),
      });
      if (!res.ok) throw new Error('Failed to create transaction');
      return res.json();
    },

    async update(id: string, updates: Partial<ApiTransaction>): Promise<ApiTransaction> {
      const res = await fetch(`${API_BASE}/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update transaction');
      return res.json();
    },

    async delete(id: string): Promise<void> {
      const res = await fetch(`${API_BASE}/transactions/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete transaction');
    },
  },
};
