import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, Home, Calculator, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from 'xlsx';

interface UseOfHomeReportProps {
  yearLabel: string;
}

interface HomeExpenses {
  mortgage: number;
  rent: number;
  councilTax: number;
  waterRates: number;
  electricity: number;
  gas: number;
  homeInsurance: number;
  broadband: number;
  phone: number;
  repairs: number;
}

const HMRC_FLAT_RATES = [
  { hoursMin: 25, hoursMax: 50, monthlyRate: 10 },
  { hoursMin: 51, hoursMax: 100, monthlyRate: 18 },
  { hoursMin: 101, hoursMax: Infinity, monthlyRate: 26 },
];

export function UseOfHomeReport({ yearLabel }: UseOfHomeReportProps) {
  const storageKey = `useOfHome_${yearLabel}`;
  
  const [expenses, setExpenses] = useState<HomeExpenses>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          mortgage: 0, rent: 0, councilTax: 0, waterRates: 0,
          electricity: 0, gas: 0, homeInsurance: 0, broadband: 0, phone: 0, repairs: 0
        };
      }
    }
    return {
      mortgage: 0, rent: 0, councilTax: 0, waterRates: 0,
      electricity: 0, gas: 0, homeInsurance: 0, broadband: 0, phone: 0, repairs: 0
    };
  });

  const [totalRooms, setTotalRooms] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}_rooms`);
    return saved ? parseInt(saved) || 5 : 5;
  });

  const [businessRooms, setBusinessRooms] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}_bizRooms`);
    return saved ? parseInt(saved) || 1 : 1;
  });

  const [hoursPerWeek, setHoursPerWeek] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}_hours`);
    return saved ? parseInt(saved) || 30 : 30;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(expenses));
    localStorage.setItem(`${storageKey}_rooms`, String(totalRooms));
    localStorage.setItem(`${storageKey}_bizRooms`, String(businessRooms));
    localStorage.setItem(`${storageKey}_hours`, String(hoursPerWeek));
  }, [expenses, totalRooms, businessRooms, hoursPerWeek, storageKey]);

  const calculations = useMemo(() => {
    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
    const roomProportion = totalRooms > 0 ? businessRooms / totalRooms : 0;
    const proportionalClaim = totalExpenses * roomProportion;

    const hoursPerMonth = hoursPerWeek * 4.33;
    const flatRateEntry = HMRC_FLAT_RATES.find(r => hoursPerMonth >= r.hoursMin && hoursPerMonth <= r.hoursMax);
    const monthlyFlatRate = flatRateEntry ? flatRateEntry.monthlyRate : 0;
    const annualFlatRate = monthlyFlatRate * 12;

    return {
      totalExpenses,
      roomProportion: roomProportion * 100,
      proportionalClaim,
      hoursPerMonth: Math.round(hoursPerMonth),
      monthlyFlatRate,
      annualFlatRate,
      recommended: proportionalClaim > annualFlatRate ? 'proportional' : 'flat'
    };
  }, [expenses, totalRooms, businessRooms, hoursPerWeek]);

  const updateExpense = (field: keyof HomeExpenses, value: string) => {
    const numValue = parseFloat(value) || 0;
    setExpenses(prev => ({ ...prev, [field]: numValue }));
  };

  const exportToCSV = () => {
    const rows = [
      ['Use of Home Calculation'],
      [`Tax Year: ${yearLabel}`],
      [''],
      ['HOUSEHOLD EXPENSES', 'Annual Amount'],
      ['Mortgage/Rent Interest', expenses.mortgage + expenses.rent],
      ['Council Tax', expenses.councilTax],
      ['Water Rates', expenses.waterRates],
      ['Electricity', expenses.electricity],
      ['Gas', expenses.gas],
      ['Home Insurance', expenses.homeInsurance],
      ['Broadband', expenses.broadband],
      ['Phone', expenses.phone],
      ['Repairs & Maintenance', expenses.repairs],
      ['TOTAL HOUSEHOLD EXPENSES', calculations.totalExpenses],
      [''],
      ['CALCULATION METHOD 1: Proportional', ''],
      ['Total Rooms', totalRooms],
      ['Business Rooms', businessRooms],
      ['Proportion %', `${calculations.roomProportion.toFixed(1)}%`],
      ['Allowable Claim', calculations.proportionalClaim],
      [''],
      ['CALCULATION METHOD 2: HMRC Flat Rate', ''],
      ['Hours worked per week', hoursPerWeek],
      ['Hours worked per month', calculations.hoursPerMonth],
      ['Monthly flat rate', calculations.monthlyFlatRate],
      ['Annual Flat Rate Claim', calculations.annualFlatRate],
      [''],
      ['RECOMMENDED METHOD', calculations.recommended === 'proportional' ? 'Proportional' : 'Flat Rate'],
      ['RECOMMENDED CLAIM', calculations.recommended === 'proportional' ? calculations.proportionalClaim : calculations.annualFlatRate],
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
    link.download = `UseOfHome_${yearLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    const rows = [
      ['Use of Home Calculation'],
      [`Tax Year: ${yearLabel}`],
      [''],
      ['HOUSEHOLD EXPENSES', 'Annual Amount'],
      ['Mortgage/Rent Interest', expenses.mortgage + expenses.rent],
      ['Council Tax', expenses.councilTax],
      ['Water Rates', expenses.waterRates],
      ['Electricity', expenses.electricity],
      ['Gas', expenses.gas],
      ['Home Insurance', expenses.homeInsurance],
      ['Broadband', expenses.broadband],
      ['Phone', expenses.phone],
      ['Repairs & Maintenance', expenses.repairs],
      ['TOTAL HOUSEHOLD EXPENSES', calculations.totalExpenses],
      [''],
      ['CALCULATION METHOD 1: Proportional', ''],
      ['Total Rooms', totalRooms],
      ['Business Rooms', businessRooms],
      ['Proportion %', `${calculations.roomProportion.toFixed(1)}%`],
      ['Allowable Claim', calculations.proportionalClaim],
      [''],
      ['CALCULATION METHOD 2: HMRC Flat Rate', ''],
      ['Hours worked per week', hoursPerWeek],
      ['Hours worked per month', calculations.hoursPerMonth],
      ['Monthly flat rate', calculations.monthlyFlatRate],
      ['Annual Flat Rate Claim', calculations.annualFlatRate],
      [''],
      ['RECOMMENDED METHOD', calculations.recommended === 'proportional' ? 'Proportional' : 'Flat Rate'],
      ['RECOMMENDED CLAIM', calculations.recommended === 'proportional' ? calculations.proportionalClaim : calculations.annualFlatRate],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 35 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Use of Home');
    XLSX.writeFile(wb, `UseOfHome_${yearLabel}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Calculate the allowable portion of household expenses for working from home
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Household Expenses
            </CardTitle>
            <CardDescription>Enter your annual household costs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mortgage">Mortgage Interest / Rent</Label>
                <Input
                  id="mortgage"
                  type="number"
                  value={expenses.mortgage + expenses.rent || ''}
                  onChange={(e) => updateExpense('mortgage', e.target.value)}
                  placeholder="0"
                  data-testid="input-mortgage"
                />
              </div>
              <div>
                <Label htmlFor="councilTax">Council Tax</Label>
                <Input
                  id="councilTax"
                  type="number"
                  value={expenses.councilTax || ''}
                  onChange={(e) => updateExpense('councilTax', e.target.value)}
                  placeholder="0"
                  data-testid="input-council-tax"
                />
              </div>
              <div>
                <Label htmlFor="electricity">Electricity</Label>
                <Input
                  id="electricity"
                  type="number"
                  value={expenses.electricity || ''}
                  onChange={(e) => updateExpense('electricity', e.target.value)}
                  placeholder="0"
                  data-testid="input-electricity"
                />
              </div>
              <div>
                <Label htmlFor="gas">Gas</Label>
                <Input
                  id="gas"
                  type="number"
                  value={expenses.gas || ''}
                  onChange={(e) => updateExpense('gas', e.target.value)}
                  placeholder="0"
                  data-testid="input-gas"
                />
              </div>
              <div>
                <Label htmlFor="waterRates">Water Rates</Label>
                <Input
                  id="waterRates"
                  type="number"
                  value={expenses.waterRates || ''}
                  onChange={(e) => updateExpense('waterRates', e.target.value)}
                  placeholder="0"
                  data-testid="input-water"
                />
              </div>
              <div>
                <Label htmlFor="homeInsurance">Home Insurance</Label>
                <Input
                  id="homeInsurance"
                  type="number"
                  value={expenses.homeInsurance || ''}
                  onChange={(e) => updateExpense('homeInsurance', e.target.value)}
                  placeholder="0"
                  data-testid="input-insurance"
                />
              </div>
              <div>
                <Label htmlFor="broadband">Broadband</Label>
                <Input
                  id="broadband"
                  type="number"
                  value={expenses.broadband || ''}
                  onChange={(e) => updateExpense('broadband', e.target.value)}
                  placeholder="0"
                  data-testid="input-broadband"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="number"
                  value={expenses.phone || ''}
                  onChange={(e) => updateExpense('phone', e.target.value)}
                  placeholder="0"
                  data-testid="input-phone"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="repairs">Repairs & Maintenance</Label>
                <Input
                  id="repairs"
                  type="number"
                  value={expenses.repairs || ''}
                  onChange={(e) => updateExpense('repairs', e.target.value)}
                  placeholder="0"
                  data-testid="input-repairs"
                />
              </div>
            </div>
            <div className="pt-4 border-t">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Annual Expenses</span>
                <span>£{calculations.totalExpenses.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Business Use
            </CardTitle>
            <CardDescription>Enter your home office usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="totalRooms">Total rooms in home (excluding bathrooms & kitchen)</Label>
                <Input
                  id="totalRooms"
                  type="number"
                  value={totalRooms || ''}
                  onChange={(e) => setTotalRooms(parseInt(e.target.value) || 0)}
                  placeholder="5"
                  data-testid="input-total-rooms"
                />
              </div>
              <div>
                <Label htmlFor="businessRooms">Rooms used for business</Label>
                <Input
                  id="businessRooms"
                  type="number"
                  value={businessRooms || ''}
                  onChange={(e) => setBusinessRooms(parseInt(e.target.value) || 0)}
                  placeholder="1"
                  data-testid="input-business-rooms"
                />
              </div>
              <div>
                <Label htmlFor="hoursPerWeek">Hours worked from home per week</Label>
                <Input
                  id="hoursPerWeek"
                  type="number"
                  value={hoursPerWeek || ''}
                  onChange={(e) => setHoursPerWeek(parseInt(e.target.value) || 0)}
                  placeholder="30"
                  data-testid="input-hours-week"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="comparison" className="w-full">
        <TabsList data-testid="tabs-use-of-home">
          <TabsTrigger value="comparison" data-testid="tab-comparison">Comparison</TabsTrigger>
          <TabsTrigger value="proportional" data-testid="tab-proportional">Proportional Method</TabsTrigger>
          <TabsTrigger value="flatrate" data-testid="tab-flatrate">HMRC Flat Rate</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className={calculations.recommended === 'proportional' ? 'border-green-500 border-2' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Proportional Method
                  {calculations.recommended === 'proportional' && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Recommended</span>
                  )}
                </CardTitle>
                <CardDescription>Based on room usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center py-4">
                  £{calculations.proportionalClaim.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-sm text-muted-foreground text-center">
                  {businessRooms} of {totalRooms} rooms = {calculations.roomProportion.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card className={calculations.recommended === 'flat' ? 'border-green-500 border-2' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  HMRC Flat Rate
                  {calculations.recommended === 'flat' && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Recommended</span>
                  )}
                </CardTitle>
                <CardDescription>Based on hours worked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-center py-4">
                  £{calculations.annualFlatRate.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground text-center">
                  £{calculations.monthlyFlatRate}/month x 12 months
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="proportional" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Proportional Calculation</CardTitle>
              <CardDescription>Claim a proportion of actual costs based on space used</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span>Total annual household expenses</span>
                  <span className="font-medium">£{calculations.totalExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Business rooms ({businessRooms}) / Total rooms ({totalRooms})</span>
                  <span className="font-medium">{calculations.roomProportion.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                  <span>Allowable Claim</span>
                  <span className="text-green-600">£{calculations.proportionalClaim.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg text-sm">
                <p className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  This method requires keeping records of actual household bills. You can only claim the proportion of time/space used for business.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flatrate" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>HMRC Flat Rate (Simplified Expenses)</CardTitle>
              <CardDescription>Claim a fixed monthly amount based on hours worked</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span>Hours worked per week</span>
                  <span className="font-medium">{hoursPerWeek} hours</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Approximate hours per month</span>
                  <span className="font-medium">{calculations.hoursPerMonth} hours</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Monthly flat rate</span>
                  <span className="font-medium">£{calculations.monthlyFlatRate}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                  <span>Annual Claim (12 months)</span>
                  <span className="text-green-600">£{calculations.annualFlatRate.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <h4 className="font-medium mb-2">HMRC Flat Rates</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Hours per month</th>
                      <th className="text-right py-2">Monthly amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={calculations.hoursPerMonth >= 25 && calculations.hoursPerMonth <= 50 ? 'bg-green-50 dark:bg-green-950' : ''}>
                      <td className="py-2">25 to 50</td>
                      <td className="text-right py-2">£10</td>
                    </tr>
                    <tr className={calculations.hoursPerMonth >= 51 && calculations.hoursPerMonth <= 100 ? 'bg-green-50 dark:bg-green-950' : ''}>
                      <td className="py-2">51 to 100</td>
                      <td className="text-right py-2">£18</td>
                    </tr>
                    <tr className={calculations.hoursPerMonth >= 101 ? 'bg-green-50 dark:bg-green-950' : ''}>
                      <td className="py-2">101 or more</td>
                      <td className="text-right py-2">£26</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
