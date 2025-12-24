import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Transaction } from "@/lib/types";
import { format, differenceInDays, differenceInCalendarMonths, isBefore, isAfter, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { Calculator, PiggyBank, Calendar, AlertCircle, TrendingUp, Wallet, Download, FileSpreadsheet, Info } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Legend, Cell } from "recharts";
import * as XLSX from 'xlsx';
import { useQuery } from "@tanstack/react-query";
import { SA103_EXPENSE_CATEGORIES } from "@shared/categories";

interface TaxPaymentPlannerProps {
  transactions: Transaction[];
  yearLabel: string;
}

interface PlannerData {
  priorYearBalance: number;
  monthlyTarget: number;
  includePaymentsOnAccount: boolean;
}

const STORAGE_KEY = 'taxtrack-payment-planner';

export function TaxPaymentPlanner({ transactions, yearLabel }: TaxPaymentPlannerProps) {
  const startYear = parseInt(yearLabel.split('-')[0]);
  const endYear = 2000 + parseInt(yearLabel.split('-')[1]);

  const [plannerData, setPlannerData] = useState<PlannerData>(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY}-${yearLabel}`);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      priorYearBalance: 0,
      monthlyTarget: 0,
      includePaymentsOnAccount: true
    };
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}-${yearLabel}`, JSON.stringify(plannerData));
  }, [plannerData, yearLabel]);

  // Fetch mileage summary for the tax year (same as SA103F)
  const { data: mileageSummary, isSuccess: mileageLoaded } = useQuery<{ allowance: number }>({
    queryKey: ["/api/mileage-summary", yearLabel],
    queryFn: async () => {
      const res = await fetch(`/api/mileage-summary?taxYear=${yearLabel}`);
      if (!res.ok) throw new Error("Failed to fetch mileage summary");
      return res.json();
    },
  });
  
  // Use 0 for mileage only after query completes to match SA103F behavior
  const mileageAllowance = mileageLoaded ? (mileageSummary?.allowance || 0) : 0;

  // Get Use of Home data from localStorage (same as SA103F)
  const useOfHomeData = useMemo(() => {
    const storageKey = `useOfHome_${yearLabel}`;
    try {
      const expensesRaw = localStorage.getItem(storageKey);
      const totalRooms = parseInt(localStorage.getItem(`${storageKey}_rooms`) || '0') || 0;
      const businessRooms = parseInt(localStorage.getItem(`${storageKey}_bizRooms`) || '0') || 0;
      const hoursPerWeek = parseInt(localStorage.getItem(`${storageKey}_hours`) || '0') || 0;

      if (!expensesRaw && totalRooms === 0 && hoursPerWeek === 0) {
        return null;
      }

      const expenses = expensesRaw ? JSON.parse(expensesRaw) : {};
      const totalExpenses = Object.values(expenses).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
      const roomProportion = totalRooms > 0 ? businessRooms / totalRooms : 0;
      const proportionalClaim = totalExpenses * roomProportion;

      const hoursPerMonth = hoursPerWeek * 4.33;
      let monthlyFlatRate = 0;
      if (hoursPerMonth >= 101) monthlyFlatRate = 26;
      else if (hoursPerMonth >= 51) monthlyFlatRate = 18;
      else if (hoursPerMonth >= 25) monthlyFlatRate = 10;
      const annualFlatRate = monthlyFlatRate * 12;

      const recommended = proportionalClaim > annualFlatRate ? 'proportional' : 'flat';
      const recommendedAmount = recommended === 'proportional' ? proportionalClaim : annualFlatRate;

      if (totalExpenses === 0 && hoursPerWeek === 0) {
        return null;
      }

      return { recommendedAmount };
    } catch {
      return null;
    }
  }, [yearLabel]);

  // Tax calculation matching SA103F exactly
  const taxCalculation = useMemo(() => {
    let turnover = 0;
    let otherIncome = 0;

    const expenses = {
      costOfGoods: 0,
      construction: 0,
      wages: 0,
      travel: 0,
      rent: 0,
      repairs: 0,
      admin: 0,
      advertising: 0,
      interest: 0,
      bankCharges: 0,
      badDebts: 0,
      professional: 0,
      depreciation: 0,
      other: 0,
    };

    transactions.forEach(t => {
      if (t.type !== 'Business') return;
      const amount = Math.abs(Number(t.amount));
      
      if (t.businessType === 'Income') {
        if (t.category === 'Sales') {
          turnover += amount;
        } else {
          otherIncome += amount;
        }
      } else if (t.businessType === 'Expense' && t.category) {
        const categoryDef = SA103_EXPENSE_CATEGORIES.find(c => c.label === t.category);
        if (categoryDef) {
          switch (categoryDef.code) {
            case '17': expenses.costOfGoods += amount; break;
            case '18': expenses.construction += amount; break;
            case '19': expenses.wages += amount; break;
            case '20': expenses.travel += amount; break;
            case '21': expenses.rent += amount; break;
            case '22': expenses.repairs += amount; break;
            case '23': expenses.admin += amount; break;
            case '24': expenses.advertising += amount; break;
            case '25': expenses.interest += amount; break;
            case '26': expenses.bankCharges += amount; break;
            case '27': expenses.badDebts += amount; break;
            case '28': expenses.professional += amount; break;
            case '29': expenses.depreciation += amount; break;
            case '30': expenses.other += amount; break;
          }
        } else {
          expenses.other += amount;
        }
      }
    });

    // Add Use of Home allowance to Box 21 (Rent, rates, power and insurance costs)
    const useOfHomeAmount = useOfHomeData?.recommendedAmount || 0;
    expenses.rent += useOfHomeAmount;

    // Add mileage allowance to Box 20 (Car, van and travel expenses)
    expenses.travel += mileageAllowance;

    const totalIncome = turnover + otherIncome;
    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
    const netProfit = totalIncome - totalExpenses;

    let taxableIncome = Math.max(0, netProfit - 12570);
    let incomeTax = 0;
    
    if (taxableIncome > 0) {
      const basicRateLimit = 37700;
      const basicTaxable = Math.min(taxableIncome, basicRateLimit);
      const basicTax = basicTaxable * 0.20;
      incomeTax += basicTax;
      
      if (taxableIncome > basicRateLimit) {
        const higherRateLimit = 125140 - 50270;
        const higherTaxable = Math.min(taxableIncome - basicRateLimit, higherRateLimit);
        const higherTax = higherTaxable * 0.40;
        incomeTax += higherTax;
        
        if (taxableIncome > basicRateLimit + higherRateLimit) {
          const additionalTaxable = taxableIncome - basicRateLimit - higherRateLimit;
          const additionalTax = additionalTaxable * 0.45;
          incomeTax += additionalTax;
        }
      }
    }

    let class4NI = 0;
    if (netProfit > 12570) {
      const class4LowerLimit = 12570;
      const class4UpperLimit = 50270;
      if (netProfit <= class4UpperLimit) {
        class4NI = (netProfit - class4LowerLimit) * 0.09;
      } else {
        class4NI = (class4UpperLimit - class4LowerLimit) * 0.09;
        class4NI += (netProfit - class4UpperLimit) * 0.02;
      }
    }

    const class2NI = netProfit > 6725 ? 3.45 * 52 : 0;
    const totalTax = Math.round(incomeTax + class4NI + class2NI);

    return {
      totalIncome,
      totalExpenses,
      netProfit,
      incomeTax: Math.round(incomeTax),
      class4NI: Math.round(class4NI),
      class2NI: Math.round(class2NI),
      totalTax
    };
  }, [transactions, useOfHomeData, mileageAllowance]);

  const paymentSchedule = useMemo(() => {
    const now = new Date();
    const halfTax = Math.round(taxCalculation.totalTax / 2);
    
    const jan31Date = new Date(endYear + 1, 0, 31);
    const jul31Date = new Date(endYear + 1, 6, 31);
    
    const priorBalance = plannerData.priorYearBalance;
    const currentYearTax = taxCalculation.totalTax;
    const firstPoA = plannerData.includePaymentsOnAccount ? halfTax : 0;
    const secondPoA = plannerData.includePaymentsOnAccount ? halfTax : 0;
    
    const jan31Total = priorBalance + currentYearTax + firstPoA;
    const jul31Total = secondPoA;
    const totalOwed = jan31Total + jul31Total;
    
    const daysToJan31 = Math.max(0, differenceInDays(jan31Date, now));
    const daysToJul31 = Math.max(0, differenceInDays(jul31Date, now));
    // Use calendar months + 1 for inclusive count (current month counts as a saving month)
    const monthsToJan31 = Math.max(1, differenceInCalendarMonths(jan31Date, now) + 1);
    const monthsToJul31 = Math.max(1, differenceInCalendarMonths(jul31Date, now) + 1);
    
    // Calculate monthly amounts needed to meet EACH deadline
    // Phase 1: Save enough for Jan 31 payment by January (includes current month through January)
    const monthlyForJan = Math.ceil(jan31Total / monthsToJan31);
    // Phase 2: After Jan, save enough for Jul 31 payment
    // If we're already past January, calculate from current month; otherwise use 6 months (Feb-Jul)
    const isPastJan = isBefore(jan31Date, now);
    const monthsToJul = isPastJan 
      ? Math.max(1, differenceInCalendarMonths(jul31Date, now) + 1)
      : 6; // Feb through Jul = 6 months
    const monthlyForJul = Math.ceil(jul31Total / monthsToJul);
    
    // Recommend the higher of the two to ensure both deadlines are met
    // If we're past January, just focus on July
    const recommendedMonthly = isPastJan 
      ? Math.ceil(jul31Total / Math.max(1, differenceInCalendarMonths(jul31Date, now) + 1))
      : Math.max(monthlyForJan, monthlyForJul);
    
    return {
      priorBalance,
      currentYearTax,
      firstPoA,
      secondPoA,
      jan31Date,
      jul31Date,
      jan31Total,
      jul31Total,
      totalOwed,
      daysToJan31,
      daysToJul31,
      monthsToJan31,
      monthsToJul31,
      monthlyForJan,
      monthlyForJul,
      recommendedMonthly
    };
  }, [taxCalculation, plannerData, endYear]);

  const monthlyBreakdown = useMemo(() => {
    const now = new Date();
    const months: Array<{
      month: string;
      monthDate: Date;
      monthlyAmount: number;
      accumulated: number;
      target: number;
      isDeadlineMonth: boolean;
      phase: 'jan' | 'jul';
      deadline?: string;
      deadlineAmount?: number;
    }> = [];
    
    let currentDate = startOfMonth(now);
    const endDate = new Date(endYear + 1, 7, 1);
    const jan31Date = new Date(endYear + 1, 0, 31);
    let accumulated = 0;
    
    // If user set a custom target, use it for all months
    // Otherwise, use phased amounts: higher before Jan, lower after
    const useCustomTarget = plannerData.monthlyTarget > 0;
    
    while (isBefore(currentDate, endDate)) {
      const isBeforeJan = isBefore(currentDate, jan31Date) || (currentDate.getMonth() === 0 && currentDate.getFullYear() === endYear + 1);
      const isJanDeadline = currentDate.getMonth() === 0 && currentDate.getFullYear() === endYear + 1;
      const isJulDeadline = currentDate.getMonth() === 6 && currentDate.getFullYear() === endYear + 1;
      
      // Phased monthly amounts: before Jan use jan rate, after Jan use jul rate
      const monthlyAmount = useCustomTarget 
        ? plannerData.monthlyTarget 
        : (isBeforeJan ? paymentSchedule.monthlyForJan : paymentSchedule.monthlyForJul);
      
      accumulated += monthlyAmount;
      
      const monthData: typeof months[0] = {
        month: format(currentDate, 'MMM yyyy'),
        monthDate: currentDate,
        monthlyAmount: monthlyAmount,
        accumulated: Math.min(accumulated, paymentSchedule.totalOwed),
        target: paymentSchedule.totalOwed,
        isDeadlineMonth: isJanDeadline || isJulDeadline,
        phase: isBeforeJan ? 'jan' : 'jul'
      };
      
      if (isJanDeadline) {
        monthData.deadline = '31 Jan';
        monthData.deadlineAmount = paymentSchedule.jan31Total;
      }
      if (isJulDeadline) {
        monthData.deadline = '31 Jul';
        monthData.deadlineAmount = paymentSchedule.totalOwed;
      }
      
      months.push(monthData);
      currentDate = addMonths(currentDate, 1);
    }
    
    return months;
  }, [paymentSchedule, plannerData.monthlyTarget, endYear]);

  const handlePriorBalanceChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setPlannerData(prev => ({ ...prev, priorYearBalance: numValue }));
  };

  const handleMonthlyTargetChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setPlannerData(prev => ({ ...prev, monthlyTarget: numValue }));
  };

  const exportToCSV = () => {
    const rows = [
      ['Tax Payment Planner'],
      [`Tax Year: ${yearLabel}`],
      [''],
      ['OUTSTANDING BALANCES', 'Amount'],
      ['Prior Year Balance Owed', plannerData.priorYearBalance],
      [`Current Year Tax (${yearLabel})`, taxCalculation.totalTax],
      ['First Payment on Account', paymentSchedule.firstPoA],
      ['Second Payment on Account', paymentSchedule.secondPoA],
      ['TOTAL TO PAY', paymentSchedule.totalOwed],
      [''],
      ['PAYMENT DEADLINES', 'Date', 'Amount Due'],
      ['January Payment', format(paymentSchedule.jan31Date, 'dd MMM yyyy'), paymentSchedule.jan31Total],
      ['July Payment', format(paymentSchedule.jul31Date, 'dd MMM yyyy'), paymentSchedule.jul31Total],
      [''],
      ['MONTHLY SAVINGS PLAN', '', ''],
      ['Recommended Monthly Amount', '', paymentSchedule.recommendedMonthly],
      ['Your Monthly Target', '', plannerData.monthlyTarget || paymentSchedule.recommendedMonthly],
      [''],
      ['MONTH BY MONTH BREAKDOWN', 'Accumulated Savings', 'Target'],
      ...monthlyBreakdown.map(m => [m.month, m.accumulated, m.target])
    ];

    const csvContent = rows.map(row => row.map(cell => {
      const str = String(cell ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Tax_Payment_Planner_${yearLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const rows = [
      ['Tax Payment Planner'],
      [`Tax Year: ${yearLabel}`],
      [''],
      ['OUTSTANDING BALANCES', 'Amount'],
      ['Prior Year Balance Owed', plannerData.priorYearBalance],
      [`Current Year Tax (${yearLabel})`, taxCalculation.totalTax],
      ['First Payment on Account', paymentSchedule.firstPoA],
      ['Second Payment on Account', paymentSchedule.secondPoA],
      ['TOTAL TO PAY', paymentSchedule.totalOwed],
      [''],
      ['PAYMENT DEADLINES', 'Date', 'Amount Due'],
      ['January Payment', format(paymentSchedule.jan31Date, 'dd MMM yyyy'), paymentSchedule.jan31Total],
      ['July Payment', format(paymentSchedule.jul31Date, 'dd MMM yyyy'), paymentSchedule.jul31Total],
      [''],
      ['MONTHLY SAVINGS PLAN', '', ''],
      ['Recommended Monthly Amount', '', paymentSchedule.recommendedMonthly],
      ['Your Monthly Target', '', plannerData.monthlyTarget || paymentSchedule.recommendedMonthly],
      [''],
      ['MONTH BY MONTH BREAKDOWN', 'Accumulated Savings', 'Target'],
      ...monthlyBreakdown.map(m => [m.month, m.accumulated, m.target])
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Planner');
    XLSX.writeFile(wb, `Tax_Payment_Planner_${yearLabel}.xlsx`);
  };

  const getDeadlineStatus = (date: Date) => {
    const now = new Date();
    const daysUntil = differenceInDays(date, now);
    
    if (daysUntil < 0) {
      return { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', text: 'Overdue' };
    }
    if (daysUntil <= 30) {
      return { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', text: 'Due Soon' };
    }
    if (daysUntil <= 90) {
      return { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', text: `${daysUntil} days` };
    }
    return { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', text: `${daysUntil} days` };
  };

  const jan31Status = getDeadlineStatus(paymentSchedule.jan31Date);
  const jul31Status = getDeadlineStatus(paymentSchedule.jul31Date);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={exportToCSV} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={exportToExcel} data-testid="button-export-excel">
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          Excel
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Prior Year Owed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">£{plannerData.priorYearBalance.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              This Year's Tax
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{taxCalculation.totalTax.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Payments on Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{(paymentSchedule.firstPoA + paymentSchedule.secondPoA).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Total to Pay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">£{paymentSchedule.totalOwed.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5" />
              Your Tax Budget
            </CardTitle>
            <CardDescription>Enter your outstanding balance and monthly savings target</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="priorBalance">Outstanding tax from previous years</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                <Input
                  id="priorBalance"
                  type="number"
                  value={plannerData.priorYearBalance || ''}
                  onChange={(e) => handlePriorBalanceChange(e.target.value)}
                  placeholder="e.g. 24000"
                  className="pl-7"
                  data-testid="input-prior-balance"
                />
              </div>
              <p className="text-xs text-muted-foreground">Enter any tax you still owe from last year</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="monthlyTarget">Monthly savings target</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                <Input
                  id="monthlyTarget"
                  type="number"
                  value={plannerData.monthlyTarget || ''}
                  onChange={(e) => handleMonthlyTargetChange(e.target.value)}
                  placeholder={`Recommended: £${paymentSchedule.recommendedMonthly.toLocaleString()}`}
                  className="pl-7"
                  data-testid="input-monthly-target"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                We recommend saving <strong>£{paymentSchedule.recommendedMonthly.toLocaleString()}/month</strong> to cover the January deadline 
                ({paymentSchedule.monthsToJan31} months away)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              HMRC Payment Deadlines
            </CardTitle>
            <CardDescription>Key dates for your tax payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">31 January {endYear + 1}</span>
                <Badge className={jan31Status.color}>{jan31Status.text}</Badge>
              </div>
              <div className="text-2xl font-bold text-orange-600">£{paymentSchedule.jan31Total.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Prior year balance</span>
                  <span>£{plannerData.priorYearBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current year tax</span>
                  <span>£{taxCalculation.totalTax.toLocaleString()}</span>
                </div>
                {paymentSchedule.firstPoA > 0 && (
                  <div className="flex justify-between">
                    <span>1st Payment on Account</span>
                    <span>£{paymentSchedule.firstPoA.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">31 July {endYear + 1}</span>
                <Badge className={jul31Status.color}>{jul31Status.text}</Badge>
              </div>
              <div className="text-2xl font-bold text-orange-600">£{paymentSchedule.jul31Total.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>2nd Payment on Account</span>
                  <span>£{paymentSchedule.secondPoA.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5" />
            Monthly Tax Savings
          </CardTitle>
          <CardDescription>
            Amount to set aside each month - green for Jan phase, blue for Jul phase, orange for deadline months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `£${value.toLocaleString()}`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [`£${value.toLocaleString()}`, 'Monthly Amount']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="monthlyAmount" name="Monthly Savings" radius={[4, 4, 0, 0]}>
                  {monthlyBreakdown.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isDeadlineMonth ? '#f97316' : (entry.phase === 'jan' ? '#22c55e' : '#3b82f6')}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-4 text-sm justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>Phase 1 (to Jan 31): £{paymentSchedule.monthlyForJan.toLocaleString()}/mo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>Phase 2 (to Jul 31): £{paymentSchedule.monthlyForJul.toLocaleString()}/mo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span>Deadline month</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Cumulative Savings Progress
          </CardTitle>
          <CardDescription>
            Track your total savings against the tax due
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => [`£${value.toLocaleString()}`, '']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend />
                <ReferenceLine y={paymentSchedule.jan31Total} stroke="#ef4444" strokeDasharray="5 5" label={{ value: `Jan 31: £${(paymentSchedule.jan31Total / 1000).toFixed(0)}k`, fill: '#ef4444', fontSize: 11 }} />
                <ReferenceLine y={paymentSchedule.totalOwed} stroke="#f97316" strokeDasharray="5 5" label={{ value: `Total: £${(paymentSchedule.totalOwed / 1000).toFixed(0)}k`, fill: '#f97316', fontSize: 11 }} />
                <Area type="monotone" dataKey="accumulated" name="Your Savings" fill="#22c55e" stroke="#16a34a" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Month-by-Month Breakdown</CardTitle>
          <CardDescription>
            Phased savings: £{paymentSchedule.monthlyForJan.toLocaleString()}/mo until Jan, then £{paymentSchedule.monthlyForJul.toLocaleString()}/mo until Jul
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Month</th>
                  <th className="text-right py-2 px-2">Monthly Amount</th>
                  <th className="text-right py-2 px-2">Accumulated</th>
                  <th className="text-right py-2 px-2">Remaining</th>
                  <th className="text-center py-2 px-2">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {monthlyBreakdown.map((month, i) => {
                  const remaining = paymentSchedule.totalOwed - month.accumulated;
                  const isDeadlineMonth = month.deadline;
                  
                  return (
                    <tr 
                      key={month.month} 
                      className={`border-b ${isDeadlineMonth ? 'bg-orange-50 dark:bg-orange-950/30 font-medium' : ''}`}
                    >
                      <td className="py-2 px-2">{month.month}</td>
                      <td className="text-right py-2 px-2">£{month.monthlyAmount.toLocaleString()}</td>
                      <td className="text-right py-2 px-2 text-green-600">£{month.accumulated.toLocaleString()}</td>
                      <td className="text-right py-2 px-2 text-orange-600">
                        {remaining > 0 ? `£${remaining.toLocaleString()}` : '£0'}
                      </td>
                      <td className="text-center py-2 px-2">
                        {month.deadline && (
                          <Badge variant="outline" className="bg-orange-100 text-orange-800">
                            {month.deadline}: £{month.deadlineAmount?.toLocaleString()}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Info className="h-5 w-5" />
            About Payments on Account
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            <strong>Payments on Account</strong> are advance payments towards your next year's tax bill. 
            HMRC requires you to pay 50% of your previous year's tax liability in advance.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>First payment:</strong> Due 31 January (same day as your balancing payment)</li>
            <li><strong>Second payment:</strong> Due 31 July</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            You can apply to reduce payments on account if you expect your tax bill to be lower. 
            Contact HMRC or speak to your accountant for advice.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
