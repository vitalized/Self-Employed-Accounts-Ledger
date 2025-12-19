import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCards } from "@/components/dashboard/StatCards";
import { TransactionChart } from "@/components/dashboard/TransactionChart";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { Filters } from "@/components/dashboard/Filters";
import { MOCK_TRANSACTIONS } from "@/lib/mockData";
import { FilterState, Transaction } from "@/lib/types";
import { startOfMonth, subMonths, startOfYear, endOfYear, subYears, isWithinInterval, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: 'tax-year-current',
    search: '',
    type: undefined,
    category: undefined
  });

  // Extract unique categories for filter
  const availableCategories = useMemo(() => {
    const categories = new Set(transactions.map(t => t.category).filter(Boolean));
    return Array.from(categories).sort() as string[];
  }, [transactions]);

  // Helper to get date range object
  const getDateRange = (filter: FilterState['dateRange']) => {
    const now = new Date();
    // Simplified Tax Year Logic (UK Tax year starts April 6th)
    // For this prototype, let's assume Tax Year runs April 1 - March 31 for cleaner monthly data
    const currentTaxYearStart = new Date(2025, 3, 1); // April 1, 2025
    const currentTaxYearEnd = new Date(2026, 2, 31);
    
    // Check if we are actually in the 2025-26 tax year or not relative to "today"
    // Mocking "today" as Dec 19, 2025 based on prompt context
    
    switch (filter) {
      case 'this-month':
        return { start: startOfMonth(now), end: now };
      case 'last-month':
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        return { start: lastMonthStart, end: subMonths(now, 0) }; // End of last month roughly
      case 'last-3-months':
        return { start: subMonths(now, 3), end: now };
      case 'tax-year-current':
        return { start: new Date(2025, 3, 1), end: new Date(2026, 2, 31) };
      case 'tax-year-previous':
        return { start: new Date(2024, 3, 1), end: new Date(2025, 2, 31) };
      default:
        return { start: new Date(2025, 0, 1), end: now };
    }
  };

  const dateRange = getDateRange(filters.dateRange);

  // Filter Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = parseISO(t.date);
      
      // Date Filter
      if (!isWithinInterval(tDate, dateRange)) {
         // Allow for generous range if 'tax-year' to catch outliers in mock data if necessary, 
         // but strictly following logic:
         return false; 
      }

      // Type Filter
      if (filters.type && t.type !== filters.type) return false;

      // Category Filter
      if (filters.category && t.category !== filters.category) return false;

      // Search Filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          t.description.toLowerCase().includes(searchLower) ||
          t.merchant.toLowerCase().includes(searchLower) ||
          t.amount.toString().includes(searchLower)
        );
      }

      return true;
    });
  }, [transactions, filters, dateRange]);

  const handleTransactionUpdate = (id: string, updates: Partial<Transaction>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    toast({
      title: "Transaction Updated",
      description: "Changes have been saved.",
    });
  };

  const handleExport = () => {
    toast({
      title: "Exporting Data",
      description: `Downloading transactions for ${filters.dateRange}...`,
    });
  };

  const handleRefresh = () => {
    toast({
      title: "Syncing with Bank",
      description: "Fetching latest transactions...",
    });
    // Simulate delay
    setTimeout(() => {
      toast({
        title: "Sync Complete",
        description: "Your transactions are up to date.",
      });
    }, 1500);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
          <p className="text-muted-foreground">
            Manage your business finances and track tax liability.
          </p>
        </div>

        <Filters 
          filterState={filters} 
          onFilterChange={(updates) => setFilters(prev => ({ ...prev, ...updates }))}
          onRefresh={handleRefresh}
          onExport={handleExport}
          availableCategories={availableCategories}
        />

        <StatCards 
          transactions={filteredTransactions} 
          dateLabel={filters.dateRange}
        />

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
          <TransactionChart 
            transactions={filteredTransactions} 
            dateRange={dateRange}
          />
        </div>

        <div>
           <div className="flex items-center justify-between py-4">
             <h3 className="text-xl font-semibold">Recent Transactions</h3>
             <div className="text-sm text-muted-foreground">
               {filteredTransactions.length} transactions found
             </div>
           </div>
           <TransactionList 
             transactions={filteredTransactions} 
             onUpdateTransaction={handleTransactionUpdate}
           />
        </div>
      </div>
    </DashboardLayout>
  );
}
