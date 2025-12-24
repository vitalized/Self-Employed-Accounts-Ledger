import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { parseISO, subMonths, isAfter, isBefore, format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface VATSummaryReportProps {
  transactions: Transaction[];
  yearLabel: string;
}

const VAT_THRESHOLD = 90000;
const VAT_APPROACHING = 75000;
const VAT_DANGER = 85000;

export function VATSummaryReport({ transactions, yearLabel }: VATSummaryReportProps) {
  const [viewMode, setViewMode] = useState<'taxYear' | 'rolling'>('taxYear');
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  
  const earliestTransactionDate = useMemo(() => {
    const incomeDates = transactions
      .filter(t => t.type === 'Business' && t.businessType === 'Income')
      .map(t => parseISO(t.date));
    return incomeDates.length > 0 ? new Date(Math.min(...incomeDates.map(d => d.getTime()))) : new Date();
  }, [transactions]);

  const canGoBack = isAfter(startOfMonth(referenceDate), startOfMonth(earliestTransactionDate));
  const canGoForward = isBefore(startOfMonth(referenceDate), startOfMonth(new Date()));
  const isCurrentMonth = format(referenceDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  const goToPreviousMonth = () => {
    if (canGoBack) {
      setReferenceDate(prev => subMonths(prev, 1));
    }
  };

  const goToNextMonth = () => {
    if (canGoForward) {
      setReferenceDate(prev => addMonths(prev, 1));
    }
  };

  const goToCurrentMonth = () => {
    setReferenceDate(new Date());
  };

  const handleViewModeChange = (checked: boolean) => {
    setViewMode(checked ? 'rolling' : 'taxYear');
    if (!checked) {
      setReferenceDate(new Date());
    }
  };

  const taxYearDates = useMemo(() => {
    const match = yearLabel.match(/(\d{4})\/(\d{2,4})/);
    if (match) {
      const startYear = parseInt(match[1]);
      const endYear = startYear + 1;
      return {
        start: new Date(startYear, 3, 6),
        end: new Date(endYear, 3, 5)
      };
    }
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const startYear = currentMonth >= 3 && now.getDate() >= 6 ? currentYear : currentYear - 1;
    return {
      start: new Date(startYear, 3, 6),
      end: new Date(startYear + 1, 3, 5)
    };
  }, [yearLabel]);

  const { taxYearData, rollingData } = useMemo(() => {
    const endOfReferenceMonth = endOfMonth(referenceDate);
    const twelveMonthsAgo = subMonths(startOfMonth(referenceDate), 11);
    
    let taxYearTotal = 0;
    let rollingTotal = 0;
    const taxYearMonths: Record<string, number> = {};
    const rollingMonths: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.type === 'Business' && t.businessType === 'Income') {
        const amount = Number(t.amount);
        const date = parseISO(t.date);
        
        if ((isAfter(date, taxYearDates.start) || format(date, 'yyyy-MM-dd') === format(taxYearDates.start, 'yyyy-MM-dd')) &&
            (isBefore(date, taxYearDates.end) || format(date, 'yyyy-MM-dd') === format(taxYearDates.end, 'yyyy-MM-dd'))) {
          taxYearTotal += amount;
          const key = format(date, 'yyyy-MM');
          taxYearMonths[key] = (taxYearMonths[key] || 0) + amount;
        }
        
        if ((isAfter(date, twelveMonthsAgo) || format(date, 'yyyy-MM') === format(twelveMonthsAgo, 'yyyy-MM')) && 
            (isBefore(date, endOfReferenceMonth) || format(date, 'yyyy-MM') === format(endOfReferenceMonth, 'yyyy-MM'))) {
          rollingTotal += amount;
          const key = format(date, 'yyyy-MM');
          rollingMonths[key] = (rollingMonths[key] || 0) + amount;
        }
      }
    });

    const getStatus = (total: number): 'safe' | 'approaching' | 'danger' | 'exceeded' => {
      if (total >= VAT_THRESHOLD) return 'exceeded';
      if (total >= VAT_DANGER) return 'danger';
      if (total >= VAT_APPROACHING) return 'approaching';
      return 'safe';
    };

    const toMonthlyData = (months: Record<string, number>) => {
      const data = Object.entries(months)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => ({ month: format(parseISO(month + '-01'), 'MMM yy'), value }));
      
      let cumulative = 0;
      const cumulativeData = data.map(m => {
        cumulative += m.value;
        return { ...m, cumulative, threshold: VAT_THRESHOLD };
      });
      
      return { monthlyBreakdown: data, cumulativeData };
    };

    return {
      taxYearData: {
        income: taxYearTotal,
        status: getStatus(taxYearTotal),
        ...toMonthlyData(taxYearMonths)
      },
      rollingData: {
        income: rollingTotal,
        status: getStatus(rollingTotal),
        ...toMonthlyData(rollingMonths)
      }
    };
  }, [transactions, referenceDate, taxYearDates]);

  const activeData = viewMode === 'rolling' ? rollingData : taxYearData;
  const displayIncome = activeData.income;
  const status = activeData.status;
  const monthlyBreakdown = activeData.monthlyBreakdown;
  const cumulativeData = activeData.cumulativeData;

  const percentage = Math.min((displayIncome / VAT_THRESHOLD) * 100, 100);
  const remaining = Math.max(VAT_THRESHOLD - displayIncome, 0);

  const statusConfig = {
    safe: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-200', label: 'Below Threshold' },
    approaching: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200', label: 'Approaching Threshold' },
    danger: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200', label: 'Near Threshold' },
    exceeded: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200', label: 'VAT Registration Required' }
  };

  const StatusIcon = statusConfig[status].icon;

  return (
    <div className="p-6 space-y-6">
      <Card className={`${statusConfig[status].bg} ${statusConfig[status].border} border-2`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="view-mode"
                checked={viewMode === 'rolling'}
                onCheckedChange={handleViewModeChange}
                data-testid="switch-view-mode"
              />
              <Label htmlFor="view-mode" className="text-sm">
                Rolling 12 months
              </Label>
            </div>
            
            {viewMode === 'rolling' && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToPreviousMonth}
                  disabled={!canGoBack}
                  data-testid="btn-prev-month"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-center min-w-[140px]">
                  <div className="text-sm font-semibold">
                    {format(referenceDate, 'MMMM yyyy')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isCurrentMonth ? 'Current Month' : 'Historical View'}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isCurrentMonth && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={goToCurrentMonth}
                      data-testid="btn-current-month"
                    >
                      Today
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={goToNextMonth}
                    disabled={!canGoForward}
                    data-testid="btn-next-month"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
            
            {viewMode === 'taxYear' && (
              <div className="text-sm text-muted-foreground">
                Showing current tax year: {yearLabel}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <StatusIcon className={`h-12 w-12 ${statusConfig[status].color}`} />
            <div className="flex-1">
              <div className={`text-lg font-bold ${statusConfig[status].color}`}>
                {statusConfig[status].label}
              </div>
              <div className="text-3xl font-bold mt-1">
                £{displayIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / £{VAT_THRESHOLD.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {viewMode === 'rolling' 
                  ? `Rolling 12-month taxable turnover${!isCurrentMonth ? ` (as of ${format(referenceDate, 'MMM yyyy')})` : ''}`
                  : `Taxable turnover for ${yearLabel}`
                }
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Remaining</div>
              <div className="text-2xl font-bold">£{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="mt-4">
            <Progress 
              value={percentage} 
              className="h-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>£0</span>
              <span className="text-amber-600">£75k</span>
              <span className="text-orange-600">£85k</span>
              <span className="text-red-600">£90k</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList data-testid="tabs-vat-summary">
          <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
          <TabsTrigger value="charts" data-testid="tab-charts">Charts</TabsTrigger>
          <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tax Year Income</CardTitle>
                <CardDescription>Income for {yearLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">£{taxYearData.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Rolling 12-Month</CardTitle>
                <CardDescription>
                  {viewMode === 'rolling' && !isCurrentMonth
                    ? `As of ${format(referenceDate, 'MMMM yyyy')}`
                    : 'For VAT registration purposes'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">£{rollingData.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>VAT Registration Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-1">When to Register</h4>
                  <p className="text-muted-foreground">
                    You must register for VAT if your taxable turnover exceeds £90,000 in any rolling 12-month period, 
                    or if you expect to exceed this threshold in the next 30 days.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Registration Deadline</h4>
                  <p className="text-muted-foreground">
                    You must register within 30 days of the end of the month in which you exceeded the threshold.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income</CardTitle>
              <CardDescription>
                {viewMode === 'rolling' 
                  ? `Income over the 12 months ending ${format(referenceDate, 'MMMM yyyy')}`
                  : `Income for tax year ${yearLabel}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {monthlyBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => [`£${value.toLocaleString()}`, 'Income']} />
                      <Bar dataKey="value" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No income data for this period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cumulative Income vs Threshold</CardTitle>
              <CardDescription>Track your progress towards VAT threshold</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {cumulativeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cumulativeData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => [`£${value.toLocaleString()}`, '']} />
                      <Legend />
                      <Line type="monotone" dataKey="cumulative" name="Cumulative Income" stroke="#22c55e" strokeWidth={2} />
                      <Line type="monotone" dataKey="threshold" name="VAT Threshold" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data to display
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income Breakdown</CardTitle>
              <CardDescription>
                {viewMode === 'rolling' 
                  ? `12 months ending ${format(referenceDate, 'MMMM yyyy')}`
                  : `Tax year ${yearLabel}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {monthlyBreakdown.map((item) => (
                  <div key={item.month} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <span className="font-medium">{item.month}</span>
                    <span>£{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {monthlyBreakdown.length === 0 && (
                  <div className="text-muted-foreground text-center py-4">No income in this period</div>
                )}
                {monthlyBreakdown.length > 0 && (
                  <div className="flex items-center justify-between py-3 border-t-2 font-bold text-lg mt-2">
                    <span>{viewMode === 'rolling' ? 'Total (Rolling 12 Months)' : `Total (${yearLabel})`}</span>
                    <span>£{displayIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Voluntary Registration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You can voluntarily register for VAT even if below the threshold. This may benefit businesses 
                that sell to other VAT-registered businesses or make zero-rated supplies.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
