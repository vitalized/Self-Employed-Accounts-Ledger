import { Transaction, BusinessType } from './types';
import { subDays, subMonths, format } from 'date-fns';

const generateTransactions = (): Transaction[] => {
  const transactions: Transaction[] = [];
  const merchants = [
    { name: 'Starling Bank', defaultType: 'Business' },
    { name: 'Apple Store', defaultType: 'Business' },
    { name: 'Stripe Payments UK', defaultType: 'Business' },
    { name: 'Waitrose', defaultType: 'Personal' },
    { name: 'Amazon', defaultType: 'Unreviewed' },
    { name: 'Uber Trip', defaultType: 'Business' },
    { name: 'Shell Garage', defaultType: 'Business' },
    { name: 'Tesco', defaultType: 'Personal' },
    { name: 'Netflix', defaultType: 'Personal' },
    { name: 'Client Payment Ref: 9932', defaultType: 'Business' },
    { name: 'HMRC VAT', defaultType: 'Business' },
    { name: 'WeWork', defaultType: 'Business' },
    { name: 'Adobe Creative Cloud', defaultType: 'Business' },
    { name: 'Pret A Manger', defaultType: 'Personal' },
    { name: 'Shopify Sales', defaultType: 'Business' },
    { name: 'Upwork Earning', defaultType: 'Business' },
    { name: 'PayPal Transfer', defaultType: 'Business' },
    { name: 'Google Ads', defaultType: 'Business' },
  ];

  const categories = {
    Business: ['Software', 'Office Supplies', 'Travel', 'Meals', 'Equipment', 'Services', 'Taxes'],
    Personal: ['Groceries', 'Entertainment', 'Shopping', 'Transport'],
    Income: ['Sales', 'Consulting', 'Refunds']
  };

  // Generate for last 18 months
  const today = new Date();
  
  for (let i = 0; i < 350; i++) {
    const daysAgo = Math.floor(Math.random() * 540); // 1.5 years
    const date = subDays(today, daysAgo).toISOString();
    
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];
    const isIncome = merchant.name.includes('Client') || merchant.name.includes('Stripe') || merchant.name.includes('Shopify') || merchant.name.includes('Upwork') || merchant.name.includes('PayPal');
    
    let amount = 0;
    if (isIncome) {
      // Target ~£88k total income
      // Weighted towards larger client payments
      if (merchant.name.includes('Client')) {
        amount = Math.floor(Math.random() * 2500) + 1500; // 1500-4000
      } else if (merchant.name.includes('Shopify')) {
        amount = Math.floor(Math.random() * 800) + 100; // 100-900
      } else {
        amount = Math.floor(Math.random() * 1500) + 500; // 500-2000
      }
    } else {
      // Target ~£9k total expenses
      // Keep expenses generally low
      amount = (Math.floor(Math.random() * 60) + 10) * -1; // 10-70
      
      // Occasional larger expenses
      if (merchant.name === 'Apple Store') amount = -1299; // New Mac
      if (merchant.name === 'WeWork') amount = -450; // Monthly desk
      if (merchant.name === 'Adobe Creative Cloud') amount = -55;
    }

    // Determine type (randomly make some unreviewed)
    let type = merchant.defaultType as any;
    if (Math.random() > 0.8) type = 'Unreviewed';
    
    // Assign category if not unreviewed
    let category: string | undefined = undefined;
    let businessType: BusinessType | undefined = undefined;
    
    if (type === 'Business') {
      if (isIncome) {
        businessType = 'Income';
        category = 'Sales';
      } else {
        businessType = 'Expense';
        const cats = categories.Business;
        category = cats[Math.floor(Math.random() * cats.length)];
      }
    } else if (type === 'Personal') {
      const cats = categories.Personal;
      category = cats[Math.floor(Math.random() * cats.length)];
    }

    transactions.push({
      id: `txn_${i}`,
      date,
      description: merchant.name,
      amount,
      type,
      category,
      businessType,
      tags: [],
      merchant: merchant.name,
      status: 'Cleared'
    });
  }

  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const MOCK_TRANSACTIONS = generateTransactions();
