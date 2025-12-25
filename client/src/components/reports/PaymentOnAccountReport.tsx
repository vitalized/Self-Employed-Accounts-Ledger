import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Calendar, AlertCircle, Clock, Info } from "lucide-react";
import { format, isBefore, isAfter, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { SA103_EXPENSE_CATEGORIES, getHMRCBoxCode } from "@shared/categories";
import * as XLSX from 'xlsx';

interface PaymentOnAccountReportProps {
  transactions: Transaction[];
  yearLabel: string;
}

export function PaymentOnAccountReport({ transactions, yearLabel }: PaymentOnAccountReportProps) {
  const startYear = parseInt(yearLabel.split('-')[0]);
  const endYear = 2000 + parseInt(yearLabel.split('-')[1]);

  const { data: mileageSummary, isSuccess: mileageLoaded } = useQuery<{ allowance: number }>({
    queryKey: ["/api/mileage-summary", yearLabel],
    queryFn: async () => {
      const res = await fetch(`/api/mileage-summary?taxYear=${yearLabel}`);
      if (!res.ok) throw new Error("Failed to fetch mileage summary");
      return res.json();
    },
  });

  const mileageAllowance = mileageLoaded ? (mileageSummary?.allowance || 0) : 0;

  // Get Use of Home data from localStorage (same as SA103F and TaxPaymentPlanner)
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

  const useOfHomeAmount = useOfHomeData?.recommendedAmount || 0;

  const taxCalculation = useMemo(() => {
    // Use SA103F-style calculation matching TaxPaymentPlanner exactly
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
        // Use the helper to map any category (including legacy ones) to the correct HMRC box
        const boxCode = getHMRCBoxCode(t.category);
        switch (boxCode) {
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
          default: expenses.other += amount; break;
        }
      }
    });

    // Add Use of Home allowance to Box 21 (Rent, rates, power and insurance costs)
    expenses.rent += useOfHomeAmount;
    // Add mileage allowance to Box 20 (Car, van and travel expenses)
    expenses.travel += mileageAllowance;

    const totalIncome = turnover + otherIncome;
    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
    const netProfit = totalIncome - totalExpenses;
    const personalAllowance = 12570;
    const taxableIncome = Math.max(0, netProfit - personalAllowance);

    let incomeTax = 0;
    if (taxableIncome > 0) {
      const basicRateLimit = 37700;
      const basicTaxable = Math.min(taxableIncome, basicRateLimit);
      incomeTax += basicTaxable * 0.20;
      
      if (taxableIncome > basicRateLimit) {
        const higherRateLimit = 125140 - 50270; // Higher rate band limit
        const higherTaxable = Math.min(taxableIncome - basicRateLimit, higherRateLimit);
        incomeTax += higherTaxable * 0.40;
        
        if (taxableIncome > basicRateLimit + higherRateLimit) {
          const additionalTaxable = taxableIncome - basicRateLimit - higherRateLimit;
          incomeTax += additionalTaxable * 0.45;
        }
      }
    }

    let class4NI = 0;
    if (netProfit > 12570) {
      const lowerBand = Math.min(netProfit - 12570, 37700);
      const upperBand = Math.max(0, netProfit - 50270);
      class4NI = lowerBand * 0.09 + upperBand * 0.02;
    }

    const class2NI = netProfit > 6725 ? 179.40 : 0;
    const totalTax = Math.round(incomeTax + class4NI + class2NI);

    return {
      netProfit,
      incomeTax: Math.round(incomeTax),
      class4NI: Math.round(class4NI),
      class2NI: Math.round(class2NI),
      totalTax
    };
  }, [transactions, useOfHomeAmount, mileageAllowance]);

  const payments = useMemo(() => {
    const now = new Date();
    const halfTax = Math.round(taxCalculation.totalTax / 2);

    const balancingPaymentDate = new Date(endYear + 1, 0, 31);
    const firstPoADate = new Date(endYear + 1, 0, 31);
    const secondPoADate = new Date(endYear + 1, 6, 31);

    const getPaymentStatus = (date: Date): 'due' | 'upcoming' | 'overdue' => {
      if (isBefore(date, now)) {
        return 'overdue';
      }
      const daysUntil = differenceInDays(date, now);
      return daysUntil <= 30 ? 'due' : 'upcoming';
    };

    return {
      balancingPayment: {
        date: balancingPaymentDate,
        amount: taxCalculation.totalTax,
        description: `Balancing payment for ${yearLabel}`,
        status: getPaymentStatus(balancingPaymentDate)
      },
      firstPoA: {
        date: firstPoADate,
        amount: halfTax,
        description: `First Payment on Account for ${endYear}-${(endYear + 1).toString().slice(-2)}`,
        status: getPaymentStatus(firstPoADate)
      },
      secondPoA: {
        date: secondPoADate,
        amount: halfTax,
        description: `Second Payment on Account for ${endYear}-${(endYear + 1).toString().slice(-2)}`,
        status: getPaymentStatus(secondPoADate)
      },
      totalDueJan31: taxCalculation.totalTax + halfTax,
      totalDueJul31: halfTax,
      annualTotal: taxCalculation.totalTax + halfTax + halfTax
    };
  }, [taxCalculation, yearLabel, endYear]);

  const getStatusBadge = (status: 'due' | 'upcoming' | 'overdue') => {
    switch (status) {
      case 'due':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"><Clock className="w-3 h-3 mr-1" />Due Soon</Badge>;
      case 'upcoming':
        return <Badge variant="outline"><Calendar className="w-3 h-3 mr-1" />Upcoming</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><AlertCircle className="w-3 h-3 mr-1" />Overdue</Badge>;
    }
  };

  const exportToCSV = () => {
    const rows = [
      ['Payment on Account Tracker'],
      [`Tax Year: ${yearLabel}`],
      [''],
      ['TAX LIABILITY', 'Amount'],
      ['Net Profit', taxCalculation.netProfit],
      ['Income Tax', taxCalculation.incomeTax],
      ['Class 4 NI', taxCalculation.class4NI],
      ['Class 2 NI', taxCalculation.class2NI],
      ['Total Tax Due', taxCalculation.totalTax],
      [''],
      ['PAYMENT SCHEDULE', 'Date', 'Amount', 'Description'],
      ['Balancing Payment', format(payments.balancingPayment.date, 'dd MMM yyyy'), payments.balancingPayment.amount, payments.balancingPayment.description],
      ['First Payment on Account', format(payments.firstPoA.date, 'dd MMM yyyy'), payments.firstPoA.amount, payments.firstPoA.description],
      ['Second Payment on Account', format(payments.secondPoA.date, 'dd MMM yyyy'), payments.secondPoA.amount, payments.secondPoA.description],
      [''],
      ['SUMMARY', ''],
      ['Total due 31 January', payments.totalDueJan31],
      ['Total due 31 July', payments.totalDueJul31],
      ['Total payments this cycle', payments.annualTotal],
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
    link.download = `PaymentOnAccount_${yearLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const rows = [
      ['Payment on Account Tracker'],
      [`Tax Year: ${yearLabel}`],
      [''],
      ['TAX LIABILITY', 'Amount'],
      ['Net Profit', taxCalculation.netProfit],
      ['Income Tax', taxCalculation.incomeTax],
      ['Class 4 NI', taxCalculation.class4NI],
      ['Class 2 NI', taxCalculation.class2NI],
      ['Total Tax Due', taxCalculation.totalTax],
      [''],
      ['PAYMENT SCHEDULE', 'Date', 'Amount', 'Description'],
      ['Balancing Payment', format(payments.balancingPayment.date, 'dd MMM yyyy'), payments.balancingPayment.amount, payments.balancingPayment.description],
      ['First Payment on Account', format(payments.firstPoA.date, 'dd MMM yyyy'), payments.firstPoA.amount, payments.firstPoA.description],
      ['Second Payment on Account', format(payments.secondPoA.date, 'dd MMM yyyy'), payments.secondPoA.amount, payments.secondPoA.description],
      [''],
      ['SUMMARY', ''],
      ['Total due 31 January', payments.totalDueJan31],
      ['Total due 31 July', payments.totalDueJul31],
      ['Total payments this cycle', payments.annualTotal],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment on Account');
    XLSX.writeFile(wb, `PaymentOnAccount_${yearLabel}.xlsx`);
  };

  const now = new Date();
  const nextPaymentDate = [payments.balancingPayment.date, payments.firstPoA.date, payments.secondPoA.date]
    .filter(d => isAfter(d, now))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  
  const daysUntilNextPayment = nextPaymentDate ? differenceInDays(nextPaymentDate, now) : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Track your HMRC payment deadlines based on your current tax liability
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportToCSV} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportToExcel} data-testid="button-export-excel">
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      {daysUntilNextPayment !== null && daysUntilNextPayment <= 60 && (
        <Card className={daysUntilNextPayment <= 30 ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800' : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {daysUntilNextPayment <= 30 ? (
                <AlertCircle className="h-8 w-8 text-orange-600" />
              ) : (
                <Calendar className="h-8 w-8 text-blue-600" />
              )}
              <div>
                <div className="font-bold text-lg">
                  {daysUntilNextPayment <= 0 ? 'Payment due today!' : `${daysUntilNextPayment} days until next payment`}
                </div>
                <div className="text-sm text-muted-foreground">
                  Due: {format(nextPaymentDate!, 'dd MMMM yyyy')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{taxCalculation.netProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">For tax year {yearLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tax</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">£{taxCalculation.totalTax.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Income Tax + NI</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payment on Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{Math.round(taxCalculation.totalTax / 2).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">50% of tax bill</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Due 31 January</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">£{payments.totalDueJan31.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Balancing + 1st PoA</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Schedule</CardTitle>
          <CardDescription>Your HMRC payment dates for tax year {yearLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <div className="font-bold">31 January {endYear + 1}</div>
                <div className="text-sm text-muted-foreground">Balancing payment for {yearLabel}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">£{payments.balancingPayment.amount.toLocaleString()}</div>
              {getStatusBadge(payments.balancingPayment.status)}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="font-bold">31 January {endYear + 1}</div>
                <div className="text-sm text-muted-foreground">First Payment on Account for {endYear}-{(endYear + 1).toString().slice(-2)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">£{payments.firstPoA.amount.toLocaleString()}</div>
              {getStatusBadge(payments.firstPoA.status)}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="font-bold">31 July {endYear + 1}</div>
                <div className="text-sm text-muted-foreground">Second Payment on Account for {endYear}-{(endYear + 1).toString().slice(-2)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">£{payments.secondPoA.amount.toLocaleString()}</div>
              {getStatusBadge(payments.secondPoA.status)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <Info className="h-5 w-5" />
            About Payments on Account
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 dark:text-blue-300 space-y-3">
          <p>
            <strong>What are Payments on Account?</strong> These are advance payments towards next year's tax bill, 
            calculated as 50% of your previous year's tax liability.
          </p>
          <p>
            <strong>When are they due?</strong> The first payment is due on 31 January (same as your balancing payment), 
            and the second is due on 31 July.
          </p>
          <p>
            <strong>Can I reduce them?</strong> If you expect your income to be lower next year, you can apply to reduce 
            your Payments on Account through your HMRC online account.
          </p>
          <p>
            <strong>Note:</strong> Payments on Account apply if your tax bill was more than £1,000 and less than 80% 
            was collected at source (e.g., through PAYE).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
