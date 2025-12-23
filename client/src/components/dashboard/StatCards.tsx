import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { ArrowUpRight, ArrowDownRight, PoundSterling, Wallet, Info, BarChart3, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StatCardsProps {
  transactions: Transaction[];
  dateLabel: string;
}

interface TaxBreakdown {
  incomeTax: number;
  class4NI: number;
  class2NI: number;
  totalTax: number;
  personalAllowance: number;
  basicRateTax: number;
  higherRateTax: number;
  additionalRateTax: number;
  effectiveRate: number;
}

const calculateFullTaxBreakdown = (profit: number): TaxBreakdown => {
  const personalAllowance = Math.min(profit, 12570);
  
  // Income Tax calculation
  let incomeTax = 0;
  let basicRateTax = 0;
  let higherRateTax = 0;
  let additionalRateTax = 0;
  
  if (profit > 12570) {
    const basicRateWidth = 50270 - 12570;
    const taxableAtBasic = Math.min(Math.max(profit - 12570, 0), basicRateWidth);
    basicRateTax = taxableAtBasic * 0.20;
    
    const higherRateWidth = 125140 - 50270;
    const taxableAtHigher = Math.min(Math.max(profit - 50270, 0), higherRateWidth);
    higherRateTax = taxableAtHigher * 0.40;
    
    const taxableAtAdditional = Math.max(profit - 125140, 0);
    additionalRateTax = taxableAtAdditional * 0.45;
    
    incomeTax = basicRateTax + higherRateTax + additionalRateTax;
  }
  
  // Class 4 NI: 6% on profits between £12,570 and £50,270, 2% above
  let class4NI = 0;
  if (profit > 12570) {
    const class4LowerBand = Math.min(Math.max(profit - 12570, 0), 50270 - 12570);
    class4NI += class4LowerBand * 0.06;
    if (profit > 50270) {
      class4NI += (profit - 50270) * 0.02;
    }
  }
  
  // Class 2 NI: £3.45/week if profits over £12,570 (approx £179.40/year)
  const class2NI = profit > 12570 ? 179.40 : 0;
  
  const totalTax = incomeTax + class4NI + class2NI;
  const effectiveRate = profit > 0 ? (totalTax / profit) * 100 : 0;
  
  return {
    incomeTax,
    class4NI,
    class2NI,
    totalTax,
    personalAllowance,
    basicRateTax,
    higherRateTax,
    additionalRateTax,
    effectiveRate
  };
};

const formatDateLabel = (label: string) => {
  if (!label) return '';
  return label
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function StatCards({ transactions, dateLabel }: StatCardsProps) {
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  
  // Calculate totals
  const businessIncome = transactions
    .filter(t => t.type === 'Business' && t.businessType === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const businessExpense = transactions
    .filter(t => t.type === 'Business' && t.businessType === 'Expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const profit = businessIncome - businessExpense;
  const taxBreakdown = calculateFullTaxBreakdown(profit);
  
  const formatCurrency = (value: number) => `£${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-0">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Business Profit</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(profit)}</div>
            <p className="text-xs text-muted-foreground">
              {formatDateLabel(dateLabel)}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Business Income</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(businessIncome)}</div>
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
            <div className="text-2xl font-bold text-red-600">{formatCurrency(businessExpense)}</div>
            <p className="text-xs text-muted-foreground">
              Deductibles
            </p>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 cursor-pointer transition-all",
            showTaxBreakdown && "border-amber-500 border-2 border-b-0 rounded-b-none"
          )}
          onClick={() => setShowTaxBreakdown(!showTaxBreakdown)}
          data-testid="card-tax-owed"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-sm font-medium">Est. Tax Owed</CardTitle>
              <Tooltip>
                <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click to see detailed breakdown</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              {showTaxBreakdown ? (
                <ChevronUp className="h-4 w-4 text-amber-500" />
              ) : (
                <BarChart3 className="h-4 w-4 text-amber-500" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(taxBreakdown.totalTax)}</div>
            <p className="text-xs text-muted-foreground">
              {taxBreakdown.effectiveRate.toFixed(1)}% effective rate
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        showTaxBreakdown ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}>
        <Card className="border-amber-500 border-2 border-t-0 rounded-t-none bg-slate-50 dark:bg-slate-900">
          <CardContent className="pt-4">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tax Components</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Income Tax</span>
                    <span className="font-medium">{formatCurrency(taxBreakdown.incomeTax)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Class 4 NI</span>
                    <span className="font-medium">{formatCurrency(taxBreakdown.class4NI)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Class 2 NI</span>
                    <span className="font-medium">{formatCurrency(taxBreakdown.class2NI)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Total Tax Due</span>
                    <span className="text-amber-600">{formatCurrency(taxBreakdown.totalTax)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Income Tax Bands</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Personal Allowance</span>
                    <span className="font-medium text-green-600">{formatCurrency(taxBreakdown.personalAllowance)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Basic Rate (20%)</span>
                    <span className="font-medium">{formatCurrency(taxBreakdown.basicRateTax)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Higher Rate (40%)</span>
                    <span className="font-medium">{formatCurrency(taxBreakdown.higherRateTax)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Taxable Profit</span>
                    <span className="font-medium">{formatCurrency(profit)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Tax</span>
                    <span className="font-medium">{formatCurrency(taxBreakdown.totalTax)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Effective Rate</span>
                    <span className="text-amber-600">{taxBreakdown.effectiveRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Take Home</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Gross Profit</span>
                    <span className="font-medium">{formatCurrency(profit)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Less Tax</span>
                    <span className="font-medium text-red-500">-{formatCurrency(taxBreakdown.totalTax)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Net Income</span>
                    <span className="text-green-600">{formatCurrency(profit - taxBreakdown.totalTax)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
