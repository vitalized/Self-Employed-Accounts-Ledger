import { useState, useRef, useEffect, useCallback } from "react";
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

interface AnimatedPanelProps {
  isActive: boolean;
  children: React.ReactNode;
  className?: string;
  contentKey?: string | null;
  onCollapseEnd?: () => void;
}

function AnimatedPanel({ isActive, children, className, contentKey, onCollapseEnd }: AnimatedPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>(0);
  const [shouldRender, setShouldRender] = useState(false);
  const onCollapseEndRef = useRef(onCollapseEnd);
  onCollapseEndRef.current = onCollapseEnd;

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    if (isActive && !shouldRender) {
      setShouldRender(true);
      setHeight(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const targetHeight = content.scrollHeight;
          setHeight(targetHeight);
        });
      });
    } else if (!isActive && shouldRender) {
      const currentHeight = container.getBoundingClientRect().height;
      setHeight(currentHeight);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(0);
        });
      });
    }
  }, [isActive, shouldRender]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'height') return;
      if (isActive) {
        setHeight('auto');
      } else {
        setShouldRender(false);
        onCollapseEndRef.current?.();
      }
    };

    container.addEventListener('transitionend', handleTransitionEnd);
    return () => container.removeEventListener('transitionend', handleTransitionEnd);
  }, [isActive]);

  if (!shouldRender && !isActive) return null;

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden transition-[height] duration-300 ease-in-out", className)}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <div ref={contentRef}>
        {children}
      </div>
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function StatCards({ transactions, dateLabel }: StatCardsProps) {
  const [activeTab, setActiveTab] = useState<TabType>(null);
  const [pendingTab, setPendingTab] = useState<TabType>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [displayedTab, setDisplayedTab] = useState<TabType>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  
  useEffect(() => {
    if (activeTab !== null) {
      setDisplayedTab(activeTab);
    }
  }, [activeTab]);
  
  const incomeTransactions = transactions.filter(t => t.type === 'Business' && t.businessType === 'Income');
  const expenseTransactions = transactions.filter(t => t.type === 'Business' && t.businessType === 'Expense');
  
  const businessIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const businessExpense = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const profit = businessIncome - businessExpense;
  const taxBreakdown = calculateFullTaxBreakdown(profit);
  
  const formatCurrency = (value: number) => `£${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleCollapseEnd = useCallback(() => {
    if (pendingTab !== null) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    } else {
      setDisplayedTab(null);
    }
    setIsClosing(false);
  }, [pendingTab]);

  const toggleTab = useCallback((tab: TabType) => {
    if (isClosing) return;
    
    if (activeTab === tab) {
      setIsClosing(true);
      setActiveTab(null);
    } else if (activeTab !== null && isDesktop) {
      setPendingTab(tab);
      setIsClosing(true);
      setActiveTab(null);
    } else {
      setActiveTab(tab);
    }
  }, [activeTab, isDesktop, isClosing]);

  const expensesByCategory = expenseTransactions.reduce((acc, t) => {
    const category = t.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + Math.abs(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const sortedExpenseCategories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const getCardClasses = (tab: TabType, baseColor: string, borderColor: string, forDesktop: boolean = false) => {
    const isActive = activeTab === tab || pendingTab === tab;
    if (isActive) {
      if (forDesktop) {
        return cn(
          "cursor-pointer transition-all",
          `border-t-2 border-l-2 border-r-2 border-b-0 ${borderColor} ${baseColor} rounded-b-none -mb-[18px] relative z-10`
        );
      } else {
        return cn(
          "cursor-pointer transition-all",
          `border-2 ${borderColor} ${baseColor} rounded-b-none`
        );
      }
    }
    return cn(
      "cursor-pointer transition-all",
      "border border-slate-200 dark:border-slate-800"
    );
  };

  const getContentPanelRounding = (tab: TabType) => {
    if (!isDesktop) return "rounded-xl";
    const effectiveTab = isClosing ? displayedTab : tab;
    switch (effectiveTab) {
      case 'profit': return "rounded-tl-none rounded-tr-xl rounded-b-xl";
      case 'tax': return "rounded-tr-none rounded-tl-xl rounded-b-xl";
      default: return "rounded-xl";
    }
  };

  const ProfitContent = () => (
    <Card className={cn("border-2 border-blue-500 dark:border-blue-500 bg-blue-50 dark:bg-blue-950", getContentPanelRounding('profit'))}>
      <CardContent className="pt-4">
        <div className="grid gap-6 md:gap-12 grid-cols-1 md:grid-cols-3">
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
  );

  const IncomeContent = () => (
    <Card className={cn("border-2 border-emerald-500 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950", getContentPanelRounding('income'))}>
      <CardContent className="pt-4">
        <div className="grid gap-6 md:gap-12 grid-cols-1 md:grid-cols-3">
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
  );

  const ExpensesContent = () => (
    <Card className={cn("border-2 border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-950", getContentPanelRounding('expenses'))}>
      <CardContent className="pt-4">
        <div className="grid gap-6 md:gap-12 grid-cols-1 md:grid-cols-3">
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
  );

  const TaxContent = () => (
    <Card className={cn("border-2 border-amber-500 dark:border-amber-500 bg-amber-50 dark:bg-amber-950", getContentPanelRounding('tax'))}>
      <CardContent className="pt-4">
        <div className="grid gap-6 md:gap-12 grid-cols-1 md:grid-cols-3">
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
  );

  const renderContent = (tab: TabType) => {
    switch (tab) {
      case 'profit': return <ProfitContent />;
      case 'income': return <IncomeContent />;
      case 'expenses': return <ExpensesContent />;
      case 'tax': return <TaxContent />;
      default: return null;
    }
  };

  if (isDesktop) {
    return (
      <div className="space-y-0">
        <div className="grid gap-4 grid-cols-4 pb-4">
          <Card 
            className={getCardClasses('profit', 'bg-blue-50 dark:bg-blue-950', 'border-blue-500 dark:border-blue-500', true)}
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
            className={getCardClasses('income', 'bg-emerald-50 dark:bg-emerald-950', 'border-emerald-500 dark:border-emerald-500', true)}
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
            className={getCardClasses('expenses', 'bg-red-50 dark:bg-red-950', 'border-red-500 dark:border-red-500', true)}
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
            className={getCardClasses('tax', 'bg-amber-50 dark:bg-amber-950', 'border-amber-500 dark:border-amber-500', true)}
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
        
        <AnimatedPanel 
          isActive={activeTab !== null} 
          contentKey={activeTab}
          onCollapseEnd={handleCollapseEnd}
        >
          {renderContent(isClosing ? displayedTab : activeTab)}
        </AnimatedPanel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div>
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
          <AnimatedPanel isActive={activeTab === 'profit'}>
            <ProfitContent />
          </AnimatedPanel>
        </div>
        
        <div>
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
          <AnimatedPanel isActive={activeTab === 'income'}>
            <IncomeContent />
          </AnimatedPanel>
        </div>
        
        <div>
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
          <AnimatedPanel isActive={activeTab === 'expenses'}>
            <ExpensesContent />
          </AnimatedPanel>
        </div>

        <div>
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
          <AnimatedPanel isActive={activeTab === 'tax'}>
            <TaxContent />
          </AnimatedPanel>
        </div>
      </div>
    </div>
  );
}
