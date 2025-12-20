import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Transaction } from "@/lib/types";
import { SA103_EXPENSE_CATEGORIES } from "@shared/categories";

interface TaxSummaryProps {
  transactions: Transaction[];
  yearLabel: string;
}

export function TaxSummary({ transactions, yearLabel }: TaxSummaryProps) {
  const data = useMemo(() => {
    let turnover = 0;
    let otherIncome = 0;

    // Expenses Map - aligned with SA103F boxes
    const expenses = {
      costOfGoods: 0, // 17
      construction: 0, // 18
      wages: 0, // 19
      travel: 0, // 20
      rent: 0, // 21
      repairs: 0, // 22
      admin: 0, // 23 (Phone, fax, stationery)
      advertising: 0, // 24
      interest: 0, // 25
      bankCharges: 0, // 26
      badDebts: 0, // 27
      professional: 0, // 28 (Accountancy)
      depreciation: 0, // 29
      other: 0, // 30
      disallowable: {
         travel: 0, // 35
         advertising: 0, // 39
         other: 0 // 45 (Just mocking some disallowables)
      }
    };

    transactions.forEach(t => {
      if (t.type !== 'Business') return;
      
      const amount = Math.abs(Number(t.amount));

      if (t.businessType === 'Income') {
        turnover += amount;
      } else if (t.businessType === 'Expense') {
        const cat = t.category || 'Other Expenses';
        
        // Map SA103 category labels to expense buckets
        switch (cat) {
          case 'Cost of Goods':
            expenses.costOfGoods += amount;
            break;
          case 'Subcontractor Costs':
            expenses.construction += amount;
            break;
          case 'Staff Costs':
            expenses.wages += amount;
            break;
          case 'Travel & Vehicle':
            expenses.travel += amount;
            expenses.disallowable.travel += amount * 0.05; // 5% personal use estimate
            break;
          case 'Premises Costs':
            expenses.rent += amount;
            break;
          case 'Repairs & Maintenance':
            expenses.repairs += amount;
            break;
          case 'Office Costs':
            expenses.admin += amount;
            break;
          case 'Advertising':
            expenses.advertising += amount;
            break;
          case 'Loan Interest':
            expenses.interest += amount;
            break;
          case 'Bank Charges':
            expenses.bankCharges += amount;
            break;
          case 'Bad Debts':
            expenses.badDebts += amount;
            break;
          case 'Professional Fees':
            expenses.professional += amount;
            break;
          case 'Depreciation':
            expenses.depreciation += amount;
            break;
          case 'Other Expenses':
          default:
            expenses.other += amount;
            break;
        }
      }
    });
    
    // Rounding
    const round = (n: number) => Math.round(n);
    
    // Profit Calculation
    const totalExpenses = round(
         Object.values(expenses)
           .filter((val): val is number => typeof val === 'number')
           .reduce((a, b) => a + b, 0) - 
         (expenses.disallowable.travel + expenses.disallowable.advertising + expenses.disallowable.other)
       );
    const totalIncome = round(turnover + otherIncome);
    const netProfit = Math.max(0, totalIncome - totalExpenses);

    // Tax Calculation (Mock 2024/25 Rates)
    // Personal Allowance: £12,570
    // Basic Rate (20%): £12,571 - £50,270
    // Higher Rate (40%): £50,271 - £125,140
    // Additional Rate (45%): £125,140+
    
    const personalAllowance = 12570;
    const taxableIncome = Math.max(0, netProfit - personalAllowance);
    let incomeTax = 0;

    if (taxableIncome > 0) {
        const basicRateLimit = 37700; // 50270 - 12570
        if (taxableIncome <= basicRateLimit) {
            incomeTax += taxableIncome * 0.20;
        } else {
            incomeTax += basicRateLimit * 0.20;
            const higherRateLimit = 125140 - 50270;
            const remaining = taxableIncome - basicRateLimit;
            if (remaining <= higherRateLimit) {
                 incomeTax += remaining * 0.40;
            } else {
                 incomeTax += higherRateLimit * 0.40;
                 incomeTax += (remaining - higherRateLimit) * 0.45;
            }
        }
    }

    // Class 4 NI (Self Employed)
    // 2024/25: 6% on profits between £12,570 and £50,270
    // 2% on profits over £50,270
    let class4NI = 0;
    if (netProfit > 12570) {
        const niTable = Math.min(netProfit, 50270) - 12570;
        class4NI += niTable * 0.06;
        
        if (netProfit > 50270) {
            class4NI += (netProfit - 50270) * 0.02;
        }
    }

    // Class 2 NI (Abolished/Zero for many in 24/25 but keeping placeholder as per screenshot request)
    const class2NI = 0;

    return {
       turnover: round(turnover),
       otherIncome: round(otherIncome),
       totalIncome,
       expenses: {
         costOfGoods: round(expenses.costOfGoods),
         construction: round(expenses.construction),
         wages: round(expenses.wages),
         travel: round(expenses.travel - expenses.disallowable.travel),
         rent: round(expenses.rent),
         repairs: round(expenses.repairs),
         admin: round(expenses.admin),
         advertising: round(expenses.advertising),
         interest: round(expenses.interest),
         bankCharges: round(expenses.bankCharges),
         badDebts: round(expenses.badDebts),
         professional: round(expenses.professional),
         depreciation: round(expenses.depreciation),
         other: round(expenses.other),
       },
       disallowable: {
         travel: round(expenses.disallowable.travel),
         advertising: round(expenses.disallowable.advertising),
         other: round(expenses.disallowable.other),
       },
       totalExpenses,
       totalDisallowable: round(
         expenses.disallowable.travel + expenses.disallowable.advertising + expenses.disallowable.other
       ),
       netProfit: round(netProfit),
       tax: {
           incomeTax: round(incomeTax),
           class4NI: round(class4NI),
           class2NI: round(class2NI),
           total: round(incomeTax + class4NI + class2NI)
       }
    };
  }, [transactions]);

  const Row = ({ label, boxAllowable, valAllowable, boxDisallowable, valDisallowable, isHeader = false, isTotal = false }: any) => (
    <div className={`flex items-center py-2 text-sm ${isHeader ? 'font-semibold text-muted-foreground border-b' : 'border-b border-dashed border-gray-100 dark:border-gray-800'} ${isTotal ? 'border-t border-b-2 border-solid border-gray-900 dark:border-gray-100 font-bold py-3 text-base' : ''}`}>
      <div className="flex-1 pr-4">{label}</div>
      <div className="w-24 text-right flex items-center justify-end gap-2">
         {valAllowable !== undefined && (
            <>
                <span>£{valAllowable.toLocaleString()}</span>
                {boxAllowable && <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded w-5 text-center">{boxAllowable}</span>}
            </>
         )}
      </div>
      <div className="w-24 text-right flex items-center justify-end gap-2 ml-4">
        {valDisallowable !== undefined && (
            <>
                <span>£{valDisallowable.toLocaleString()}</span>
                {boxDisallowable && <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded w-5 text-center">{boxDisallowable}</span>}
            </>
         )}
      </div>
    </div>
  );

  return (
    <Card className="print:shadow-none">
      <CardHeader>
        <div className="flex justify-between items-start">
             <div>
                <CardTitle className="text-2xl">Self-Assessment Summary {yearLabel}</CardTitle>
                <CardDescription>Based on SA103F categories</CardDescription>
             </div>
             <div className="text-right text-sm text-muted-foreground">
                6 April {yearLabel.split('-')[0]} - 5 April 20{yearLabel.split('-')[1]}
             </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
            
            {/* Income Section */}
            <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">Business income</h3>
                <div className="space-y-1">
                    <Row label="Your turnover - the takings, fees, sales or money earned by your business" valAllowable={data.turnover} boxAllowable="15" />
                    <Row label="Any other business income not included in box 15" valAllowable={0} boxAllowable="16" />
                    <Row label="TOTAL BUSINESS INCOME" valAllowable={data.totalIncome} isTotal />
                </div>
            </div>

            {/* Expenses Section */}
            <div>
                <div className="flex items-end justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Business expenses</h3>
                    <div className="flex text-xs font-bold text-gray-500 uppercase">
                        <div className="w-24 text-right mr-4">Allowable<br/>Expenses</div>
                        <div className="w-24 text-right">Disallowable<br/>Expenses</div>
                    </div>
                </div>
                
                <div className="space-y-1">
                    <Row label="Cost of goods bought for resale or goods used" valAllowable={data.expenses.costOfGoods} boxAllowable="17" valDisallowable={0} boxDisallowable="32" />
                    <Row label="Construction industry - payments to subcontractors" valAllowable={data.expenses.construction} boxAllowable="18" valDisallowable={0} boxDisallowable="33" />
                    <Row label="Wages, salaries and other staff costs" valAllowable={data.expenses.wages} boxAllowable="19" valDisallowable={0} boxDisallowable="34" />
                    <Row label="Car, van and travel expenses" valAllowable={data.expenses.travel} boxAllowable="20" valDisallowable={data.disallowable.travel} boxDisallowable="35" />
                    <Row label="Rent, rates, power and insurance costs" valAllowable={data.expenses.rent} boxAllowable="21" valDisallowable={0} boxDisallowable="36" />
                    <Row label="Repairs and renewals of property and equipment" valAllowable={data.expenses.repairs} boxAllowable="22" valDisallowable={0} boxDisallowable="37" />
                    <Row label="Phone, fax, stationery and other office costs" valAllowable={data.expenses.admin} boxAllowable="23" valDisallowable={0} boxDisallowable="38" />
                    <Row label="Advertising and business entertainment costs" valAllowable={data.expenses.advertising} boxAllowable="24" valDisallowable={data.disallowable.advertising} boxDisallowable="39" />
                    <Row label="Interest on bank and other loans" valAllowable={data.expenses.interest} boxAllowable="25" valDisallowable={0} boxDisallowable="40" />
                    <Row label="Bank, credit card and other financial charges" valAllowable={data.expenses.bankCharges} boxAllowable="26" valDisallowable={0} boxDisallowable="41" />
                    <Row label="Irrecoverable debts written off" valAllowable={data.expenses.badDebts} boxAllowable="27" valDisallowable={0} boxDisallowable="42" />
                    <Row label="Accountancy, legal and other professional fees" valAllowable={data.expenses.professional} boxAllowable="28" valDisallowable={0} boxDisallowable="43" />
                    <Row label="Depreciation and loss/profit on sale of assets" valAllowable={data.expenses.depreciation} boxAllowable="29" valDisallowable={0} boxDisallowable="44" />
                    <Row label="Other business expenses" valAllowable={data.expenses.other} boxAllowable="30" valDisallowable={data.disallowable.other} boxDisallowable="45" />
                    
                    <div className="pt-2">
                        <Row label="TOTAL" valAllowable={data.totalExpenses} boxAllowable="31" valDisallowable={data.totalDisallowable} boxDisallowable="46" isTotal />
                    </div>
                </div>
                 <p className="text-right text-xs text-muted-foreground mt-2">SA103F box numbers included</p>
            </div>

            {/* Net Profit Section */}
            <div>
                 <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">Net profit or loss</h3>
                 <div className="space-y-1">
                    <Row label="Total business income" valAllowable={data.totalIncome} />
                    <Row label="Total allowable expenses" valAllowable={data.totalExpenses} boxAllowable="31" />
                    <Row label="NET PROFIT" valAllowable={data.netProfit} boxAllowable="47" isTotal />
                 </div>
            </div>

            {/* Tax Section */}
            <div>
                 <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-300">Tax</h3>
                 <div className="space-y-1">
                    <Row label="Income tax" valAllowable={data.tax.incomeTax} />
                    <Row label="Class 4 National Insurance Contribution" valAllowable={data.tax.class4NI} />
                    <Row label="Class 2 National Insurance Contribution" valAllowable={data.tax.class2NI} />
                    <Row label="TOTAL TAX" valAllowable={data.tax.total} isTotal />
                 </div>
            </div>

        </div>
      </CardContent>
    </Card>
  );
}
