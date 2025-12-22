import { useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Transaction } from "@/lib/types";
import { SA103_EXPENSE_CATEGORIES } from "@shared/categories";
import * as XLSX from "xlsx";

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

  const cardRef = useRef<HTMLDivElement>(null);

  const getExportData = () => {
    const startYear = yearLabel.split('-')[0];
    const endYear = '20' + yearLabel.split('-')[1];
    
    return [
      ['Self-Assessment Summary SA103F', '', '', '', ''],
      ['Tax Year', `${yearLabel}`, '', '', ''],
      ['Period', `6 April ${startYear} - 5 April ${endYear}`, '', '', ''],
      ['', '', '', '', ''],
      ['BUSINESS INCOME', 'Amount', 'Box', '', ''],
      ['Your turnover - the takings, fees, sales or money earned by your business', data.turnover, '15', '', ''],
      ['Any other business income not included in box 15', 0, '16', '', ''],
      ['TOTAL BUSINESS INCOME', data.totalIncome, '', '', ''],
      ['', '', '', '', ''],
      ['BUSINESS EXPENSES', 'Allowable', 'Box', 'Disallowable', 'Box'],
      ['Cost of goods bought for resale or goods used', data.expenses.costOfGoods, '17', 0, '32'],
      ['Construction industry - payments to subcontractors', data.expenses.construction, '18', 0, '33'],
      ['Wages, salaries and other staff costs', data.expenses.wages, '19', 0, '34'],
      ['Car, van and travel expenses', data.expenses.travel, '20', data.disallowable.travel, '35'],
      ['Rent, rates, power and insurance costs', data.expenses.rent, '21', 0, '36'],
      ['Repairs and renewals of property and equipment', data.expenses.repairs, '22', 0, '37'],
      ['Phone, fax, stationery and other office costs', data.expenses.admin, '23', 0, '38'],
      ['Advertising and business entertainment costs', data.expenses.advertising, '24', data.disallowable.advertising, '39'],
      ['Interest on bank and other loans', data.expenses.interest, '25', 0, '40'],
      ['Bank, credit card and other financial charges', data.expenses.bankCharges, '26', 0, '41'],
      ['Irrecoverable debts written off', data.expenses.badDebts, '27', 0, '42'],
      ['Accountancy, legal and other professional fees', data.expenses.professional, '28', 0, '43'],
      ['Depreciation and loss/profit on sale of assets', data.expenses.depreciation, '29', 0, '44'],
      ['Other business expenses', data.expenses.other, '30', data.disallowable.other, '45'],
      ['TOTAL EXPENSES', data.totalExpenses, '31', data.totalDisallowable, '46'],
      ['', '', '', '', ''],
      ['NET PROFIT OR LOSS', 'Amount', 'Box', '', ''],
      ['Total business income', data.totalIncome, '', '', ''],
      ['Total allowable expenses', data.totalExpenses, '31', '', ''],
      ['NET PROFIT', data.netProfit, '47', '', ''],
      ['', '', '', '', ''],
      ['TAX CALCULATION', 'Amount', '', '', ''],
      ['Income tax', data.tax.incomeTax, '', '', ''],
      ['Class 4 National Insurance Contribution', data.tax.class4NI, '', '', ''],
      ['Class 2 National Insurance Contribution', data.tax.class2NI, '', '', ''],
      ['TOTAL TAX', data.tax.total, '', '', ''],
    ];
  };

  const exportToCSV = () => {
    const rows = getExportData();
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
    link.download = `SA103F_${yearLabel}.csv`;
    link.click();
  };

  const exportToExcel = () => {
    const rows = getExportData();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 55 }, // Description
      { wch: 15 }, // Amount/Allowable
      { wch: 8 },  // Box
      { wch: 15 }, // Disallowable
      { wch: 8 },  // Box
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SA103F');
    XLSX.writeFile(wb, `SA103F_${yearLabel}.xlsx`);
  };

  const exportToPDF = () => {
    // Create a print-specific view
    const printContent = cardRef.current;
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const startYear = yearLabel.split('-')[0];
    const endYear = '20' + yearLabel.split('-')[1];
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SA103F Self-Assessment ${yearLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 5px; }
          h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
          h3 { font-size: 16px; margin-top: 30px; margin-bottom: 15px; color: #333; }
          .period { text-align: right; color: #666; font-size: 12px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px dashed #ddd; font-size: 13px; }
          th { font-weight: normal; color: #666; }
          .amount { text-align: right; }
          .box { text-align: center; font-size: 10px; color: #999; background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
          .total td { border-bottom: 2px solid #333; border-top: 1px solid #333; font-weight: bold; }
          .header-row { background: #f9f9f9; }
          .header-row th { font-weight: bold; font-size: 11px; text-transform: uppercase; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>Self-Assessment Summary ${yearLabel}</h1>
        <h2>Based on SA103F categories</h2>
        <div class="period">6 April ${startYear} - 5 April ${endYear}</div>
        
        <h3>Business income</h3>
        <table>
          <tr><td>Your turnover - the takings, fees, sales or money earned by your business</td><td class="amount">£${data.turnover.toLocaleString()}</td><td><span class="box">15</span></td></tr>
          <tr><td>Any other business income not included in box 15</td><td class="amount">£0</td><td><span class="box">16</span></td></tr>
          <tr class="total"><td>TOTAL BUSINESS INCOME</td><td class="amount">£${data.totalIncome.toLocaleString()}</td><td></td></tr>
        </table>
        
        <h3>Business expenses</h3>
        <table>
          <tr class="header-row"><th></th><th class="amount">Allowable</th><th></th><th class="amount">Disallowable</th><th></th></tr>
          <tr><td>Cost of goods bought for resale or goods used</td><td class="amount">£${data.expenses.costOfGoods.toLocaleString()}</td><td><span class="box">17</span></td><td class="amount">£0</td><td><span class="box">32</span></td></tr>
          <tr><td>Construction industry - payments to subcontractors</td><td class="amount">£${data.expenses.construction.toLocaleString()}</td><td><span class="box">18</span></td><td class="amount">£0</td><td><span class="box">33</span></td></tr>
          <tr><td>Wages, salaries and other staff costs</td><td class="amount">£${data.expenses.wages.toLocaleString()}</td><td><span class="box">19</span></td><td class="amount">£0</td><td><span class="box">34</span></td></tr>
          <tr><td>Car, van and travel expenses</td><td class="amount">£${data.expenses.travel.toLocaleString()}</td><td><span class="box">20</span></td><td class="amount">£${data.disallowable.travel.toLocaleString()}</td><td><span class="box">35</span></td></tr>
          <tr><td>Rent, rates, power and insurance costs</td><td class="amount">£${data.expenses.rent.toLocaleString()}</td><td><span class="box">21</span></td><td class="amount">£0</td><td><span class="box">36</span></td></tr>
          <tr><td>Repairs and renewals of property and equipment</td><td class="amount">£${data.expenses.repairs.toLocaleString()}</td><td><span class="box">22</span></td><td class="amount">£0</td><td><span class="box">37</span></td></tr>
          <tr><td>Phone, fax, stationery and other office costs</td><td class="amount">£${data.expenses.admin.toLocaleString()}</td><td><span class="box">23</span></td><td class="amount">£0</td><td><span class="box">38</span></td></tr>
          <tr><td>Advertising and business entertainment costs</td><td class="amount">£${data.expenses.advertising.toLocaleString()}</td><td><span class="box">24</span></td><td class="amount">£${data.disallowable.advertising.toLocaleString()}</td><td><span class="box">39</span></td></tr>
          <tr><td>Interest on bank and other loans</td><td class="amount">£${data.expenses.interest.toLocaleString()}</td><td><span class="box">25</span></td><td class="amount">£0</td><td><span class="box">40</span></td></tr>
          <tr><td>Bank, credit card and other financial charges</td><td class="amount">£${data.expenses.bankCharges.toLocaleString()}</td><td><span class="box">26</span></td><td class="amount">£0</td><td><span class="box">41</span></td></tr>
          <tr><td>Irrecoverable debts written off</td><td class="amount">£${data.expenses.badDebts.toLocaleString()}</td><td><span class="box">27</span></td><td class="amount">£0</td><td><span class="box">42</span></td></tr>
          <tr><td>Accountancy, legal and other professional fees</td><td class="amount">£${data.expenses.professional.toLocaleString()}</td><td><span class="box">28</span></td><td class="amount">£0</td><td><span class="box">43</span></td></tr>
          <tr><td>Depreciation and loss/profit on sale of assets</td><td class="amount">£${data.expenses.depreciation.toLocaleString()}</td><td><span class="box">29</span></td><td class="amount">£0</td><td><span class="box">44</span></td></tr>
          <tr><td>Other business expenses</td><td class="amount">£${data.expenses.other.toLocaleString()}</td><td><span class="box">30</span></td><td class="amount">£${data.disallowable.other.toLocaleString()}</td><td><span class="box">45</span></td></tr>
          <tr class="total"><td>TOTAL</td><td class="amount">£${data.totalExpenses.toLocaleString()}</td><td><span class="box">31</span></td><td class="amount">£${data.totalDisallowable.toLocaleString()}</td><td><span class="box">46</span></td></tr>
        </table>
        
        <h3>Net profit or loss</h3>
        <table>
          <tr><td>Total business income</td><td class="amount">£${data.totalIncome.toLocaleString()}</td><td></td></tr>
          <tr><td>Total allowable expenses</td><td class="amount">£${data.totalExpenses.toLocaleString()}</td><td><span class="box">31</span></td></tr>
          <tr class="total"><td>NET PROFIT</td><td class="amount">£${data.netProfit.toLocaleString()}</td><td><span class="box">47</span></td></tr>
        </table>
        
        <h3>Tax</h3>
        <table>
          <tr><td>Income tax</td><td class="amount">£${data.tax.incomeTax.toLocaleString()}</td><td></td></tr>
          <tr><td>Class 4 National Insurance Contribution</td><td class="amount">£${data.tax.class4NI.toLocaleString()}</td><td></td></tr>
          <tr><td>Class 2 National Insurance Contribution</td><td class="amount">£${data.tax.class2NI.toLocaleString()}</td><td></td></tr>
          <tr class="total"><td>TOTAL TAX</td><td class="amount">£${data.tax.total.toLocaleString()}</td><td></td></tr>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

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
    <Card className="print:shadow-none" ref={cardRef}>
      <CardHeader>
        <div className="flex justify-between items-start">
             <div>
                <CardTitle className="text-2xl">Self-Assessment Summary {yearLabel}</CardTitle>
                <CardDescription>Based on SA103F categories</CardDescription>
             </div>
             <div className="flex items-center gap-2">
                <div className="text-right text-sm text-muted-foreground mr-4">
                   6 April {yearLabel.split('-')[0]} - 5 April 20{yearLabel.split('-')[1]}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportToCSV}
                  className="print:hidden"
                  data-testid="button-export-csv"
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportToExcel}
                  className="print:hidden"
                  data-testid="button-export-excel"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportToPDF}
                  className="print:hidden"
                  data-testid="button-export-pdf"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  PDF
                </Button>
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
