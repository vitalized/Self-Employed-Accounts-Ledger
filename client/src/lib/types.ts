export type TransactionType = 'Business' | 'Personal' | 'Unreviewed' | 'Split';
export type BusinessType = 'Income' | 'Expense' | 'Transfer';

export interface Transaction {
  id: string;
  date: string; // ISO date string
  description: string;
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
  | 'tax-year-current' 
  | 'tax-year-previous' 
  | 'custom';

export interface FilterState {
  dateRange: DateFilter;
  customStartDate?: Date;
  customEndDate?: Date;
  type?: TransactionType | 'All';
  search: string;
}
