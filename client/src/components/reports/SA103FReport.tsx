import { useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Car, Home } from "lucide-react";
import { Transaction } from "@/lib/types";
import { SA103_EXPENSE_CATEGORIES } from "@shared/categories";
import * as XLSX from "xlsx";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { parseISO, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface SA103FReportProps {
  transactions: Transaction[];
  yearLabel: string;
}

interface MileageSummary {
  taxYear: string;
  totalMiles: number;
  allowance: number;
  tripCount: number;
}

export function SA103FReport({ transactions, yearLabel }: SA103FReportProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Fetch mileage summary for the tax year
  const { data: mileageSummary } = useQuery<MileageSummary>({
    queryKey: ["/api/mileage-summary", yearLabel],
    queryFn: async () => {
      const res = await fetch(`/api/mileage-summary?taxYear=${yearLabel}`);
      if (!res.ok) throw new Error("Failed to fetch mileage summary");
      return res.json();
    },
  });

  // Get Use of Home data from localStorage
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

      return {
        totalExpenses,
        totalRooms,
        businessRooms,
        roomProportion: roomProportion * 100,
        proportionalClaim,
        hoursPerWeek,
        hoursPerMonth: Math.round(hoursPerMonth),
        monthlyFlatRate,
        annualFlatRate,
        recommended,
        recommendedAmount
      };
    } catch {
      return null;
    }
  }, [yearLabel]);

  const data = useMemo(() => {
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

    const disallowable = {
      travel: 0,
      advertising: 0,
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

    const totalIncome = turnover + otherIncome;
    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
    const totalDisallowable = Object.values(disallowable).reduce((a, b) => a + b, 0);
    const netProfit = totalIncome - totalExpenses;

    let taxableIncome = Math.max(0, netProfit - 12570);
    let incomeTax = 0;
    let taxBreakdown: { band: string; rate: string; amount: number; tax: number }[] = [];
    
    if (taxableIncome > 0) {
      const basicRateLimit = 37700;
      const basicTaxable = Math.min(taxableIncome, basicRateLimit);
      const basicTax = basicTaxable * 0.20;
      incomeTax += basicTax;
      if (basicTaxable > 0) {
        taxBreakdown.push({ band: 'Basic Rate', rate: '20%', amount: basicTaxable, tax: basicTax });
      }
      
      if (taxableIncome > basicRateLimit) {
        const higherRateLimit = 125140 - 50270;
        const higherTaxable = Math.min(taxableIncome - basicRateLimit, higherRateLimit);
        const higherTax = higherTaxable * 0.40;
        incomeTax += higherTax;
        if (higherTaxable > 0) {
          taxBreakdown.push({ band: 'Higher Rate', rate: '40%', amount: higherTaxable, tax: higherTax });
        }
        
        if (taxableIncome > basicRateLimit + higherRateLimit) {
          const additionalTaxable = taxableIncome - basicRateLimit - higherRateLimit;
          const additionalTax = additionalTaxable * 0.45;
          incomeTax += additionalTax;
          if (additionalTaxable > 0) {
            taxBreakdown.push({ band: 'Additional Rate', rate: '45%', amount: additionalTaxable, tax: additionalTax });
          }
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

    return {
      turnover,
      otherIncome,
      totalIncome,
      expenses,
      totalExpenses,
      disallowable,
      totalDisallowable,
      netProfit,
      taxableIncome,
      taxBreakdown,
      tax: {
        incomeTax: Math.round(incomeTax),
        class4NI: Math.round(class4NI),
        class2NI: Math.round(class2NI),
        total: Math.round(incomeTax + class4NI + class2NI)
      }
    };
  }, [transactions, useOfHomeData]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { name: string, income: number, expenses: number, profit: number }> = {};
    
    transactions.forEach(t => {
      if (t.type !== 'Business') return;
      const date = parseISO(t.date);
      const key = format(date, 'yyyy-MM');
      const name = format(date, 'MMM');
      
      if (!months[key]) months[key] = { name, income: 0, expenses: 0, profit: 0 };
      
      const amount = Number(t.amount);
      if (t.businessType === 'Income') {
        months[key].income += amount;
        months[key].profit += amount;
      } else if (t.businessType === 'Expense') {
        months[key].expenses += Math.abs(amount);
        months[key].profit -= Math.abs(amount);
      }
    });

    return Object.keys(months).sort().map(k => months[k]);
  }, [transactions]);

  const getExportData = () => {
    const rows: (string | number)[][] = [
      ['SA103F Self-Assessment Summary', '', '', '', ''],
      [`Tax Year: ${yearLabel}`, '', '', '', ''],
      ['', '', '', '', ''],
      ['BUSINESS INCOME', 'Amount', 'Box', '', ''],
      ['Your turnover - the takings, fees, sales or money earned by your business', data.turnover, '15', '', ''],
      ['Any other business income not included in box 15', data.otherIncome, '16', '', ''],
      ['TOTAL BUSINESS INCOME', data.totalIncome, '', '', ''],
      ['', '', '', '', ''],
      ['BUSINESS EXPENSES', 'Allowable', 'Box', 'Disallowable', 'Box'],
      ['Cost of goods bought for resale or goods used', data.expenses.costOfGoods, '17', 0, '32'],
      ['Construction industry - payments to subcontractors', data.expenses.construction, '18', 0, '33'],
      ['Wages, salaries and other staff costs', data.expenses.wages, '19', 0, '34'],
      ['Car, van and travel expenses', data.expenses.travel, '20', data.disallowable.travel, '35'],
      [useOfHomeData && useOfHomeData.recommendedAmount > 0 ? 'Rent, rates, power and insurance costs (incl. Use of Home)' : 'Rent, rates, power and insurance costs', data.expenses.rent, '21', 0, '36'],
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
      ['Less: Total allowable expenses', data.totalExpenses, '31', '', ''],
      ['NET PROFIT', data.netProfit, '47', '', ''],
    ];

    if (mileageSummary && mileageSummary.totalMiles > 0) {
      rows.push(['', '', '', '', '']);
      rows.push(['MILEAGE ALLOWANCE', '', '', '', '']);
      rows.push(['(HMRC approved mileage rates - separate from vehicle expenses)', '', '', '', '']);
      rows.push(['Total business miles driven', mileageSummary.totalMiles, 'miles', '', '']);
      rows.push(['Number of trips recorded', mileageSummary.tripCount, 'trips', '', '']);
      rows.push(['First 10,000 miles @ 45p/mile', Math.min(mileageSummary.totalMiles, 10000) * 0.45, '', '', '']);
      if (mileageSummary.totalMiles > 10000) {
        rows.push([`Additional miles @ 25p/mile (${mileageSummary.totalMiles - 10000} miles)`, (mileageSummary.totalMiles - 10000) * 0.25, '', '', '']);
      }
      rows.push(['TOTAL MILEAGE ALLOWANCE', mileageSummary.allowance, '', '', '']);
    }

    if (useOfHomeData && useOfHomeData.recommendedAmount > 0) {
      rows.push(['', '', '', '', '']);
      rows.push(['USE OF HOME ALLOWANCE (included in Box 21 above)', '', '', '', '']);
      rows.push(['(Business portion of household expenses - breakdown for reference)', '', '', '', '']);
      rows.push([`Calculation method used`, useOfHomeData.recommended === 'proportional' ? 'Proportional (room-based)' : 'HMRC Flat Rate (hours-based)', '', '', '']);
      if (useOfHomeData.recommended === 'proportional') {
        rows.push(['Total household expenses', useOfHomeData.totalExpenses, '', '', '']);
        rows.push([`Business rooms (${useOfHomeData.businessRooms}) / Total rooms (${useOfHomeData.totalRooms})`, `${useOfHomeData.roomProportion.toFixed(1)}%`, '', '', '']);
      } else {
        rows.push(['Hours worked from home per week', useOfHomeData.hoursPerWeek, 'hours', '', '']);
        rows.push([`Monthly flat rate (${useOfHomeData.hoursPerMonth} hrs/month)`, useOfHomeData.monthlyFlatRate, '', '', '']);
      }
      rows.push(['USE OF HOME AMOUNT (in Box 21)', useOfHomeData.recommendedAmount.toFixed(0), '', '', '']);
    }

    rows.push(['', '', '', '', '']);
    rows.push(['INCOME TAX CALCULATION', '', '', '', '']);
    rows.push(['Net Profit', data.netProfit, '', '', '']);
    rows.push(['Personal Allowance', -12570, '', '', '']);
    rows.push(['Taxable Income', data.taxableIncome, '', '', '']);
    rows.push(['', '', '', '', '']);
    rows.push(['Tax Band', 'Rate', 'Amount', 'Tax', '']);
    data.taxBreakdown.forEach(band => {
      rows.push([band.band, band.rate, band.amount, Math.round(band.tax), '']);
    });
    rows.push(['TOTAL INCOME TAX', '', '', data.tax.incomeTax, '']);
    rows.push(['', '', '', '', '']);
    rows.push(['NATIONAL INSURANCE', 'Description', 'Amount', '', '']);
    rows.push(['Class 4 NI', '9% on profits £12,570-£50,270, 2% above', data.tax.class4NI, '', '']);
    rows.push(['Class 2 NI', '£3.45/week if profits above £6,725', data.tax.class2NI, '', '']);
    rows.push(['TOTAL NATIONAL INSURANCE', '', data.tax.class4NI + data.tax.class2NI, '', '']);
    rows.push(['', '', '', '', '']);
    rows.push(['SUMMARY', '', '', '', '']);
    rows.push(['Net Profit', data.netProfit, '', '', '']);
    rows.push(['Less: Income Tax', data.tax.incomeTax, '', '', '']);
    rows.push(['Less: National Insurance', data.tax.class4NI + data.tax.class2NI, '', '', '']);
    rows.push(['TOTAL TAX DUE', data.tax.total, '', '', '']);
    rows.push(['TAKE HOME', data.netProfit - data.tax.total, '', '', '']);

    return rows;
  };

  const exportToCSV = () => {
    try {
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
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('CSV export error:', error);
    }
  };

  const exportToExcel = () => {
    try {
      const rows = getExportData();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 55 }, { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 8 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'SA103F');
      XLSX.writeFile(wb, `SA103F_${yearLabel}.xlsx`);
    } catch (error) {
      console.error('Excel export error:', error);
    }
  };

  const exportToPDF = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      
      const startYear = yearLabel.split('-')[0];
      const endYear = '20' + yearLabel.split('-')[1];
      
      const mileageSection = mileageSummary && mileageSummary.totalMiles > 0 ? `
          <h3>Mileage Allowance</h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 10px;">HMRC approved mileage rates (separate from vehicle expenses)</p>
          <table>
            <tr><td>Total business miles driven</td><td class="amount">${mileageSummary.totalMiles.toLocaleString()} miles</td></tr>
            <tr><td>Number of trips recorded</td><td class="amount">${mileageSummary.tripCount} trips</td></tr>
            <tr><td>First 10,000 miles @ 45p/mile</td><td class="amount">£${(Math.min(mileageSummary.totalMiles, 10000) * 0.45).toFixed(2)}</td></tr>
            ${mileageSummary.totalMiles > 10000 ? `<tr><td>Additional miles @ 25p/mile (${(mileageSummary.totalMiles - 10000).toLocaleString()} miles)</td><td class="amount">£${((mileageSummary.totalMiles - 10000) * 0.25).toFixed(2)}</td></tr>` : ''}
            <tr class="total"><td>TOTAL MILEAGE ALLOWANCE</td><td class="amount">£${mileageSummary.allowance.toLocaleString()}</td></tr>
          </table>
      ` : '';

      const useOfHomeSection = useOfHomeData && useOfHomeData.recommendedAmount > 0 ? `
          <h3>Use of Home Allowance (included in Box 21)</h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Business portion of household expenses - breakdown for reference</p>
          <table>
            <tr><td>Calculation method</td><td class="amount">${useOfHomeData.recommended === 'proportional' ? 'Proportional (room-based)' : 'HMRC Flat Rate (hours-based)'}</td></tr>
            ${useOfHomeData.recommended === 'proportional' ? `
              <tr><td>Total household expenses</td><td class="amount">£${useOfHomeData.totalExpenses.toLocaleString()}</td></tr>
              <tr><td>Business rooms (${useOfHomeData.businessRooms}) / Total rooms (${useOfHomeData.totalRooms})</td><td class="amount">${useOfHomeData.roomProportion.toFixed(1)}%</td></tr>
            ` : `
              <tr><td>Hours worked from home per week</td><td class="amount">${useOfHomeData.hoursPerWeek} hours</td></tr>
              <tr><td>Monthly flat rate (${useOfHomeData.hoursPerMonth} hrs/month)</td><td class="amount">£${useOfHomeData.monthlyFlatRate}</td></tr>
            `}
            <tr class="total"><td>USE OF HOME AMOUNT (in Box 21)</td><td class="amount">£${Math.round(useOfHomeData.recommendedAmount).toLocaleString()}</td></tr>
          </table>
      ` : '';

      const taxBreakdownRows = data.taxBreakdown.map(band => 
        `<tr><td>${band.band} (${band.rate}) on £${band.amount.toLocaleString()}</td><td class="amount">£${Math.round(band.tax).toLocaleString()}</td></tr>`
      ).join('');
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>SA103F Self-Assessment ${yearLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; font-size: 12px; }
            h1 { font-size: 22px; margin-bottom: 5px; }
            h2 { font-size: 13px; color: #666; margin-bottom: 20px; }
            h3 { font-size: 15px; margin-top: 25px; margin-bottom: 12px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            .period { text-align: right; color: #666; font-size: 11px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { padding: 6px 8px; text-align: left; border-bottom: 1px dashed #ddd; font-size: 12px; }
            th { background: #f5f5f5; font-weight: bold; border-bottom: 1px solid #333; }
            .amount { text-align: right; }
            .box { text-align: center; font-size: 10px; color: #666; width: 40px; }
            .total td { border-bottom: 2px solid #333; border-top: 1px solid #333; font-weight: bold; background: #f9f9f9; }
            .section-note { font-size: 11px; color: #666; margin-bottom: 10px; }
            .page-break { page-break-before: always; }
            @media print { body { padding: 15px; } h3 { page-break-after: avoid; } table { page-break-inside: avoid; } }
          </style>
        </head>
        <body>
          <h1>Self-Assessment Summary ${yearLabel}</h1>
          <h2>Based on SA103F categories</h2>
          <div class="period">Tax Year: 6 April ${startYear} - 5 April ${endYear}</div>
          
          <h3>Business Income (Boxes 15-16)</h3>
          <table>
            <tr><th>Description</th><th class="amount">Amount</th><th class="box">Box</th></tr>
            <tr><td>Your turnover - the takings, fees, sales or money earned by your business</td><td class="amount">£${data.turnover.toLocaleString()}</td><td class="box">15</td></tr>
            <tr><td>Any other business income not included in box 15</td><td class="amount">£${data.otherIncome.toLocaleString()}</td><td class="box">16</td></tr>
            <tr class="total"><td>TOTAL BUSINESS INCOME</td><td class="amount">£${data.totalIncome.toLocaleString()}</td><td class="box"></td></tr>
          </table>

          <h3>Business Expenses (Boxes 17-31 Allowable, 32-46 Disallowable)</h3>
          <table>
            <tr><th>Description</th><th class="amount">Allowable</th><th class="box">Box</th><th class="amount">Disallowable</th><th class="box">Box</th></tr>
            <tr><td>Cost of goods bought for resale or goods used</td><td class="amount">£${data.expenses.costOfGoods.toLocaleString()}</td><td class="box">17</td><td class="amount">£0</td><td class="box">32</td></tr>
            <tr><td>Construction industry - payments to subcontractors</td><td class="amount">£${data.expenses.construction.toLocaleString()}</td><td class="box">18</td><td class="amount">£0</td><td class="box">33</td></tr>
            <tr><td>Wages, salaries and other staff costs</td><td class="amount">£${data.expenses.wages.toLocaleString()}</td><td class="box">19</td><td class="amount">£0</td><td class="box">34</td></tr>
            <tr><td>Car, van and travel expenses</td><td class="amount">£${data.expenses.travel.toLocaleString()}</td><td class="box">20</td><td class="amount">£${data.disallowable.travel.toLocaleString()}</td><td class="box">35</td></tr>
            <tr><td>Rent, rates, power and insurance costs${useOfHomeData && useOfHomeData.recommendedAmount > 0 ? ' (incl. Use of Home)' : ''}</td><td class="amount">£${data.expenses.rent.toLocaleString()}</td><td class="box">21</td><td class="amount">£0</td><td class="box">36</td></tr>
            <tr><td>Repairs and renewals of property and equipment</td><td class="amount">£${data.expenses.repairs.toLocaleString()}</td><td class="box">22</td><td class="amount">£0</td><td class="box">37</td></tr>
            <tr><td>Phone, fax, stationery and other office costs</td><td class="amount">£${data.expenses.admin.toLocaleString()}</td><td class="box">23</td><td class="amount">£0</td><td class="box">38</td></tr>
            <tr><td>Advertising and business entertainment costs</td><td class="amount">£${data.expenses.advertising.toLocaleString()}</td><td class="box">24</td><td class="amount">£${data.disallowable.advertising.toLocaleString()}</td><td class="box">39</td></tr>
            <tr><td>Interest on bank and other loans</td><td class="amount">£${data.expenses.interest.toLocaleString()}</td><td class="box">25</td><td class="amount">£0</td><td class="box">40</td></tr>
            <tr><td>Bank, credit card and other financial charges</td><td class="amount">£${data.expenses.bankCharges.toLocaleString()}</td><td class="box">26</td><td class="amount">£0</td><td class="box">41</td></tr>
            <tr><td>Irrecoverable debts written off</td><td class="amount">£${data.expenses.badDebts.toLocaleString()}</td><td class="box">27</td><td class="amount">£0</td><td class="box">42</td></tr>
            <tr><td>Accountancy, legal and other professional fees</td><td class="amount">£${data.expenses.professional.toLocaleString()}</td><td class="box">28</td><td class="amount">£0</td><td class="box">43</td></tr>
            <tr><td>Depreciation and loss/profit on sale of assets</td><td class="amount">£${data.expenses.depreciation.toLocaleString()}</td><td class="box">29</td><td class="amount">£0</td><td class="box">44</td></tr>
            <tr><td>Other business expenses</td><td class="amount">£${data.expenses.other.toLocaleString()}</td><td class="box">30</td><td class="amount">£${data.disallowable.other.toLocaleString()}</td><td class="box">45</td></tr>
            <tr class="total"><td>TOTAL EXPENSES</td><td class="amount">£${data.totalExpenses.toLocaleString()}</td><td class="box">31</td><td class="amount">£${data.totalDisallowable.toLocaleString()}</td><td class="box">46</td></tr>
          </table>

          <h3>Net Profit or Loss (Box 47)</h3>
          <table>
            <tr><td>Total business income</td><td class="amount">£${data.totalIncome.toLocaleString()}</td><td class="box"></td></tr>
            <tr><td>Less: Total allowable expenses</td><td class="amount">-£${data.totalExpenses.toLocaleString()}</td><td class="box">31</td></tr>
            <tr class="total"><td>NET PROFIT</td><td class="amount">£${data.netProfit.toLocaleString()}</td><td class="box">47</td></tr>
          </table>

          ${mileageSection}

          ${useOfHomeSection}

          <div class="page-break"></div>
          
          <h3>Income Tax Calculation</h3>
          <p class="section-note">UK income tax calculation based on current rates</p>
          <table>
            <tr><td>Net Profit</td><td class="amount">£${data.netProfit.toLocaleString()}</td></tr>
            <tr><td>Personal Allowance</td><td class="amount" style="color: green;">-£12,570</td></tr>
            <tr style="font-weight: bold;"><td>Taxable Income</td><td class="amount">£${data.taxableIncome.toLocaleString()}</td></tr>
          </table>
          <table>
            <tr><th>Tax Band</th><th class="amount">Tax</th></tr>
            ${taxBreakdownRows}
            <tr class="total"><td>TOTAL INCOME TAX</td><td class="amount">£${data.tax.incomeTax.toLocaleString()}</td></tr>
          </table>

          <h3>National Insurance Contributions</h3>
          <p class="section-note">Self-employed NI contributions</p>
          <table>
            <tr><th>Type</th><th>Description</th><th class="amount">Amount</th></tr>
            <tr><td>Class 4 NI</td><td>9% on profits between £12,570 and £50,270, 2% above</td><td class="amount">£${data.tax.class4NI.toLocaleString()}</td></tr>
            <tr><td>Class 2 NI</td><td>£3.45/week if profits above £6,725</td><td class="amount">£${data.tax.class2NI.toLocaleString()}</td></tr>
            <tr class="total"><td colspan="2">TOTAL NATIONAL INSURANCE</td><td class="amount">£${(data.tax.class4NI + data.tax.class2NI).toLocaleString()}</td></tr>
          </table>

          <h3>Summary</h3>
          <table>
            <tr><td>Net Profit</td><td class="amount">£${data.netProfit.toLocaleString()}</td></tr>
            <tr><td>Income Tax</td><td class="amount" style="color: #c75000;">-£${data.tax.incomeTax.toLocaleString()}</td></tr>
            <tr><td>National Insurance</td><td class="amount" style="color: #c75000;">-£${(data.tax.class4NI + data.tax.class2NI).toLocaleString()}</td></tr>
            <tr class="total"><td>TOTAL TAX DUE</td><td class="amount" style="color: #c75000;">£${data.tax.total.toLocaleString()}</td></tr>
            <tr class="total"><td>TAKE HOME</td><td class="amount" style="color: green;">£${(data.netProfit - data.tax.total).toLocaleString()}</td></tr>
          </table>

          <p style="margin-top: 30px; font-size: 10px; color: #999; text-align: center;">
            Generated by TaxTrack on ${new Date().toLocaleDateString('en-GB')} | This is an estimate only - consult a qualified accountant for tax advice
          </p>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('PDF export error:', error);
    }
  };

  const Row = ({ label, boxAllowable, valAllowable, boxDisallowable, valDisallowable, isTotal = false }: any) => (
    <div className={`flex items-center py-2 text-sm ${isTotal ? 'border-t border-b-2 border-solid border-gray-900 dark:border-gray-100 font-bold py-3 text-base' : 'border-b border-dashed border-gray-100 dark:border-gray-800'}`}>
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

  const IncomeRow = ({ label, box, value, isTotal = false }: { label: string; box?: string; value: number; isTotal?: boolean }) => (
    <div className={`flex items-center py-2 text-sm ${isTotal ? 'border-t border-b-2 border-solid border-gray-900 dark:border-gray-100 font-bold py-3 text-base' : 'border-b border-dashed border-gray-100 dark:border-gray-800'}`}>
      <div className="flex-1 pr-4">{label}</div>
      <div className="w-32 text-right flex items-center justify-end gap-2">
        <span>£{value.toLocaleString()}</span>
        {box && <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 rounded w-5 text-center">{box}</span>}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6" ref={cardRef}>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => exportToCSV()} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exportToExcel()} data-testid="button-export-excel">
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          Excel
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exportToPDF()} data-testid="button-export-pdf">
          <FileText className="h-4 w-4 mr-1" />
          PDF
        </Button>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList data-testid="tabs-sa103f">
          <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
          <TabsTrigger value="tax" data-testid="tab-tax">Tax</TabsTrigger>
          <TabsTrigger value="charts" data-testid="tab-charts">Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Income</CardTitle>
              <CardDescription>SA103F Boxes 15-16</CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeRow label="Your turnover - the takings, fees, sales or money earned by your business" box="15" value={data.turnover} />
              <IncomeRow label="Any other business income not included in box 15" box="16" value={data.otherIncome} />
              <IncomeRow label="TOTAL BUSINESS INCOME" value={data.totalIncome} isTotal />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business Expenses</CardTitle>
              <CardDescription>SA103F Boxes 17-31 (Allowable) and 32-46 (Disallowable)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex items-end justify-between mb-2">
                  <div className="flex-1" />
                  <div className="flex text-xs font-bold text-gray-500 uppercase">
                    <div className="w-24 text-right mr-4">Allowable</div>
                    <div className="w-24 text-right">Disallowable</div>
                  </div>
                </div>
                <Row label="Cost of goods bought for resale or goods used" valAllowable={data.expenses.costOfGoods} boxAllowable="17" valDisallowable={0} boxDisallowable="32" />
                <Row label="Construction industry - payments to subcontractors" valAllowable={data.expenses.construction} boxAllowable="18" valDisallowable={0} boxDisallowable="33" />
                <Row label="Wages, salaries and other staff costs" valAllowable={data.expenses.wages} boxAllowable="19" valDisallowable={0} boxDisallowable="34" />
                <Row label="Car, van and travel expenses" valAllowable={data.expenses.travel} boxAllowable="20" valDisallowable={data.disallowable.travel} boxDisallowable="35" />
                <Row label={useOfHomeData && useOfHomeData.recommendedAmount > 0 ? "Rent, rates, power and insurance costs (incl. Use of Home)" : "Rent, rates, power and insurance costs"} valAllowable={data.expenses.rent} boxAllowable="21" valDisallowable={0} boxDisallowable="36" />
                <Row label="Repairs and renewals of property and equipment" valAllowable={data.expenses.repairs} boxAllowable="22" valDisallowable={0} boxDisallowable="37" />
                <Row label="Phone, fax, stationery and other office costs" valAllowable={data.expenses.admin} boxAllowable="23" valDisallowable={0} boxDisallowable="38" />
                <Row label="Advertising and business entertainment costs" valAllowable={data.expenses.advertising} boxAllowable="24" valDisallowable={data.disallowable.advertising} boxDisallowable="39" />
                <Row label="Interest on bank and other loans" valAllowable={data.expenses.interest} boxAllowable="25" valDisallowable={0} boxDisallowable="40" />
                <Row label="Bank, credit card and other financial charges" valAllowable={data.expenses.bankCharges} boxAllowable="26" valDisallowable={0} boxDisallowable="41" />
                <Row label="Irrecoverable debts written off" valAllowable={data.expenses.badDebts} boxAllowable="27" valDisallowable={0} boxDisallowable="42" />
                <Row label="Accountancy, legal and other professional fees" valAllowable={data.expenses.professional} boxAllowable="28" valDisallowable={0} boxDisallowable="43" />
                <Row label="Depreciation and loss/profit on sale of assets" valAllowable={data.expenses.depreciation} boxAllowable="29" valDisallowable={0} boxDisallowable="44" />
                <Row label="Other business expenses" valAllowable={data.expenses.other} boxAllowable="30" valDisallowable={data.disallowable.other} boxDisallowable="45" />
                <Row label="TOTAL EXPENSES" valAllowable={data.totalExpenses} boxAllowable="31" valDisallowable={data.totalDisallowable} boxDisallowable="46" isTotal />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Net Profit or Loss</CardTitle>
              <CardDescription>SA103F Box 47</CardDescription>
            </CardHeader>
            <CardContent>
              <IncomeRow label="Total business income" value={data.totalIncome} />
              <IncomeRow label="Less: Total allowable expenses" box="31" value={data.totalExpenses} />
              <IncomeRow label="NET PROFIT" box="47" value={data.netProfit} isTotal />
            </CardContent>
          </Card>

          {/* Mileage Allowance Card */}
          {mileageSummary && mileageSummary.totalMiles > 0 && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-blue-600" />
                  Mileage Allowance
                </CardTitle>
                <CardDescription>HMRC approved mileage rates (separate from vehicle expenses above)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Total business miles driven</span>
                    <span className="font-medium">{mileageSummary.totalMiles.toLocaleString()} miles</span>
                  </div>
                  <div className="flex justify-between py-2 border-b text-sm">
                    <span className="text-muted-foreground">Number of trips recorded</span>
                    <span>{mileageSummary.tripCount} trips</span>
                  </div>
                  <div className="flex justify-between py-2 border-b text-sm">
                    <span className="text-muted-foreground">First 10,000 miles @ 45p/mile</span>
                    <span>£{Math.min(mileageSummary.totalMiles, 10000) * 0.45 < 1 ? '0.00' : (Math.min(mileageSummary.totalMiles, 10000) * 0.45).toFixed(2)}</span>
                  </div>
                  {mileageSummary.totalMiles > 10000 && (
                    <div className="flex justify-between py-2 border-b text-sm">
                      <span className="text-muted-foreground">Additional miles @ 25p/mile</span>
                      <span>£{((mileageSummary.totalMiles - 10000) * 0.25).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 font-bold text-lg border-t-2">
                    <span>Total Mileage Allowance Claim</span>
                    <span className="text-blue-600">£{mileageSummary.allowance.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    This is claimed separately on your tax return. Costs categorized as "Covered by Mileage Allowance" 
                    are not included in expenses above to avoid double claiming.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Use of Home Allowance Card */}
          {useOfHomeData && useOfHomeData.recommendedAmount > 0 && (
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-green-600" />
                  Use of Home Allowance
                </CardTitle>
                <CardDescription>Included in Box 21 above (Rent, rates, power and insurance costs)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Calculation method</span>
                    <span className="font-medium">
                      {useOfHomeData.recommended === 'proportional' ? 'Proportional (room-based)' : 'HMRC Flat Rate (hours-based)'}
                    </span>
                  </div>
                  {useOfHomeData.recommended === 'proportional' ? (
                    <>
                      <div className="flex justify-between py-2 border-b text-sm">
                        <span className="text-muted-foreground">Total household expenses</span>
                        <span>£{useOfHomeData.totalExpenses.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b text-sm">
                        <span className="text-muted-foreground">Business rooms ({useOfHomeData.businessRooms}) / Total rooms ({useOfHomeData.totalRooms})</span>
                        <span>{useOfHomeData.roomProportion.toFixed(1)}%</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between py-2 border-b text-sm">
                        <span className="text-muted-foreground">Hours worked from home per week</span>
                        <span>{useOfHomeData.hoursPerWeek} hours</span>
                      </div>
                      <div className="flex justify-between py-2 border-b text-sm">
                        <span className="text-muted-foreground">Monthly flat rate ({useOfHomeData.hoursPerMonth} hrs/month)</span>
                        <span>£{useOfHomeData.monthlyFlatRate}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between py-3 font-bold text-lg border-t-2">
                    <span>Use of Home Amount</span>
                    <span className="text-green-600">£{Math.round(useOfHomeData.recommendedAmount).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    This amount is already included in Box 21 expenses above and reduces your taxable profit. 
                    Configure your expenses and usage in the Use of Home report tab.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tax" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">£{data.netProfit.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Income Tax</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">£{data.tax.incomeTax.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">National Insurance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">£{(data.tax.class4NI + data.tax.class2NI).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Tax Due</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">£{data.tax.total.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Income Tax Breakdown</CardTitle>
              <CardDescription>UK income tax calculation based on current rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b text-sm">
                  <span className="text-muted-foreground">Net Profit</span>
                  <span>£{data.netProfit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b text-sm">
                  <span className="text-muted-foreground">Personal Allowance</span>
                  <span className="text-green-600">-£12,570</span>
                </div>
                <div className="flex justify-between py-2 border-b font-medium">
                  <span>Taxable Income</span>
                  <span>£{data.taxableIncome.toLocaleString()}</span>
                </div>
                
                {data.taxBreakdown.map((band, i) => (
                  <div key={i} className="flex justify-between py-2 border-b text-sm">
                    <span>
                      <span className="text-muted-foreground">{band.band} ({band.rate})</span>
                      <span className="ml-2 text-xs text-muted-foreground">on £{band.amount.toLocaleString()}</span>
                    </span>
                    <span>£{Math.round(band.tax).toLocaleString()}</span>
                  </div>
                ))}

                <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                  <span>Total Income Tax</span>
                  <span className="text-orange-600">£{data.tax.incomeTax.toLocaleString()}</span>
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
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <div>
                    <span className="font-medium">Class 4 NI</span>
                    <p className="text-xs text-muted-foreground">9% on profits between £12,570 and £50,270, 2% above</p>
                  </div>
                  <span className="font-medium">£{data.tax.class4NI.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <div>
                    <span className="font-medium">Class 2 NI</span>
                    <p className="text-xs text-muted-foreground">£3.45/week if profits above £6,725</p>
                  </div>
                  <span className="font-medium">£{data.tax.class2NI.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                  <span>Total NI</span>
                  <span className="text-orange-600">£{(data.tax.class4NI + data.tax.class2NI).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What You Keep</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span>Net Profit</span>
                  <span className="font-medium">£{data.netProfit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Total Tax & NI</span>
                  <span className="font-medium text-orange-600">-£{data.tax.total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 font-bold text-lg">
                  <span>Take Home</span>
                  <span className="text-green-600">£{(data.netProfit - data.tax.total).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profit & Loss</CardTitle>
              <CardDescription>Monthly breakdown of income vs expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `£${value}`} />
                    <Tooltip 
                      formatter={(value: number) => [`£${value.toLocaleString()}`, '']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
