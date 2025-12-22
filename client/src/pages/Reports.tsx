import { useMemo, useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_TRANSACTIONS } from "@/lib/mockData";
import { Transaction } from "@/lib/types";
import { startOfMonth, subMonths, startOfYear, endOfYear, subYears, isWithinInterval, parseISO, endOfMonth, format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TaxSummary } from "@/components/reports/TaxSummary";
import { useTransactions } from "@/lib/queries";
import { useDataMode } from "@/lib/dataContext";
import { useQuery } from "@tanstack/react-query";

export default function Reports() {
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

  // Set default date range to most recent tax year once loaded
  useEffect(() => {
    if (taxYears.length > 0 && !hasInitializedTaxYear) {
      setDateRange(`tax-year-${taxYears[0]}`);
      setHasInitializedTaxYear(true);
    }
  }, [taxYears, hasInitializedTaxYear]);
  
  const transactions = useMockData ? MOCK_TRANSACTIONS : apiTransactions;

  // Helper to get date range object
  const getFilterDateRange = (filter: string) => {
    const now = new Date();
    
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
      case 'year-to-date':
        return { start: startOfYear(now), end: now };
      default:
        // Default to current tax year
        const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        return { start: new Date(currentYear, 3, 6), end: new Date(currentYear + 1, 3, 5, 23, 59, 59) };
    }
  };

  const getYearLabel = (filter: string) => {
     if (filter.startsWith('tax-year-')) {
       return filter.replace('tax-year-', '');
     }
     // Default to current tax year
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

  const financials = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const expenseCategories: Record<string, number> = {};

    filteredTransactions.forEach(t => {
      if (t.type === 'Business') {
        const amount = Number(t.amount);
        if (t.businessType === 'Income') {
          income += amount;
        } else if (t.businessType === 'Expense') {
          expenses += Math.abs(amount);
          
          if (t.category) {
            expenseCategories[t.category] = (expenseCategories[t.category] || 0) + Math.abs(amount);
          }
        }
      }
    });

    const netProfit = income - expenses;
    
    // Simple UK Tax Calc (Mock)
    // Personal Allowance: 12,570
    // Basic (20%): 12,571 - 50,270
    // Higher (40%): 50,271 - 125,140
    // Additional (45%): 125,140+
    
    let taxableIncome = Math.max(0, netProfit - 12570);
    let taxEstimate = 0;
    
    if (taxableIncome > 0) {
      // Basic rate band size: 37,700 (50270 - 12570)
      const basicRateLimit = 37700;
      
      const basicTaxable = Math.min(taxableIncome, basicRateLimit);
      taxEstimate += basicTaxable * 0.20;
      
      if (taxableIncome > basicRateLimit) {
         const higherTaxable = taxableIncome - basicRateLimit;
         // Assume no additional rate for simplicity in this quick calc, or add it:
         // For now, flat 40% above basic for simplicity in this view
         taxEstimate += higherTaxable * 0.40;
      }
    }

    return {
      income,
      expenses,
      netProfit,
      taxEstimate,
      expenseCategories
    };
  }, [filteredTransactions]);

  const expenseData = useMemo(() => {
    return Object.entries(financials.expenseCategories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [financials]);

  const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

  const monthlyData = useMemo(() => {
     // Group by month
     const months: Record<string, { name: string, income: number, expenses: number, profit: number }> = {};
     
     filteredTransactions.forEach(t => {
       if (t.type !== 'Business') return;
       const date = parseISO(t.date);
       const key = format(date, 'yyyy-MM');
       const name = format(date, 'MMM');
       
       if (!months[key]) months[key] = { name, income: 0, expenses: 0, profit: 0 };
       
       const amount = Number(t.amount);
       if (t.businessType === 'Income') {
         months[key].income += amount;
         months[key].profit += amount;
       } else if (t.businessType === 'Expense') {
         months[key].expenses += Math.abs(amount);
         months[key].profit -= Math.abs(amount);
       }
     });

     return Object.keys(months).sort().map(k => months[k]);
  }, [filteredTransactions]);

  if (isLoading && !useMockData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-muted-foreground">Loading data...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
            <p className="text-muted-foreground">
              Financial performance and tax estimation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">£{financials.income.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">£{financials.expenses.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">£{financials.netProfit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Est. Tax Owed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">£{financials.taxEstimate.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
              <p className="text-xs text-muted-foreground mt-1">Based on UK bands</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
           <Card>
            <CardHeader>
              <CardTitle>Profit & Loss</CardTitle>
              <CardDescription>Monthly breakdown of income vs expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `£${value}`} />
                    <Tooltip 
                      formatter={(value: number) => [`£${value.toLocaleString()}`, '']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Expense Breakdown</CardTitle>
              <CardDescription>Where your money is going</CardDescription>
            </CardHeader>
            <CardContent>
              {expenseData.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {expenseData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm text-muted-foreground">£{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">No expense data for this period</div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <TaxSummary transactions={filteredTransactions} yearLabel={getYearLabel(dateRange)} />

        <Card>
            <CardHeader>
              <CardTitle>Profit & Loss Statement</CardTitle>
              <CardDescription>Detailed financial statement</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 border-b pb-4">
                        <div className="font-semibold">Revenue</div>
                        <div className="text-right font-semibold">£{financials.income.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="font-medium text-muted-foreground">Operating Expenses</div>
                        {expenseData.map((item) => (
                             <div key={item.name} className="grid grid-cols-2 gap-4 pl-4 text-sm">
                                <div>{item.name}</div>
                                <div className="text-right text-red-500">-£{item.value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                             </div>
                        ))}
                        <div className="grid grid-cols-2 gap-4 border-t pt-2 font-medium">
                            <div>Total Expenses</div>
                            <div className="text-right text-red-600">-£{financials.expenses.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4 text-lg font-bold">
                        <div>Net Profit</div>
                        <div className="text-right">£{financials.netProfit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
            </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
