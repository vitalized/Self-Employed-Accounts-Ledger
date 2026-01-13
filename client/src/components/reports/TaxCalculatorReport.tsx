import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Transaction, isIncludedInProfit } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface TaxCalculatorReportProps {
  transactions: Transaction[];
  yearLabel: string;
}

const COLORS = ['#f97316', '#22c55e', '#0ea5e9'];

export function TaxCalculatorReport({ transactions, yearLabel }: TaxCalculatorReportProps) {
  const calculatedProfit = useMemo(() => {
    let income = 0;
    let expenses = 0;

    transactions.forEach(t => {
      if (t.type === 'Business' && isIncludedInProfit(t)) {
        const amount = Number(t.amount);
        if (t.businessType === 'Income') {
          income += amount;
        } else if (t.businessType === 'Expense') {
          expenses += Math.abs(amount);
        }
      }
    });

    return income - expenses;
  }, [transactions]);

  const [customProfit, setCustomProfit] = useState<string>('');
  const profit = customProfit ? parseFloat(customProfit) || 0 : calculatedProfit;

  const taxCalc = useMemo(() => {
    const personalAllowance = 12570;
    const basicRateLimit = 50270;
    const higherRateLimit = 125140;

    let taxableIncome = Math.max(0, profit - personalAllowance);
    let incomeTax = 0;
    let breakdown: { band: string; rate: string; amount: number; tax: number }[] = [];

    if (taxableIncome > 0) {
      const basicBandSize = basicRateLimit - personalAllowance;
      const basicTaxable = Math.min(taxableIncome, basicBandSize);
      const basicTax = basicTaxable * 0.20;
      incomeTax += basicTax;
      if (basicTaxable > 0) {
        breakdown.push({ band: 'Basic Rate', rate: '20%', amount: basicTaxable, tax: basicTax });
      }

      if (taxableIncome > basicBandSize) {
        const higherBandSize = higherRateLimit - basicRateLimit;
        const higherTaxable = Math.min(taxableIncome - basicBandSize, higherBandSize);
        const higherTax = higherTaxable * 0.40;
        incomeTax += higherTax;
        if (higherTaxable > 0) {
          breakdown.push({ band: 'Higher Rate', rate: '40%', amount: higherTaxable, tax: higherTax });
        }

        if (taxableIncome > basicBandSize + higherBandSize) {
          const additionalTaxable = taxableIncome - basicBandSize - higherBandSize;
          const additionalTax = additionalTaxable * 0.45;
          incomeTax += additionalTax;
          if (additionalTaxable > 0) {
            breakdown.push({ band: 'Additional Rate', rate: '45%', amount: additionalTaxable, tax: additionalTax });
          }
        }
      }
    }

    const class4LowerLimit = 12570;
    const class4UpperLimit = 50270;
    let class4NI = 0;
    if (profit > class4LowerLimit) {
      if (profit <= class4UpperLimit) {
        class4NI = (profit - class4LowerLimit) * 0.09;
      } else {
        class4NI = (class4UpperLimit - class4LowerLimit) * 0.09;
        class4NI += (profit - class4UpperLimit) * 0.02;
      }
    }

    const class2NI = profit > 6725 ? 3.45 * 52 : 0;

    return {
      personalAllowance,
      taxableIncome,
      incomeTax: Math.round(incomeTax),
      class4NI: Math.round(class4NI),
      class2NI: Math.round(class2NI),
      total: Math.round(incomeTax + class4NI + class2NI),
      breakdown,
      effectiveRate: profit > 0 ? ((incomeTax + class4NI + class2NI) / profit * 100).toFixed(1) : '0'
    };
  }, [profit]);

  const pieData = [
    { name: 'Income Tax', value: taxCalc.incomeTax },
    { name: 'Class 4 NI', value: taxCalc.class4NI },
    { name: 'Class 2 NI', value: taxCalc.class2NI }
  ].filter(d => d.value > 0);

  const barData = taxCalc.breakdown.map(b => ({
    name: b.band,
    tax: b.tax
  }));

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Profit</CardTitle>
          <CardDescription>Based on your transactions or enter a custom amount</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="calculated-profit">Calculated from transactions</Label>
              <div className="text-2xl font-bold mt-1">£{calculatedProfit.toLocaleString()}</div>
            </div>
            <div className="flex-1">
              <Label htmlFor="custom-profit">Or enter custom amount</Label>
              <Input 
                id="custom-profit"
                type="number"
                placeholder="Enter profit amount"
                value={customProfit}
                onChange={(e) => setCustomProfit(e.target.value)}
                className="mt-1"
                data-testid="input-custom-profit"
              />
            </div>
          </div>
          <div className="text-lg">
            <span className="text-muted-foreground">Using: </span>
            <span className="font-bold">£{profit.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList data-testid="tabs-tax-calculator">
          <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
          <TabsTrigger value="charts" data-testid="tab-charts">Charts</TabsTrigger>
          <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Income Tax</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">£{taxCalc.incomeTax.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Class 4 NI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">£{taxCalc.class4NI.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Class 2 NI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">£{taxCalc.class2NI.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Tax Due</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">£{taxCalc.total.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Effective rate: {taxCalc.effectiveRate}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What You Keep</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span>Net Profit</span>
                  <span className="font-medium">£{profit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Total Tax</span>
                  <span className="font-medium text-orange-600">-£{taxCalc.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                  <span>Take Home</span>
                  <span className="text-green-600">£{(profit - taxCalc.total).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tax Composition</CardTitle>
              <CardDescription>Breakdown of your total tax liability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `£${value.toLocaleString()}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No tax liability to display
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax by Band</CardTitle>
              <CardDescription>Income tax breakdown by rate band</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `£${v}`} />
                      <Tooltip formatter={(value: number) => [`£${value.toLocaleString()}`, 'Tax']} />
                      <Bar dataKey="tax" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No income tax bands to display
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Income Tax Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b text-sm">
                  <span className="text-muted-foreground">Net Profit</span>
                  <span>£{profit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b text-sm">
                  <span className="text-muted-foreground">Personal Allowance</span>
                  <span className="text-green-600">-£{taxCalc.personalAllowance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b font-medium">
                  <span>Taxable Income</span>
                  <span>£{taxCalc.taxableIncome.toLocaleString()}</span>
                </div>
                
                {taxCalc.breakdown.map((band, i) => (
                  <div key={i} className="flex justify-between py-2 border-b text-sm">
                    <span>
                      <span className="text-muted-foreground">{band.band} ({band.rate})</span>
                      <span className="ml-2 text-xs text-muted-foreground">on £{band.amount.toLocaleString()}</span>
                    </span>
                    <span>£{band.tax.toLocaleString()}</span>
                  </div>
                ))}

                <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                  <span>Total Income Tax</span>
                  <span className="text-orange-600">£{taxCalc.incomeTax.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>National Insurance</CardTitle>
              <CardDescription>Self-employed NI contributions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <div>
                    <span className="font-medium">Class 4 NI</span>
                    <p className="text-xs text-muted-foreground">9% on profits between £12,570 and £50,270, 2% above</p>
                  </div>
                  <span className="font-medium">£{taxCalc.class4NI.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <div>
                    <span className="font-medium">Class 2 NI</span>
                    <p className="text-xs text-muted-foreground">£3.45/week if profits above £6,725</p>
                  </div>
                  <span className="font-medium">£{taxCalc.class2NI.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                  <span>Total NI</span>
                  <span className="text-orange-600">£{(taxCalc.class4NI + taxCalc.class2NI).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
