import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ExpenseBreakdownReportProps {
  transactions: Transaction[];
  yearLabel: string;
}

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#64748b', '#14b8a6', '#6366f1'];

export function ExpenseBreakdownReport({ transactions, yearLabel }: ExpenseBreakdownReportProps) {
  const { totalExpenses, expenseData, avgMonthlyExpense } = useMemo(() => {
    let total = 0;
    const categories: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.type === 'Business' && t.businessType === 'Expense') {
        const amount = Math.abs(Number(t.amount));
        total += amount;
        if (t.category) {
          categories[t.category] = (categories[t.category] || 0) + amount;
        } else {
          categories['Uncategorized'] = (categories['Uncategorized'] || 0) + amount;
        }
      }
    });

    const data = Object.entries(categories)
      .map(([name, value]) => ({ name, value, percentage: total > 0 ? (value / total * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.value - a.value);

    return {
      totalExpenses: total,
      expenseData: data,
      avgMonthlyExpense: Math.round(total / 12)
    };
  }, [transactions]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Expense Breakdown</h2>
        <p className="text-muted-foreground">Tax Year {yearLabel}</p>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">£{totalExpenses.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{expenseData.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg. Monthly</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">£{avgMonthlyExpense.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
            <CardDescription>Where your money is going</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[350px] flex items-center justify-center">
                {expenseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ percentage }) => `${percentage}%`}
                      >
                        {expenseData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `£${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground text-sm">No expense data for this period</div>
                )}
              </div>
              
              <div className="flex flex-col h-[350px]">
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {expenseData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">{item.percentage}%</span>
                        <span className="font-semibold text-sm">£{item.value.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {expenseData.length > 0 && (
                  <div className="flex items-center justify-between py-3 border-t-2 font-bold mt-2 bg-card flex-shrink-0">
                    <span>Total Expenses</span>
                    <span className="text-red-600">£{totalExpenses.toLocaleString()}</span>
                  </div>
                )}
                {expenseData.length === 0 && (
                  <div className="text-muted-foreground text-center py-8">
                    No expenses recorded for this period
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Expense Categories</CardTitle>
            <CardDescription>Highest spending areas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseData.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `£${value}`} />
                  <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={120} />
                  <Tooltip formatter={(value: number) => [`£${value.toLocaleString()}`, '']} />
                  <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
