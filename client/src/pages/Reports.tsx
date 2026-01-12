import { useMemo, useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { MOCK_TRANSACTIONS } from "@/lib/mockData";
import { parseISO, isWithinInterval, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { useTransactions } from "@/lib/queries";
import { useDataMode } from "@/lib/dataContext";
import { useQuery } from "@tanstack/react-query";
import { SA103FReport } from "@/components/reports/SA103FReport";
import { ProfitLossReport } from "@/components/reports/ProfitLossReport";
import { ExpenseBreakdownReport } from "@/components/reports/ExpenseBreakdownReport";
import { TaxCalculatorReport } from "@/components/reports/TaxCalculatorReport";
import { VATSummaryReport } from "@/components/reports/VATSummaryReport";
import { MileageReport } from "@/components/reports/MileageReport";
import { MTDQuarterlyReport } from "@/components/reports/MTDQuarterlyReport";
import { UseOfHomeReport } from "@/components/reports/UseOfHomeReport";
import { PaymentOnAccountReport } from "@/components/reports/PaymentOnAccountReport";
import { TaxPaymentPlanner } from "@/components/reports/TaxPaymentPlanner";
import { CustomerProfitabilityReport } from "@/components/reports/CustomerProfitabilityReport";
import { Calendar } from "lucide-react";

const REPORT_TITLES: Record<string, { title: string; getDescription: (yearLabel: string) => string }> = {
  'sa103f': { title: 'Self-Assessment Summary', getDescription: (y) => `Tax Year ${y} (6 April ${y.split('-')[0]} - 5 April 20${y.split('-')[1]})` },
  'profit-loss': { title: 'Profit & Loss Statement', getDescription: (y) => `Tax Year ${y}` },
  'expenses': { title: 'Expense Breakdown', getDescription: (y) => `Tax Year ${y}` },
  'tax-calculator': { title: 'Tax Calculator', getDescription: (y) => `UK Income Tax & National Insurance (Tax Year ${y})` },
  'vat': { title: 'VAT Summary', getDescription: (y) => `VAT threshold tracking (Tax Year ${y})` },
  'mileage': { title: 'Mileage Report', getDescription: (y) => `Business mileage allowance tracker (Tax Year ${y})` },
  'mtd-quarterly': { title: 'MTD Quarterly Summary', getDescription: (y) => `Making Tax Digital quarterly updates (Tax Year ${y})` },
  'use-of-home': { title: 'Use of Home', getDescription: (y) => `Home office expense calculator (Tax Year ${y})` },
  'payment-on-account': { title: 'Payment on Account', getDescription: (y) => `HMRC payment tracker (Tax Year ${y})` },
  'payment-planner': { title: 'Tax Payment Planner', getDescription: (y) => `Budget your tax payments (Tax Year ${y})` },
  'customer-profitability': { title: 'Customer Profitability', getDescription: (y) => `Revenue breakdown by client (Tax Year ${y})` },
};

export default function Reports() {
  const [, params] = useRoute("/reports/:reportId");
  const [, setLocation] = useLocation();
  const reportId = params?.reportId || 'sa103f';
  
  const [dateRange, setDateRange] = useState('this-month');
  const [hasInitializedTaxYear, setHasInitializedTaxYear] = useState(false);

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
    if (!params?.reportId) {
      setLocation('/reports/sa103f', { replace: true });
    }
  }, [params?.reportId, setLocation]);
  
  const transactions = useMockData ? MOCK_TRANSACTIONS : apiTransactions;

  const getFilterDateRange = (filter: string) => {
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
    if (filter.startsWith('mtd-q')) {
      const match = filter.match(/mtd-q(\d)-(\d{4}-\d{2})/);
      if (match) {
        return match[2]; // Returns the tax year portion
      }
    }
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

  const yearLabel = getYearLabel(dateRange);

  const renderReport = () => {
    switch (reportId) {
      case 'sa103f':
        return <SA103FReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'profit-loss':
        return <ProfitLossReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'expenses':
        return <ExpenseBreakdownReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'tax-calculator':
        return <TaxCalculatorReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'vat':
        return <VATSummaryReport transactions={filteredTransactions} allTransactions={transactions} yearLabel={yearLabel} />;
      case 'mileage':
        return <MileageReport yearLabel={yearLabel} />;
      case 'mtd-quarterly':
        return <MTDQuarterlyReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'use-of-home':
        return <UseOfHomeReport yearLabel={yearLabel} />;
      case 'payment-on-account':
        return <PaymentOnAccountReport transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'payment-planner':
        return <TaxPaymentPlanner transactions={filteredTransactions} yearLabel={yearLabel} />;
      case 'customer-profitability':
        return <CustomerProfitabilityReport transactions={filteredTransactions} yearLabel={yearLabel} />;
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

  const currentReportInfo = REPORT_TITLES[reportId] || REPORT_TITLES['sa103f'];

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{currentReportInfo.title}</h2>
            <p className="text-sm text-muted-foreground">
              {currentReportInfo.getDescription(yearLabel)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[220px]" data-testid="select-report-period">
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
                      <SelectItem value={`tax-year-${taxYears[0]}`}>Full Year (6 Apr - 5 Apr)</SelectItem>
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
        </div>

        <div className="flex-1 overflow-y-auto">
          {renderReport()}
        </div>
      </div>
    </DashboardLayout>
  );
}
