export type TransactionType = 'Business' | 'Personal' | 'Unreviewed' | 'Split';
export type BusinessType = 'Income' | 'Expense' | 'Transfer';

export interface Transaction {
  id: string;
  date: string; // ISO date string
  description: string;
  reference?: string; // Transaction reference from bank API
  amount: number; // Negative for money out, positive for money in
  type: TransactionType;
  category?: string;
  businessType?: BusinessType; // Only if type is Business
  tags: string[];
  merchant: string;
  status: 'Pending' | 'Cleared';
}

export const EXCLUDED_CATEGORIES = [
  'Opening Balance',
  'Drawings',
  'Capital Injection',
  'Balance Adjustment',
  'Bank Transfer (Internal)',
  'Personal Use Adjustment',
  'Bank Transfer',
  'Closing Entry'
];

export function isIncludedInProfit(transaction: { category?: string | null }): boolean {
  return !transaction.category || !EXCLUDED_CATEGORIES.includes(transaction.category);
}

export function isJournalEntry(transaction: { tags?: string[] | null; description?: string | null }): boolean {
  return transaction.tags?.includes('journal:entry') || transaction.description?.startsWith('[Journal]') || false;
}

export type DateFilter = 
  | 'this-month' 
  | 'last-month' 
  | 'last-3-months' 
  | 'custom'
  | string; // Allows dynamic tax year formats like 'tax-year-2024-25'

export interface FilterState {
  dateRange: DateFilter;
  customStartDate?: Date;
  customEndDate?: Date;
  type?: TransactionType | 'All' | 'Business Income' | 'Business Expense' | 'Business' | 'Journal';
  category?: string | 'All';
  search: string;
}
