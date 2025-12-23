import { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { ArrowUpRight, ArrowDownRight, Wallet, ChevronUp, ChevronDown } from "lucide-react";
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

type TabType = 'profit' | 'income' | 'expenses' | 'tax' | null;

const calculateFullTaxBreakdown = (profit: number): TaxBreakdown => {
  const personalAllowance = Math.min(profit, 12570);
  
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
  
  let class4NI = 0;
  if (profit > 12570) {
    const class4LowerBand = Math.min(Math.max(profit - 12570, 0), 50270 - 12570);
    class4NI += class4LowerBand * 0.06;
    if (profit > 50270) {
      class4NI += (profit - 50270) * 0.02;
    }
  }
  
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
  const [activeTab, setActiveTab] = useState<TabType>(null);
  const [displayedTab, setDisplayedTab] = useState<TabType>(null);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'collapsing' | 'expanding'>('idle');
  const [containerHeight, setContainerHeight] = useState<number | 'auto'>(0);
  const [reservedHeight, setReservedHeight] = useState<number | 'auto'>('auto');
  const [pendingTab, setPendingTab] = useState<TabType>(null);
  
  const profitRef = useRef<HTMLDivElement>(null);
  const incomeRef = useRef<HTMLDivElement>(null);
  const expensesRef = useRef<HTMLDivElement>(null);
  const taxRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const incomeTransactions = transactions.filter(t => t.type === 'Business' && t.businessType === 'Income');
  const expenseTransactions = transactions.filter(t => t.type === 'Business' && t.businessType === 'Expense');
  
  const businessIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const businessExpense = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const profit = businessIncome - businessExpense;
  const taxBreakdown = calculateFullTaxBreakdown(profit);
  
  const formatCurrency = (value: number) => `£${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getContentRef = useCallback((tab: TabType) => {
    switch (tab) {
      case 'profit': return profitRef;
      case 'income': return incomeRef;
      case 'expenses': return expensesRef;
      case 'tax': return taxRef;
      default: return null;
    }
  }, []);

  const measureHeight = useCallback((tab: TabType): number => {
    const ref = getContentRef(tab);
    if (ref?.current) {
      return ref.current.scrollHeight;
    }
    return 0;
  }, [getContentRef]);

  const toggleTab = useCallback((tab: TabType) => {
    if (animationPhase !== 'idle') return;
    const container = containerRef.current;
    const wrapper = wrapperRef.current;

    if (activeTab === tab) {
      // Closing the current tab
      const currentHeight = container?.getBoundingClientRect().height || measureHeight(displayedTab);
      flushSync(() => {
        setReservedHeight(currentHeight);
        setContainerHeight(currentHeight);
        setAnimationPhase('collapsing');
        setPendingTab(null);
      });
      void wrapper?.offsetHeight;
      setContainerHeight(0);
    } else if (activeTab === null) {
      // Opening a new tab from closed state
      flushSync(() => {
        setActiveTab(tab);
        setDisplayedTab(tab);
        setAnimationPhase('expanding');
        setContainerHeight(0);
        setReservedHeight(0);
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const newHeight = measureHeight(tab);
          setReservedHeight(newHeight);
          setContainerHeight(newHeight);
        });
      });
    } else {
      // Switching from one tab to another
      const currentHeight = container?.getBoundingClientRect().height || measureHeight(displayedTab);
      flushSync(() => {
        setReservedHeight(currentHeight);
        setContainerHeight(currentHeight);
        setPendingTab(tab);
        setAnimationPhase('collapsing');
      });
      void wrapper?.offsetHeight;
      setContainerHeight(0);
    }
  }, [activeTab, animationPhase, displayedTab, measureHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'height') return;

      if (animationPhase === 'collapsing') {
        if (pendingTab) {
          setActiveTab(pendingTab);
          setDisplayedTab(pendingTab);
          setAnimationPhase('expanding');
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const newHeight = measureHeight(pendingTab);
              // Use max of current reserved height and new height to prevent both:
              // - shrinking (longer→shorter): keeps larger height
              // - overflow (shorter→longer): grows to accommodate
              setReservedHeight(prev => 
                typeof prev === 'number' ? Math.max(prev, newHeight) : newHeight
              );
              setContainerHeight(newHeight);
            });
          });
          setPendingTab(null);
        } else {
          setActiveTab(null);
          setDisplayedTab(null);
          setReservedHeight('auto');
          setAnimationPhase('idle');
        }
      } else if (animationPhase === 'expanding') {
        setContainerHeight('auto');
        setReservedHeight('auto');
        setAnimationPhase('idle');
      }
    };

    container.addEventListener('transitionend', handleTransitionEnd);
    return () => container.removeEventListener('transitionend', handleTransitionEnd);
  }, [animationPhase, pendingTab, measureHeight]);

  const expensesByCategory = expenseTransactions.reduce((acc, t) => {
    const category = t.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + Math.abs(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const sortedExpenseCategories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const getCardClasses = (tab: TabType, baseColor: string, borderColor: string) => {
    const isActive = activeTab === tab;
    return cn(
      "cursor-pointer transition-all",
      isActive
        ? `border-t-2 border-l-2 border-r-2 border-b-0 ${borderColor} rounded-b-none ${baseColor} -mb-[18px] relative z-10`
        : "border border-slate-200 dark:border-slate-800"
    );
  };

  const isContentVisible = (tab: TabType) => {
    return displayedTab === tab;
  };

  return (
    <div className="space-y-0">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pb-4">
        <Card 
          className={getCardClasses('profit', 'bg-blue-50 dark:bg-blue-950', 'border-blue-500 dark:border-blue-500')}
          onClick={() => toggleTab('profit')}
          data-testid="card-profit"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Business Profit</CardTitle>
            {activeTab === 'profit' ? (
              <ChevronUp className="h-4 w-4 text-blue-500" />
            ) : (
              <Wallet className="h-4 w-4 text-blue-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(profit)}</div>
            <p className="text-xs text-muted-foreground">
              {formatDateLabel(dateLabel)}
            </p>
          </CardContent>
        </Card>
        
        <Card 
          className={getCardClasses('income', 'bg-emerald-50 dark:bg-emerald-950', 'border-emerald-500 dark:border-emerald-500')}
          onClick={() => toggleTab('income')}
          data-testid="card-income"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Business Income</CardTitle>
            {activeTab === 'income' ? (
              <ChevronUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(businessIncome)}</div>
            <p className="text-xs text-muted-foreground">
              Gross Revenue
            </p>
          </CardContent>
        </Card>
        
        <Card 
          className={getCardClasses('expenses', 'bg-red-50 dark:bg-red-950', 'border-red-500 dark:border-red-500')}
          onClick={() => toggleTab('expenses')}
          data-testid="card-expenses"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Business Expenses</CardTitle>
            {activeTab === 'expenses' ? (
              <ChevronUp className="h-4 w-4 text-red-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(businessExpense)}</div>
            <p className="text-xs text-muted-foreground">
              Deductibles
            </p>
          </CardContent>
        </Card>

        <Card 
          className={getCardClasses('tax', 'bg-amber-50 dark:bg-amber-950', 'border-amber-500 dark:border-amber-500')}
          onClick={() => toggleTab('tax')}
          data-testid="card-tax-owed"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Tax Owed</CardTitle>
            {activeTab === 'tax' ? (
              <ChevronUp className="h-4 w-4 text-amber-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-amber-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(taxBreakdown.totalTax)}</div>
            <p className="text-xs text-muted-foreground">
              {taxBreakdown.effectiveRate.toFixed(1)}% effective rate
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div 
        ref={wrapperRef}
        style={{ height: reservedHeight === 'auto' ? 'auto' : reservedHeight }}
      >
        <div 
          ref={containerRef}
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ height: containerHeight }}
        >
          <div ref={profitRef} className={cn(!isContentVisible('profit') && 'hidden')}>
          <Card className="border-2 border-blue-500 dark:border-blue-500 rounded-tl-none rounded-tr-xl rounded-b-xl bg-blue-50 dark:bg-blue-950">
            <CardContent className="pt-4">
              <div className="grid gap-12 md:grid-cols-3">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Calculation</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Income</span>
                      <span className="font-medium text-emerald-600">{formatCurrency(businessIncome)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Expenses</span>
                      <span className="font-medium text-red-500">-{formatCurrency(businessExpense)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-2">
                      <span>Net Profit</span>
                      <span className="text-blue-600">{formatCurrency(profit)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Margins</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Profit Margin</span>
                      <span className="font-medium">{businessIncome > 0 ? ((profit / businessIncome) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Expense Ratio</span>
                      <span className="font-medium">{businessIncome > 0 ? ((businessExpense / businessIncome) * 100).toFixed(1) : 0}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">After Tax</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Gross Profit</span>
                      <span className="font-medium">{formatCurrency(profit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Est. Tax</span>
                      <span className="font-medium text-red-500">-{formatCurrency(taxBreakdown.totalTax)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-2">
                      <span>Take Home</span>
                      <span className="text-green-600">{formatCurrency(profit - taxBreakdown.totalTax)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div ref={incomeRef} className={cn(!isContentVisible('income') && 'hidden')}>
          <Card className="border-2 border-emerald-500 dark:border-emerald-500 rounded-xl bg-emerald-50 dark:bg-emerald-950">
            <CardContent className="pt-4">
              <div className="grid gap-12 md:grid-cols-3">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Transaction Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Transactions</span>
                      <span className="font-medium">{incomeTransactions.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Average Value</span>
                      <span className="font-medium">{formatCurrency(incomeTransactions.length > 0 ? businessIncome / incomeTransactions.length : 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-2">
                      <span>Total Income</span>
                      <span className="text-emerald-600">{formatCurrency(businessIncome)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Largest Transactions</h4>
                  <div className="space-y-2">
                    {incomeTransactions
                      .sort((a, b) => b.amount - a.amount)
                      .slice(0, 3)
                      .map((t, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="truncate max-w-[150px]">{t.description}</span>
                          <span className="font-medium">{formatCurrency(t.amount)}</span>
                        </div>
                      ))}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Value Range</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Smallest</span>
                      <span className="font-medium">{formatCurrency(incomeTransactions.length > 0 ? Math.min(...incomeTransactions.map(t => t.amount)) : 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Largest</span>
                      <span className="font-medium">{formatCurrency(incomeTransactions.length > 0 ? Math.max(...incomeTransactions.map(t => t.amount)) : 0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div ref={expensesRef} className={cn(!isContentVisible('expenses') && 'hidden')}>
          <Card className="border-2 border-red-500 dark:border-red-500 rounded-xl bg-red-50 dark:bg-red-950">
            <CardContent className="pt-4">
              <div className="grid gap-12 md:grid-cols-3">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Top Categories</h4>
                  <div className="space-y-2">
                    {sortedExpenseCategories.slice(0, 4).map(([category, amount], i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="truncate max-w-[150px]">{category}</span>
                        <span className="font-medium">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Transaction Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Transactions</span>
                      <span className="font-medium">{expenseTransactions.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Average Value</span>
                      <span className="font-medium">{formatCurrency(expenseTransactions.length > 0 ? businessExpense / expenseTransactions.length : 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Categories Used</span>
                      <span className="font-medium">{Object.keys(expensesByCategory).length}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Largest Expenses</h4>
                  <div className="space-y-2">
                    {expenseTransactions
                      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                      .slice(0, 3)
                      .map((t, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="truncate max-w-[150px]">{t.description}</span>
                          <span className="font-medium text-red-500">{formatCurrency(Math.abs(t.amount))}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div ref={taxRef} className={cn(!isContentVisible('tax') && 'hidden')}>
          <Card className="border-2 border-amber-500 dark:border-amber-500 rounded-tr-none rounded-tl-xl rounded-b-xl bg-amber-50 dark:bg-amber-950">
            <CardContent className="pt-4">
              <div className="grid gap-12 md:grid-cols-3">
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
      </div>
    </div>
  );
}
