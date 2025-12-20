export const SA103_EXPENSE_CATEGORIES = [
  { code: "17", label: "Cost of Goods", description: "Cost of goods bought for resale or goods used" },
  { code: "18", label: "Subcontractor Costs", description: "Construction industry payments to subcontractors" },
  { code: "19", label: "Staff Costs", description: "Wages, salaries and other staff costs" },
  { code: "20", label: "Travel & Vehicle", description: "Car, van and travel expenses" },
  { code: "21", label: "Premises Costs", description: "Rent, rates, power and insurance costs" },
  { code: "22", label: "Repairs & Maintenance", description: "Repairs and maintenance of property and equipment" },
  { code: "23", label: "Office Costs", description: "Phone, fax, stationery and other office costs" },
  { code: "24", label: "Advertising", description: "Advertising and business entertainment costs" },
  { code: "25", label: "Loan Interest", description: "Interest on bank and other loans" },
  { code: "26", label: "Bank Charges", description: "Bank, credit card and other financial charges" },
  { code: "27", label: "Bad Debts", description: "Irrecoverable debts written off" },
  { code: "28", label: "Professional Fees", description: "Accountancy, legal and other professional fees" },
  { code: "29", label: "Depreciation", description: "Depreciation and loss/profit on sale of assets" },
  { code: "30", label: "Other Expenses", description: "Other business expenses" },
] as const;

export const INCOME_CATEGORIES = [
  { code: "I1", label: "Sales", description: "Sales of goods or services" },
  { code: "I2", label: "Consulting", description: "Consulting or freelance income" },
  { code: "I3", label: "Commission", description: "Commission income" },
  { code: "I4", label: "Grants", description: "Business grants received" },
  { code: "I5", label: "Refunds", description: "Business refunds received" },
  { code: "I6", label: "Other Income", description: "Other business income" },
] as const;

export const ALL_CATEGORIES = [
  ...INCOME_CATEGORIES.map(c => ({ ...c, type: "Income" as const })),
  ...SA103_EXPENSE_CATEGORIES.map(c => ({ ...c, type: "Expense" as const })),
];

export type ExpenseCategory = typeof SA103_EXPENSE_CATEGORIES[number]["label"];
export type IncomeCategory = typeof INCOME_CATEGORIES[number]["label"];
export type CategoryLabel = ExpenseCategory | IncomeCategory;
