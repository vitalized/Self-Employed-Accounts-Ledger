export const SA103_EXPENSE_CATEGORIES = [
  { code: "C10", label: "Accountancy", description: "Accountancy and bookkeeping fees" },
  { code: "24", label: "Advertising", description: "Advertising and business entertainment costs" },
  { code: "27", label: "Bad Debts", description: "Irrecoverable debts written off" },
  { code: "26", label: "Bank Charges", description: "Bank, credit card and other financial charges" },
  { code: "C9", label: "Books and Professional Magazines", description: "Professional books, journals and publications" },
  { code: "C3", label: "Broadband", description: "Internet and broadband costs" },
  { code: "17", label: "Cost of Goods", description: "Cost of goods bought for resale or goods used" },
  { code: "C8", label: "Courses and Training", description: "Training courses including CPE/CPD" },
  { code: "29", label: "Depreciation", description: "Depreciation and loss/profit on sale of assets" },
  { code: "C11", label: "Hotels and Business Accommodation", description: "Hotel stays and accommodation for business travel" },
  { code: "C6", label: "Insurance & Licences", description: "Business insurance and professional licences" },
  { code: "25", label: "Loan Interest", description: "Interest on bank and other loans" },
  { code: "C2", label: "Mobile Phone", description: "Mobile phone bills and top-ups" },
  { code: "23", label: "Office Costs", description: "Phone, fax, stationery and other office costs" },
  { code: "30", label: "Other Expenses", description: "Other business expenses" },
  { code: "C1", label: "Postage and Stationery", description: "Postage, stamps, envelopes, paper and stationery" },
  { code: "21", label: "Premises Costs", description: "Rent, rates, power and insurance costs" },
  { code: "28", label: "Professional Fees", description: "Accountancy, legal and other professional fees" },
  { code: "22", label: "Repairs & Maintenance", description: "Repairs and maintenance of property and equipment" },
  { code: "C5", label: "Software and Computer Incidentals", description: "Software subscriptions, licenses and computer consumables" },
  { code: "19", label: "Staff Costs", description: "Wages, salaries and other staff costs" },
  { code: "18", label: "Subcontractor Costs", description: "Construction industry payments to subcontractors" },
  { code: "C7", label: "Subscriptions", description: "Professional and trade subscriptions" },
  { code: "20", label: "Travel & Vehicle", description: "Car, van and travel expenses" },
  { code: "C4", label: "Website and Hosting", description: "Website hosting, domain names and web services" },
] as const;

export const INCOME_CATEGORIES = [
  { code: "I3", label: "Commission", description: "Commission income" },
  { code: "I2", label: "Consulting", description: "Consulting or freelance income" },
  { code: "I4", label: "Grants", description: "Business grants received" },
  { code: "I6", label: "Other Income", description: "Other business income" },
  { code: "I5", label: "Refunds", description: "Business refunds received" },
  { code: "I1", label: "Sales", description: "Sales of goods or services" },
] as const;

export const ALL_CATEGORIES = [
  ...INCOME_CATEGORIES.map(c => ({ ...c, type: "Income" as const })),
  ...SA103_EXPENSE_CATEGORIES.map(c => ({ ...c, type: "Expense" as const })),
];

export type ExpenseCategory = typeof SA103_EXPENSE_CATEGORIES[number]["label"];
export type IncomeCategory = typeof INCOME_CATEGORIES[number]["label"];
export type CategoryLabel = ExpenseCategory | IncomeCategory;
