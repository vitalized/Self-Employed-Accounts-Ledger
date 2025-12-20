import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Transaction } from "@/lib/types";

interface TaxSummaryProps {
  transactions: Transaction[];
  yearLabel: string;
}

export function TaxSummary({ transactions, yearLabel }: TaxSummaryProps) {
  const data = useMemo(() => {
    let turnover = 0;
    let otherIncome = 0;

    // Expenses Map
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
      professional: 0, // 28 (Accountancy)
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
        const cat = t.category || 'Other';
        
        // Mapping logic
        if (cat === 'Travel') {
           expenses.travel += amount;
           // Mock 5% disallowable for travel (e.g. personal use)
           expenses.disallowable.travel += amount * 0.05;
        } else if (cat === 'Office Supplies') {
           expenses.admin += amount;
        } else if (cat === 'Services') {
           expenses.professional += amount;
        } else if (cat === 'Equipment') {
           expenses.costOfGoods += amount; // Treat equipment as cost of goods for this mapping roughly
        } else {
           expenses.other += amount;
        }
      }
    });
    
    // Rounding
    const round = (n: number) => Math.round(n);
    
    return {
       turnover: round(turnover),
       otherIncome: round(otherIncome),
       totalIncome: round(turnover + otherIncome),
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
         professional: round(expenses.professional),
         other: round(expenses.other),
       },
       disallowable: {
         travel: round(expenses.disallowable.travel),
         advertising: round(expenses.disallowable.advertising),
         other: round(expenses.disallowable.other),
       },
       totalExpenses: round(
         Object.values(expenses)
           .filter((val): val is number => typeof val === 'number')
           .reduce((a, b) => a + b, 0) - 
         (expenses.disallowable.travel + expenses.disallowable.advertising + expenses.disallowable.other)
       ),
       totalDisallowable: round(
         expenses.disallowable.travel + expenses.disallowable.advertising + expenses.disallowable.other
       )
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
                    <Row label="Accountancy, legal and other professional fees" valAllowable={data.expenses.professional} boxAllowable="28" valDisallowable={0} boxDisallowable="43" />
                    <Row label="Other business expenses" valAllowable={data.expenses.other} boxAllowable="30" valDisallowable={data.disallowable.other} boxDisallowable="45" />
                    
                    <div className="pt-2">
                        <Row label="TOTAL" valAllowable={data.totalExpenses} boxAllowable="31" valDisallowable={data.totalDisallowable} boxDisallowable="46" isTotal />
                    </div>
                </div>
                 <p className="text-right text-xs text-muted-foreground mt-2">SA103F box numbers included</p>
            </div>

        </div>
      </CardContent>
    </Card>
  );
}
