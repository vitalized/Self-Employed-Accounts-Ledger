import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { ArrowUpRight, ArrowDownRight, PoundSterling, Wallet, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StatCardsProps {
  transactions: Transaction[];
  dateLabel: string;
}

const calculateUKTax = (profit: number) => {
  if (profit <= 12570) return 0;
  
  let tax = 0;
  // Taxable income is profit minus personal allowance?
  // The table says "Taxable Income" band.
  // Usually Personal Allowance is a 0% band on the first 12,570 of *Net Income*.
  // So we treat the first 12,570 of profit as tax-free.
  
  // Band 1: Personal Allowance (0% on first £12,570)
  // Covered by the initial check for simplicity, but strictly:
  // 0 - 12,570 = 0%
  
  // Band 2: Basic Rate (20% on £12,571 to £50,270)
  // Width: 37,700
  const basicRateWidth = 50270 - 12570;
  const taxableAtBasic = Math.min(Math.max(profit - 12570, 0), basicRateWidth);
  tax += taxableAtBasic * 0.20;
  
  // Band 3: Higher Rate (40% on £50,271 to £125,140)
  // Width: 74,870
  const higherRateWidth = 125140 - 50270;
  const taxableAtHigher = Math.min(Math.max(profit - 50270, 0), higherRateWidth);
  tax += taxableAtHigher * 0.40;
  
  // Band 4: Additional Rate (45% over £125,140)
  const taxableAtAdditional = Math.max(profit - 125140, 0);
  tax += taxableAtAdditional * 0.45;

  return tax;
};

export function StatCards({ transactions, dateLabel }: StatCardsProps) {
  // Calculate totals
  const businessIncome = transactions
    .filter(t => t.type === 'Business' && t.businessType === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const businessExpense = transactions
    .filter(t => t.type === 'Business' && t.businessType === 'Expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const profit = businessIncome - businessExpense;
  const estimatedTax = calculateUKTax(profit);

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
          <div className="flex items-center space-x-2">
            <CardTitle className="text-sm font-medium">Est. Tax Owed</CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Calculated using UK Income Tax bands</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <PoundSterling className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">£{estimatedTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground">
            Based on UK Tax Bands
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
