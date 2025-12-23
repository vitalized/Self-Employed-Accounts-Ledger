import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { parseISO, subMonths, isAfter, format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';

interface VATSummaryReportProps {
  transactions: Transaction[];
  yearLabel: string;
}

const VAT_THRESHOLD = 90000;
const VAT_APPROACHING = 75000;
const VAT_DANGER = 85000;

export function VATSummaryReport({ transactions, yearLabel }: VATSummaryReportProps) {
  const { taxYearIncome, rollingIncome, monthlyBreakdown, status, cumulativeData } = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 12);
    
    let taxYearTotal = 0;
    let rollingTotal = 0;
    const months: Record<string, number> = {};

    transactions.forEach(t => {
      if (t.type === 'Business' && t.businessType === 'Income') {
        const amount = Number(t.amount);
        const date = parseISO(t.date);
        
        taxYearTotal += amount;
        
        if (isAfter(date, twelveMonthsAgo)) {
          rollingTotal += amount;
          const key = format(date, 'yyyy-MM');
          months[key] = (months[key] || 0) + amount;
        }
      }
    });

    let statusLevel: 'safe' | 'approaching' | 'danger' | 'exceeded';
    if (rollingTotal >= VAT_THRESHOLD) {
      statusLevel = 'exceeded';
    } else if (rollingTotal >= VAT_DANGER) {
      statusLevel = 'danger';
    } else if (rollingTotal >= VAT_APPROACHING) {
      statusLevel = 'approaching';
    } else {
      statusLevel = 'safe';
    }

    const monthlyData = Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month: format(parseISO(month + '-01'), 'MMM yy'), value }));

    let cumulative = 0;
    const cumulativeMonthly = monthlyData.map(m => {
      cumulative += m.value;
      return { ...m, cumulative, threshold: VAT_THRESHOLD };
    });

    return {
      taxYearIncome: taxYearTotal,
      rollingIncome: rollingTotal,
      monthlyBreakdown: monthlyData,
      status: statusLevel,
      cumulativeData: cumulativeMonthly
    };
  }, [transactions]);

  const percentage = Math.min((rollingIncome / VAT_THRESHOLD) * 100, 100);
  const remaining = Math.max(VAT_THRESHOLD - rollingIncome, 0);

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
          <div className="flex items-center gap-4">
            <StatusIcon className={`h-12 w-12 ${statusConfig[status].color}`} />
            <div className="flex-1">
              <div className={`text-lg font-bold ${statusConfig[status].color}`}>
                {statusConfig[status].label}
              </div>
              <div className="text-3xl font-bold mt-1">
                £{rollingIncome.toLocaleString()} / £{VAT_THRESHOLD.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Rolling 12-month taxable turnover
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Remaining</div>
              <div className="text-2xl font-bold">£{remaining.toLocaleString()}</div>
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
                <div className="text-2xl font-bold">£{taxYearIncome.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Rolling 12-Month</CardTitle>
                <CardDescription>For VAT registration purposes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">£{rollingIncome.toLocaleString()}</div>
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
              <CardDescription>Income over the last 12 months</CardDescription>
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
                    No income data for the last 12 months
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
              <CardDescription>Used for rolling threshold calculation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {monthlyBreakdown.map((item) => (
                  <div key={item.month} className="flex items-center justify-between py-2 border-b last:border-b-0">
                    <span className="font-medium">{item.month}</span>
                    <span>£{item.value.toLocaleString()}</span>
                  </div>
                ))}
                {monthlyBreakdown.length === 0 && (
                  <div className="text-muted-foreground text-center py-4">No income in the last 12 months</div>
                )}
                {monthlyBreakdown.length > 0 && (
                  <div className="flex items-center justify-between py-3 border-t-2 font-bold text-lg mt-2">
                    <span>Total (Rolling 12 Months)</span>
                    <span>£{rollingIncome.toLocaleString()}</span>
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
