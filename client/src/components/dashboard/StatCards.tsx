import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { ArrowUpRight, ArrowDownRight, PoundSterling, Wallet } from "lucide-react";

interface StatCardsProps {
  transactions: Transaction[];
  dateLabel: string;
}

export function StatCards({ transactions, dateLabel }: StatCardsProps) {
  // Calculate totals
  const businessIncome = transactions
    .filter(t => t.type === 'Business' && t.businessType === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const businessExpense = transactions
    .filter(t => t.type === 'Business' && t.businessType === 'Expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const profit = businessIncome - businessExpense;

  // Simple UK Tax Estimation (Mock logic)
  // Personal Allowance £12,570 (Annual) -> simplistic pro-rating or just assume annual for "Tax Year" mode
  // Basic Rate 20%
  // Higher Rate 40%
  
  // For this prototype, let's just do a flat 20% on profit > 0 for simplicity, or slightly more complex if needed.
  // Assuming "Profit" is taxable.
  const estimatedTax = profit > 0 ? profit * 0.2 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Business Profit</CardTitle>
          <Wallet className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">£{profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground">
            {dateLabel}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Business Income</CardTitle>
          <ArrowUpRight className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">£{businessIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground">
            Gross Revenue
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Business Expenses</CardTitle>
          <ArrowDownRight className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">£{businessExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground">
            Deductibles
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Est. Tax Owed</CardTitle>
          <PoundSterling className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">£{estimatedTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground">
            Based on 20% Basic Rate
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
