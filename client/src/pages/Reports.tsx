import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_TRANSACTIONS } from "@/lib/mockData";
import { Transaction } from "@/lib/types";
import { startOfMonth, subMonths, startOfYear, endOfYear, subYears, isWithinInterval, parseISO, endOfMonth, format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TaxSummary } from "@/components/reports/TaxSummary";
import { useTransactions } from "@/lib/queries";

export default function Reports() {
  const [dateRange, setDateRange] = useState('tax-year-current');
  const { data: transactions = [], isLoading } = useTransactions();

  // Helper to get date range object
  const getFilterDateRange = (filter: string) => {
    const now = new Date(); // Mocking "today" context if needed, but using real dates for logic
    // Simplified Tax Year Logic (UK Tax year starts April 6th)
    // For this prototype, using April 1 - March 31
    
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
      case 'tax-year-current':
        return { start: new Date(2025, 3, 1), end: new Date(2026, 2, 31) };
      case 'tax-year-previous':
        return { start: new Date(2024, 3, 1), end: new Date(2025, 2, 31) };
      default:
        return { start: new Date(2025, 3, 1), end: new Date(2026, 2, 31) };
    }
  };

  const getYearLabel = (filter: string) => {
     if (filter === 'tax-year-current') return '2025-26';
     if (filter === 'tax-year-previous') return '2024-25';
     return '2025-26'; // Fallback
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

  if (isLoading) {
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
                <SelectItem value="tax-year-current">Tax Year (2025-26)</SelectItem>
                <SelectItem value="tax-year-previous">Tax Year (2024-25)</SelectItem>
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

        <div className="grid gap-4 md:grid-cols-2">
           <Card className="col-span-1">
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

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Expense Breakdown</CardTitle>
              <CardDescription>Where your money is going</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center">
                {expenseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expenseData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `£${value.toLocaleString()}`} />
                      <Legend layout="vertical" verticalAlign="middle" align="right" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                   <div className="text-muted-foreground text-sm">No expense data for this period</div>
                )}
              </div>
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
