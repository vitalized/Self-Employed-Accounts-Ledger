import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card className="mb-4">
        <CardContent className="py-4">
          <div className="animate-pulse h-12 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const config = getStatusConfig(data.status);
  const StatusIcon = config.icon;

  return (
    <Card className="mb-4" data-testid="vat-tracker-card">
      <CardContent className="py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <StatusIcon className={cn("h-5 w-5", config.color)} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">VAT Threshold</div>
              <div className="text-xl font-bold" data-testid="vat-total-income">
                £{data.totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                <span className="text-sm font-normal text-muted-foreground"> / £{data.threshold.toLocaleString('en-GB')}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-1">
            <Progress 
              value={Math.min(100, data.percentOfThreshold)} 
              className={cn("h-2", data.status === 'exceeded' && "animate-pulse")}
              data-testid="vat-progress-bar"
            />
            <div className="flex justify-between items-center">
              <span className={cn("text-xs font-medium", config.color)} data-testid="vat-message">
                {data.status === 'exceeded' 
                  ? 'VAT registration required' 
                  : `£${data.remainingBeforeVAT.toLocaleString('en-GB', { minimumFractionDigits: 0 })} remaining`
                }
              </span>
              <span className={cn("text-xs font-semibold", config.color)} data-testid="vat-status">
                {data.percentOfThreshold}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 border-l pl-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => navigateMonth('prev')}
              data-testid="vat-nav-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[70px] text-center">
              {formatMonth(endMonth)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => navigateMonth('next')}
              disabled={isAtCurrentMonth}
              data-testid="vat-nav-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
