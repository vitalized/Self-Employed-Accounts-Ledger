import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { format, subMonths, addMonths, parse } from "date-fns";
import { cn } from "@/lib/utils";

interface VATTrackerData {
  totalIncome: number;
  threshold: number;
  percentOfThreshold: number;
  status: 'safe' | 'approaching' | 'danger' | 'exceeded';
  windowStart: string;
  windowEnd: string;
  monthlyBreakdown: Record<string, number>;
  remainingBeforeVAT: number;
}

export function VATTracker() {
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const [endMonth, setEndMonth] = useState(getCurrentMonth);
  const currentMonth = getCurrentMonth();

  const { data, isLoading } = useQuery<VATTrackerData>({
    queryKey: ["/api/vat-tracker", endMonth],
    queryFn: async () => {
      const res = await fetch(`/api/vat-tracker?endMonth=${endMonth}`);
      if (!res.ok) throw new Error("Failed to fetch VAT tracker data");
      return res.json();
    },
  });

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentDate = parse(endMonth, 'yyyy-MM', new Date());
    const newDate = direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
    const newMonthStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Don't allow navigating into the future
    if (newMonthStr > currentMonth) return;
    
    setEndMonth(newMonthStr);
  };

  const isAtCurrentMonth = endMonth >= currentMonth;

  const formatMonth = (monthStr: string) => {
    const date = parse(monthStr, 'yyyy-MM', new Date());
    return format(date, 'MMM yyyy');
  };

  const getStatusConfig = (status: VATTrackerData['status']) => {
    switch (status) {
      case 'safe':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          progressColor: 'bg-green-500',
          icon: CheckCircle,
          message: 'You are safely under the VAT threshold'
        };
      case 'approaching':
        return {
          color: 'text-amber-600',
          bgColor: 'bg-amber-100',
          progressColor: 'bg-amber-500',
          icon: AlertCircle,
          message: 'Approaching VAT threshold - monitor closely'
        };
      case 'danger':
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
          progressColor: 'bg-orange-500',
          icon: AlertTriangle,
          message: 'Very close to VAT threshold!'
        };
      case 'exceeded':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          progressColor: 'bg-red-500',
          icon: AlertTriangle,
          message: 'VAT registration may be required!'
        };
    }
  };

  if (isLoading || !data) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">VAT Threshold Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const config = getStatusConfig(data.status);
  const StatusIcon = config.icon;

  return (
    <Card className="mb-6" data-testid="vat-tracker-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            VAT Threshold Tracker
            <span className={cn("text-xs px-2 py-1 rounded-full", config.bgColor, config.color)}>
              Rolling 12 months
            </span>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth('prev')}
              data-testid="vat-nav-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[120px] text-center">
              Ending {formatMonth(endMonth)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth('next')}
              disabled={isAtCurrentMonth}
              data-testid="vat-nav-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold" data-testid="vat-total-income">
                £{data.totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-muted-foreground">
                of £{data.threshold.toLocaleString('en-GB')} VAT threshold
              </div>
            </div>
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg", config.bgColor)}>
              <StatusIcon className={cn("h-5 w-5", config.color)} />
              <span className={cn("text-sm font-medium", config.color)} data-testid="vat-status">
                {data.status === 'exceeded' ? 'Exceeded' : `${data.percentOfThreshold}%`}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Progress 
              value={Math.min(100, data.percentOfThreshold)} 
              className={cn("h-3", data.status === 'exceeded' && "animate-pulse")}
              data-testid="vat-progress-bar"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatMonth(data.windowStart)}</span>
              <span>{formatMonth(data.windowEnd)}</span>
            </div>
          </div>

          <div className={cn("flex items-center gap-2 p-3 rounded-lg", config.bgColor)}>
            <StatusIcon className={cn("h-4 w-4 flex-shrink-0", config.color)} />
            <span className={cn("text-sm", config.color)} data-testid="vat-message">
              {config.message}
              {data.status !== 'exceeded' && (
                <span className="font-medium">
                  {' '}— £{data.remainingBeforeVAT.toLocaleString('en-GB', { minimumFractionDigits: 2 })} remaining
                </span>
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
