import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCards } from "@/components/dashboard/StatCards";
import { TransactionChart } from "@/components/dashboard/TransactionChart";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { Filters } from "@/components/dashboard/Filters";
import { VATTracker } from "@/components/dashboard/VATTracker";
import { PendingPaymentsTable } from "@/components/dashboard/PendingPaymentsTable";
import { MOCK_TRANSACTIONS } from "@/lib/mockData";
import { FilterState, Transaction } from "@/lib/types";
import { startOfMonth, subMonths, startOfYear, endOfYear, subYears, isWithinInterval, parseISO, endOfMonth, format, isFuture, isAfter, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";
import { DateFilter } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useTransactions, useUpdateTransaction } from "@/lib/queries";
import { useDataMode } from "@/lib/dataContext";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { toast } = useToast();
  const { useMockData } = useDataMode();
  const { data: apiTransactions = [], isLoading, refetch } = useTransactions();
  const updateTransactionMutation = useUpdateTransaction();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch last sync time on load
  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const response = await fetch("/api/sync-status");
        if (response.ok) {
          const data = await response.json();
          if (data.lastSyncAt) {
            setLastUpdated(new Date(data.lastSyncAt));
          }
        }
      } catch (error) {
        console.error("Failed to fetch sync status:", error);
      }
    };
    if (!useMockData) {
      fetchSyncStatus();
    }
  }, [useMockData]);
  
  const transactions = useMockData ? MOCK_TRANSACTIONS : apiTransactions;

  const { data: taxYears = [] } = useQuery<string[]>({
    queryKey: ["/api/tax-years"],
    queryFn: async () => {
      const res = await fetch("/api/tax-years");
      if (!res.ok) throw new Error("Failed to fetch tax years");
      return res.json();
    },
  });

  const [hasInitializedTaxYear, setHasInitializedTaxYear] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    dateRange: 'this-month',
    search: '',
    type: undefined,
    category: undefined
  });

  // Set default date range to most recent tax year once loaded
  useEffect(() => {
    if (taxYears.length > 0 && !hasInitializedTaxYear) {
      setFilters(prev => ({ ...prev, dateRange: `tax-year-${taxYears[0]}` }));
      setHasInitializedTaxYear(true);
    }
  }, [taxYears, hasInitializedTaxYear]);

  // Extract unique categories for filter
  const availableCategories = useMemo(() => {
    const categories = new Set(transactions.map(t => t.category).filter(Boolean));
    return Array.from(categories).sort() as string[];
  }, [transactions]);

  // Helper to get date range object
  const getDateRange = (filter: FilterState['dateRange']) => {
    const now = new Date();
    
    // Handle MTD quarter format: 'mtd-q1-YYYY-YY'
    if (filter.startsWith('mtd-q')) {
      const match = filter.match(/mtd-q(\d)-(\d{4})-(\d{2})/);
      if (match) {
        const quarter = parseInt(match[1]);
        const startYear = parseInt(match[2]);
        const taxYearStart = new Date(startYear, 3, 6); // April 6
        
        // MTD quarters are cumulative from April 6
        let endDate: Date;
        switch (quarter) {
          case 1: endDate = new Date(startYear, 6, 5, 23, 59, 59); break; // 5 July
          case 2: endDate = new Date(startYear, 9, 5, 23, 59, 59); break; // 5 October
          case 3: endDate = new Date(startYear + 1, 0, 5, 23, 59, 59); break; // 5 January
          case 4: endDate = new Date(startYear + 1, 3, 5, 23, 59, 59); break; // 5 April
          default: endDate = new Date(startYear + 1, 3, 5, 23, 59, 59);
        }
        return { start: taxYearStart, end: endDate };
      }
    }
    
    // Handle dynamic tax year format: 'tax-year-YYYY-YY'
    if (filter.startsWith('tax-year-')) {
      const taxYearStr = filter.replace('tax-year-', '');
      const startYear = parseInt(taxYearStr.split('-')[0]);
      if (!isNaN(startYear)) {
        // UK tax year: April 6 to April 5
        return { 
          start: new Date(startYear, 3, 6), // April 6
          end: new Date(startYear + 1, 3, 5, 23, 59, 59) // April 5 next year, end of day
        };
      }
    }
    
    switch (filter) {
      case 'this-month':
        return { start: startOfMonth(now), end: now };
      case 'last-month':
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        return { start: lastMonthStart, end: endOfMonth(subMonths(now, 1)) };
      case 'last-3-months':
        return { start: startOfMonth(subMonths(now, 3)), end: endOfMonth(subMonths(now, 1)) };
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

  // Separate pending (future-dated) from cleared transactions
  const { pendingTransactions, clearedTransactions } = useMemo(() => {
    const today = startOfDay(new Date());
    const pending: Transaction[] = [];
    const cleared: Transaction[] = [];
    
    transactions.forEach(t => {
      const tDate = parseISO(t.date);
      // Pending if status is 'Pending' or date is in the future
      if (t.status === 'Pending' || isAfter(tDate, today)) {
        pending.push(t);
      } else {
        cleared.push(t);
      }
    });
    
    return { pendingTransactions: pending, clearedTransactions: cleared };
  }, [transactions]);

  // Filter Transactions (only cleared ones for main view, charts, reports)
  const filteredTransactions = useMemo(() => {
    return clearedTransactions.filter(t => {
      const tDate = parseISO(t.date);
      
      // Date Filter
      if (!isWithinInterval(tDate, dateRange)) {
         return false; 
      }

      // Type Filter
      if (filters.type && filters.type !== 'All') {
        if (filters.type === 'Unreviewed') {
          const needsReview = t.type === 'Unreviewed' || (t.type === 'Business' && !t.category);
          if (!needsReview) return false;
        } else if (filters.type === 'Business') {
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
  }, [clearedTransactions, filters, dateRange]);

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

  const handleExport = (type: 'csv' | 'my-tax-digital') => {
    if (filteredTransactions.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no transactions matching your current filters.",
        variant: "destructive",
      });
      return;
    }

    // Helper to safely format dates - returns ISO date or original string if parsing fails
    const safeFormatDate = (dateStr: string): string => {
      try {
        const parsed = parseISO(dateStr);
        if (isNaN(parsed.getTime())) {
          return dateStr; // Return original if invalid
        }
        return format(parsed, 'yyyy-MM-dd');
      } catch {
        return dateStr; // Return original on error
      }
    };

    let csvContent: string;
    let filename: string;

    if (type === 'my-tax-digital') {
      // My Tax Digital format - optimized for their import
      // Columns: Date, Description, Amount, Type, Category
      const headers = ['Date', 'Description', 'Amount', 'Type', 'Category'];
      const rows = filteredTransactions.map(t => [
        safeFormatDate(t.date),
        `"${(t.description || t.merchant || '').replace(/"/g, '""')}"`,
        t.amount.toFixed(2),
        t.type || '',
        t.category || ''
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      filename = `taxtrack-my-tax-digital-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      
      toast({
        title: "My Tax Digital Export Ready",
        description: `Exported ${filteredTransactions.length} transactions. Import this file into My Tax Digital and map the columns.`,
      });
    } else {
      // Standard CSV with all details
      const headers = ['Date', 'Description', 'Merchant', 'Amount', 'Type', 'Category', 'Status'];
      const rows = filteredTransactions.map(t => [
        safeFormatDate(t.date),
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${(t.merchant || '').replace(/"/g, '""')}"`,
        t.amount.toFixed(2),
        t.type || '',
        t.category || '',
        t.status || ''
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      filename = `taxtrack-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      
      toast({
        title: "Export Complete",
        description: `Exported ${filteredTransactions.length} transactions.`,
      });
    }

    // Download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
            <p className="text-muted-foreground">
              Manage your business finances and track tax liability.
            </p>
          </div>
          
          <Select 
            value={filters.dateRange} 
            onValueChange={(value) => setFilters(prev => ({ ...prev, dateRange: value as DateFilter }))}
          >
            <SelectTrigger className="w-[200px] h-9" data-testid="select-date-range-quick">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="max-h-[400px]">
              <SelectGroup>
                <SelectLabel>Quick Filters</SelectLabel>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              </SelectGroup>
              {taxYears.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Tax Year {taxYears[0]}</SelectLabel>
                    <SelectItem value={`tax-year-${taxYears[0]}`}>Current Tax Year</SelectItem>
                    <SelectItem value={`mtd-q1-${taxYears[0]}`}>MTD Q1 (6 Apr - 5 Jul)</SelectItem>
                    <SelectItem value={`mtd-q2-${taxYears[0]}`}>MTD Q2 (6 Apr - 5 Oct)</SelectItem>
                    <SelectItem value={`mtd-q3-${taxYears[0]}`}>MTD Q3 (6 Apr - 5 Jan)</SelectItem>
                    <SelectItem value={`mtd-q4-${taxYears[0]}`}>MTD Q4 (6 Apr - 5 Apr)</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                </>
              )}
              {taxYears.slice(1).map((taxYear) => (
                <SelectItem key={taxYear} value={`tax-year-${taxYear}`}>Tax Year {taxYear}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <StatCards 
          transactions={filteredTransactions} 
          dateLabel={filters.dateRange}
        />

        <VATTracker />

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
          <TransactionChart 
            transactions={filteredTransactions} 
            dateRange={dateRange}
          />
        </div>

        {pendingTransactions.length > 0 && (
          <PendingPaymentsTable
            transactions={pendingTransactions}
            onUpdateTransaction={handleTransactionUpdate}
            onRefresh={refetch}
          />
        )}

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
