import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Transaction, isIncludedInProfit } from "@/lib/types";
import { parseISO, format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Calendar, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from 'xlsx';

interface MTDQuarterlyReportProps {
  transactions: Transaction[];
  yearLabel: string;
}

interface QuarterData {
  quarter: number;
  name: string;
  startDate: Date;
  endDate: Date;
  income: number;
  expenses: number;
  profit: number;
  status: 'submitted' | 'due' | 'upcoming' | 'past';
  dueDate: string;
}

export function MTDQuarterlyReport({ transactions, yearLabel }: MTDQuarterlyReportProps) {
  const startYear = parseInt(yearLabel.split('-')[0]);
  const endYear = 2000 + parseInt(yearLabel.split('-')[1]);

  const quarters = useMemo(() => {
    const q1Start = new Date(startYear, 3, 6);
    const q1End = new Date(startYear, 6, 5);
    const q2Start = new Date(startYear, 6, 6);
    const q2End = new Date(startYear, 9, 5);
    const q3Start = new Date(startYear, 9, 6);
    const q3End = new Date(endYear, 0, 5);
    const q4Start = new Date(endYear, 0, 6);
    const q4End = new Date(endYear, 3, 5);

    const now = new Date();

    const getQuarterData = (q: number, start: Date, end: Date, dueDate: string): QuarterData => {
      let income = 0;
      let expenses = 0;

      transactions.forEach(t => {
        if (t.type !== 'Business' || !isIncludedInProfit(t)) return;
        const date = parseISO(t.date);
        if (!isWithinInterval(date, { start, end })) return;

        const amount = Number(t.amount);
        if (t.businessType === 'Income') {
          income += amount;
        } else if (t.businessType === 'Expense') {
          expenses += Math.abs(amount);
        }
      });

      let status: 'submitted' | 'due' | 'upcoming' | 'past';
      if (now > end) {
        const dueDateParsed = parseISO(dueDate);
        if (now > dueDateParsed) {
          status = 'past';
        } else {
          status = 'due';
        }
      } else if (now >= start) {
        status = 'upcoming';
      } else {
        status = 'upcoming';
      }

      return {
        quarter: q,
        name: `Q${q}`,
        startDate: start,
        endDate: end,
        income,
        expenses,
        profit: income - expenses,
        status,
        dueDate
      };
    };

    return [
      getQuarterData(1, q1Start, q1End, `${startYear}-08-07`),
      getQuarterData(2, q2Start, q2End, `${startYear}-11-07`),
      getQuarterData(3, q3Start, q3End, `${endYear}-02-07`),
      getQuarterData(4, q4Start, q4End, `${endYear}-05-07`),
    ];
  }, [transactions, startYear, endYear]);

  const totals = useMemo(() => {
    return quarters.reduce((acc, q) => ({
      income: acc.income + q.income,
      expenses: acc.expenses + q.expenses,
      profit: acc.profit + q.profit
    }), { income: 0, expenses: 0, profit: 0 });
  }, [quarters]);

  const getStatusBadge = (status: QuarterData['status']) => {
    switch (status) {
      case 'submitted':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="w-3 h-3 mr-1" />Submitted</Badge>;
      case 'due':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"><Clock className="w-3 h-3 mr-1" />Due</Badge>;
      case 'past':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Past Due Date</Badge>;
      case 'upcoming':
        return <Badge variant="outline"><Calendar className="w-3 h-3 mr-1" />Upcoming</Badge>;
    }
  };

  const exportToCSV = () => {
    const rows = [
      ['Making Tax Digital - Quarterly Summary'],
      [`Tax Year: ${yearLabel}`],
      [''],
      ['Quarter', 'Period', 'Income', 'Expenses', 'Profit/Loss', 'Due Date', 'Status'],
      ...quarters.map(q => [
        q.name,
        `${format(q.startDate, 'dd MMM yyyy')} - ${format(q.endDate, 'dd MMM yyyy')}`,
        q.income,
        q.expenses,
        q.profit,
        format(parseISO(q.dueDate), 'dd MMM yyyy'),
        q.status
      ]),
      [''],
      ['TOTALS', '', totals.income, totals.expenses, totals.profit, '', '']
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
    link.download = `MTD_Quarterly_${yearLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const rows = [
      ['Making Tax Digital - Quarterly Summary'],
      [`Tax Year: ${yearLabel}`],
      [''],
      ['Quarter', 'Period', 'Income', 'Expenses', 'Profit/Loss', 'Due Date', 'Status'],
      ...quarters.map(q => [
        q.name,
        `${format(q.startDate, 'dd MMM yyyy')} - ${format(q.endDate, 'dd MMM yyyy')}`,
        q.income,
        q.expenses,
        q.profit,
        format(parseISO(q.dueDate), 'dd MMM yyyy'),
        q.status
      ]),
      [''],
      ['TOTALS', '', totals.income, totals.expenses, totals.profit, '', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MTD Quarterly');
    XLSX.writeFile(wb, `MTD_Quarterly_${yearLabel}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Making Tax Digital requires quarterly updates to HMRC for self-employed income over £50,000
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

      <div className="grid gap-4 md:grid-cols-4">
        {quarters.map(q => (
          <Card key={q.quarter} data-testid={`card-quarter-${q.quarter}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{q.name}</CardTitle>
                {getStatusBadge(q.status)}
              </div>
              <CardDescription className="text-xs">
                {format(q.startDate, 'dd MMM yyyy')} - {format(q.endDate, 'dd MMM yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Income</span>
                <span className="font-medium text-green-600">£{q.income.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expenses</span>
                <span className="font-medium text-red-600">£{q.expenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-medium">Profit/Loss</span>
                <span className={`font-bold ${q.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  £{q.profit.toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-muted-foreground pt-2">
                Due: {format(parseISO(q.dueDate), 'dd MMM yyyy')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Annual Summary</CardTitle>
          <CardDescription>Combined totals for tax year {yearLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600">£{totals.income.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Income</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600">£{totals.expenses.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Expenses</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                £{totals.profit.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Net Profit</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MTD Submission Deadlines</CardTitle>
          <CardDescription>Key dates for quarterly updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {quarters.map(q => (
              <div key={q.quarter} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                    {q.name}
                  </div>
                  <div>
                    <div className="font-medium">{format(q.startDate, 'MMM yyyy')} - {format(q.endDate, 'MMM yyyy')}</div>
                    <div className="text-sm text-muted-foreground">
                      Submit by {format(parseISO(q.dueDate), 'dd MMMM yyyy')}
                    </div>
                  </div>
                </div>
                {getStatusBadge(q.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-200">About Making Tax Digital</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
          <p>From April 2026, self-employed individuals and landlords with income over £50,000 must use MTD-compatible software to keep digital records and submit quarterly updates to HMRC.</p>
          <p>Those with income over £30,000 will need to comply from April 2027.</p>
          <p>Each quarterly update must be submitted within one month and 7 days of the quarter end.</p>
        </CardContent>
      </Card>
    </div>
  );
}
