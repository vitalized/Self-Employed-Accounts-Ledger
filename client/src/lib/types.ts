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
  type?: TransactionType | 'All' | 'Business Income' | 'Business Expense' | 'Business';
  category?: string | 'All';
  search: string;
}
