import { useMemo, useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_TRANSACTIONS } from "@/lib/mockData";
import { parseISO, isWithinInterval, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { useTransactions } from "@/lib/queries";
import { useDataMode } from "@/lib/dataContext";
import { useQuery } from "@tanstack/react-query";
import { ReportsLayout, REPORT_DEFINITIONS } from "@/components/reports/ReportsLayout";
import { SA103FReport } from "@/components/reports/SA103FReport";
import { ProfitLossReport } from "@/components/reports/ProfitLossReport";
import { ExpenseBreakdownReport } from "@/components/reports/ExpenseBreakdownReport";
import { TaxCalculatorReport } from "@/components/reports/TaxCalculatorReport";
import { VATSummaryReport } from "@/components/reports/VATSummaryReport";
import { Calendar } from "lucide-react";

export default function Reports() {
  const [dateRange, setDateRange] = useState('this-month');
  const [hasInitializedTaxYear, setHasInitializedTaxYear] = useState(false);
  const [selectedReport, setSelectedReport] = useState('sa103f');
  const [pinnedReports, setPinnedReports] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pinnedReports');
      return saved ? JSON.parse(saved) : ['sa103f'];
    } catch {
      return ['sa103f'];
    }
  });

  const { useMockData } = useDataMode();
  const { data: apiTransactions = [], isLoading } = useTransactions();
  
  const { data: taxYears = [] } = useQuery<string[]>({
    queryKey: ["/api/tax-years"],
    queryFn: async () => {
      const res = await fetch("/api/tax-years");
      if (!res.ok) throw new Error("Failed to fetch tax years");
      return res.json();
    },
  });

  useEffect(() => {
    if (taxYears.length > 0 && !hasInitializedTaxYear) {
      setDateRange(`tax-year-${taxYears[0]}`);
      setHasInitializedTaxYear(true);
    }
  }, [taxYears, hasInitializedTaxYear]);

  useEffect(() => {
    localStorage.setItem('pinnedReports', JSON.stringify(pinnedReports));
  }, [pinnedReports]);
  
  const transactions = useMockData ? MOCK_TRANSACTIONS : apiTransactions;

  const getFilterDateRange = (filter: string) => {
    const now = new Date();
    
    if (filter.startsWith('tax-year-')) {
      const taxYearStr = filter.replace('tax-year-', '');
      const startYear = parseInt(taxYearStr.split('-')[0]);
      if (!isNaN(startYear)) {
        return { 
          start: new Date(startYear, 3, 6),
          end: new Date(startYear + 1, 3, 5, 23, 59, 59)
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
      case 'year-to-date':
        return { start: startOfYear(now), end: now };
      default:
        const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        return { start: new Date(currentYear, 3, 6), end: new Date(currentYear + 1, 3, 5, 23, 59, 59) };
    }
  };

  const getYearLabel = (filter: string) => {
    if (filter.startsWith('tax-year-')) {
      return filter.replace('tax-year-', '');
    }
    const now = new Date();
    const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  };

  const currentRange = getFilterDateRange(dateRange);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = parseISO(t.date);
      return isWithinInterval(tDate, currentRange);
    });
  }, [transactions, currentRange]);

  const handleTogglePinned = (reportId: string) => {
    setPinnedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const renderReport = () => {
    const yearLabel = getYearLabel(dateRange);
    
    switch (selectedReport) {
      case 'sa103f':
        return <SA103FReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'profit-loss':
        return <ProfitLossReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'expense-breakdown':
        return <ExpenseBreakdownReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'tax-calculator':
        return <TaxCalculatorReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'vat-summary':
        return <VATSummaryReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      default:
        return <SA103FReport transactions={filteredTransactions} yearLabel={yearLabel} />;
    }
  };

  if (isLoading && !useMockData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-muted-foreground">Loading data...</div>
        </div>
      </DashboardLayout>
    );
  }

  const currentReportDef = REPORT_DEFINITIONS.find(r => r.id === selectedReport);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
            <p className="text-sm text-muted-foreground">
              {currentReportDef?.description || 'Financial reports and analysis'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]" data-testid="select-report-period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                {taxYears.map((taxYear) => (
                  <SelectItem key={taxYear} value={`tax-year-${taxYear}`}>
                    Tax Year ({taxYear})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ReportsLayout
          selectedReport={selectedReport}
          onSelectReport={setSelectedReport}
          pinnedReports={pinnedReports}
          onTogglePinned={handleTogglePinned}
        >
          {renderReport()}
        </ReportsLayout>
      </div>
    </DashboardLayout>
  );
}
