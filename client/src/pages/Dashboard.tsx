import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCards } from "@/components/dashboard/StatCards";
import { TransactionChart } from "@/components/dashboard/TransactionChart";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { Filters } from "@/components/dashboard/Filters";
import { MOCK_TRANSACTIONS } from "@/lib/mockData";
import { FilterState, Transaction } from "@/lib/types";
import { startOfMonth, subMonths, startOfYear, endOfYear, subYears, isWithinInterval, parseISO, endOfMonth, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useTransactions, useUpdateTransaction } from "@/lib/queries";
import { useDataMode } from "@/lib/dataContext";

export default function Dashboard() {
  const { toast } = useToast();
  const { useMockData } = useDataMode();
  const { data: apiTransactions = [], isLoading, refetch } = useTransactions();
  const updateTransactionMutation = useUpdateTransaction();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const transactions = useMockData ? MOCK_TRANSACTIONS : apiTransactions;
  
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
        return { start: lastMonthStart, end: endOfMonth(subMonths(now, 1)) };
      case 'last-3-months':
        return { start: startOfMonth(subMonths(now, 3)), end: endOfMonth(subMonths(now, 1)) };
      case 'tax-year-current':
        return { start: new Date(2025, 3, 1), end: new Date(2026, 2, 31) };
      case 'tax-year-previous':
        return { start: new Date(2024, 3, 1), end: new Date(2025, 2, 31) };
      case 'custom':
        return { 
          start: filters.customStartDate || startOfMonth(now), 
          end: filters.customEndDate || now 
        };
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
      if (filters.type && filters.type !== 'All') {
        if (filters.type === 'Business') {
          if (t.type !== 'Business') return false;
        } else if (filters.type === 'Business Income') {
          if (t.type !== 'Business' || t.businessType !== 'Income') return false;
        } else if (filters.type === 'Business Expense') {
          if (t.type !== 'Business' || t.businessType !== 'Expense') return false;
        } else if (t.type !== filters.type) {
          return false;
        }
      }

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

  const handleTransactionUpdate = async (id: string, updates: Partial<Transaction>) => {
    try {
      await updateTransactionMutation.mutateAsync({ id, updates });
      toast({
        title: "Transaction Updated",
        description: "Changes have been saved.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update transaction. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    toast({
      title: "Exporting Data",
      description: `Downloading transactions for ${filters.dateRange}...`,
    });
  };

  const handleRefresh = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    toast({
      title: "Syncing with Starling Bank",
      description: "Fetching latest transactions...",
    });

    try {
      const response = await fetch("/api/starling/sync", {
        method: "POST"
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Refetch transactions to show new ones
        await refetch();
        setLastUpdated(new Date());
        toast({
          title: "Sync Complete",
          description: data.message || `Imported ${data.imported || 0} new transactions.`,
        });
      } else if (response.status === 401) {
        toast({
          title: "Not Connected",
          description: "Please connect your Starling Bank account in Settings first.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sync Failed",
          description: data.error || "Failed to sync with Starling Bank.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Sync Error",
        description: "Failed to connect to the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading && !useMockData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-muted-foreground">Loading transactions...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
          <p className="text-muted-foreground">
            Manage your business finances and track tax liability.
          </p>
        </div>

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
             <h3 className="text-xl font-semibold">Transactions</h3>
             <div className="text-sm text-muted-foreground flex items-center gap-4">
               <span>{filteredTransactions.length} transactions found</span>
               {lastUpdated && (
                 <span>Last updated: {format(lastUpdated, "dd MMM yyyy 'at' HH:mm")}</span>
               )}
             </div>
           </div>

           <Filters 
            filterState={filters} 
            onFilterChange={(updates) => setFilters(prev => ({ ...prev, ...updates }))}
            onRefresh={handleRefresh}
            onExport={handleExport}
            availableCategories={availableCategories}
            isSyncing={isSyncing}
          />

           <TransactionList 
             transactions={filteredTransactions} 
             onUpdateTransaction={handleTransactionUpdate}
             onRefresh={refetch}
           />
        </div>
      </div>
    </DashboardLayout>
  );
}
