import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { ComposedChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isSameMonth } from "date-fns";

interface TransactionChartProps {
  transactions: Transaction[];
  dateRange: { start: Date; end: Date };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="mb-2 text-sm font-medium">{label}</div>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-1))]" />
            <span className="text-muted-foreground">Income:</span>
            <span className="ml-auto font-medium text-foreground">£{data.Income.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[hsl(var(--chart-2))]" />
            <span className="text-muted-foreground">Expenses:</span>
            <span className="ml-auto font-medium text-foreground">£{Math.abs(data.Expenses).toLocaleString()}</span>
          </div>
          <div className="mt-1 border-t pt-1 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-foreground" />
            <span className="font-medium">Profit:</span>
            <span className="ml-auto font-bold">£{data.Profit.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

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
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
              <Bar dataKey="Income" stackId="stack" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="Expenses" stackId="stack" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} barSize={40} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
