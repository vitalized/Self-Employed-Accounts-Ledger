import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction, isIncludedInProfit } from "@/lib/types";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { parseISO, format } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProfitLossReportProps {
  transactions: Transaction[];
  yearLabel: string;
}

interface ClientIncomeData {
  clientName: string;
  total: number;
  transactions: Transaction[];
}

export function ProfitLossReport({ transactions, yearLabel }: ProfitLossReportProps) {
  const { financials, monthlyData, expenseData, clientIncomeData } = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const expenseCategories: Record<string, number> = {};
    const months: Record<string, { name: string, income: number, expenses: number, profit: number }> = {};
    const clientIncome: Record<string, { total: number; transactions: Transaction[] }> = {};

    transactions.forEach(t => {
      if (t.type === 'Business' && isIncludedInProfit(t)) {
        const amount = Number(t.amount);
        const date = parseISO(t.date);
        const key = format(date, 'yyyy-MM');
        const name = format(date, 'MMM');
        
        if (!months[key]) months[key] = { name, income: 0, expenses: 0, profit: 0 };

        if (t.businessType === 'Income') {
          income += amount;
          months[key].income += amount;
          months[key].profit += amount;

          const clientName = t.merchant && t.merchant.trim() !== '' ? t.merchant : 'Miscellaneous';
          if (!clientIncome[clientName]) {
            clientIncome[clientName] = { total: 0, transactions: [] };
          }
          clientIncome[clientName].total += amount;
          clientIncome[clientName].transactions.push(t);
        } else if (t.businessType === 'Expense') {
          expenses += Math.abs(amount);
          months[key].expenses += Math.abs(amount);
          months[key].profit -= Math.abs(amount);
          
          if (t.category) {
            expenseCategories[t.category] = (expenseCategories[t.category] || 0) + Math.abs(amount);
          }
        }
      }
    });

    const clientIncomeData: ClientIncomeData[] = Object.entries(clientIncome)
      .map(([clientName, data]) => ({
        clientName,
        total: data.total,
        transactions: data.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }))
      .sort((a, b) => b.total - a.total);

    return {
      financials: { income, expenses, netProfit: income - expenses },
      monthlyData: Object.keys(months).sort().map(k => months[k]),
      expenseData: Object.entries(expenseCategories)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      clientIncomeData
    };
  }, [transactions]);

  const cumulativeData = monthlyData.reduce((acc, item, i) => {
    const prev = acc[i - 1]?.cumulative || 0;
    acc.push({ ...item, cumulative: prev + item.profit });
    return acc;
  }, [] as any[]);

  const profitMargin = financials.income > 0 
    ? ((financials.netProfit / financials.income) * 100).toFixed(1) 
    : '0';

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">£{financials.income.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">£{financials.expenses.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{financials.netProfit.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profitMargin}%</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Income vs Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `£${value}`} width={60} />
                    <Tooltip 
                      formatter={(value: number) => [`£${value.toLocaleString()}`, '']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cumulative Profit Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `£${value}`} width={60} />
                    <Tooltip 
                      formatter={(value: number) => [`£${value.toLocaleString()}`, '']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="cumulative" name="Cumulative Profit" stroke="#0ea5e9" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detailed P&L Statement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="font-semibold text-lg">Revenue by Client</div>
                {clientIncomeData.length > 0 ? (
                  <Accordion type="multiple" className="w-full">
                    {clientIncomeData.map((client, index) => (
                      <AccordionItem key={client.clientName} value={`client-${index}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex justify-between w-full pr-4">
                            <span className="font-medium">{client.clientName}</span>
                            <span className="text-green-600 font-semibold">
                              £{client.total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {client.transactions.map((t) => (
                                <TableRow key={t.id}>
                                  <TableCell className="text-muted-foreground">
                                    {format(parseISO(t.date), 'dd MMM yyyy')}
                                  </TableCell>
                                  <TableCell>{t.description}</TableCell>
                                  <TableCell className="text-right text-green-600">
                                    £{Number(t.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-muted-foreground pl-4 text-sm">No income transactions</div>
                )}
                <div className="grid grid-cols-2 gap-4 border-t pt-2 font-medium">
                  <div>Total Revenue</div>
                  <div className="text-right text-green-600">£{financials.income.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium text-muted-foreground">Operating Expenses by Category</div>
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
    </div>
  );
}
