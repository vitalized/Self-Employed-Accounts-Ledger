import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { ComposedChart, Line, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isSameMonth } from "date-fns";

interface TransactionChartProps {
  transactions: Transaction[];
  dateRange: { start: Date; end: Date };
}

export function TransactionChart({ transactions, dateRange }: TransactionChartProps) {
  // Generate months array for the range
  const months = eachMonthOfInterval({
    start: dateRange.start,
    end: dateRange.end
  });

  const data = months.map(month => {
    const monthTransactions = transactions.filter(t => 
      isSameMonth(parseISO(t.date), month) && t.type === 'Business'
    );

    const income = monthTransactions
      .filter(t => t.businessType === 'Income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = monthTransactions
      .filter(t => t.businessType === 'Expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      name: format(month, 'MMM yy'),
      Income: income,
      Expenses: expense,
      Profit: income + expense
    };
  });

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Cash Flow</CardTitle>
      </CardHeader>
      <CardContent className="pl-2">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} stackOffset="sign">
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
              <XAxis 
                dataKey="name" 
                stroke="#888888" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `£${value}`}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="Income" stackId="stack" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="Expenses" stackId="stack" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} barSize={40} />
              <Line 
                type="monotone" 
                dataKey="Profit" 
                stroke="hsl(var(--foreground))" 
                strokeWidth={2}
                dot={{ r: 4, fill: "hsl(var(--foreground))", strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
