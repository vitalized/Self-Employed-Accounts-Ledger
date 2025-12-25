// Official HMRC SA103F Expense Categories (Boxes 17-30)
export const SA103_EXPENSE_CATEGORIES = [
  { code: "17", label: "Cost of Goods", description: "Cost of goods bought for resale or goods used" },
  { code: "18", label: "Subcontractor Costs", description: "Construction industry payments to subcontractors" },
  { code: "19", label: "Staff Costs", description: "Wages, salaries and other staff costs" },
  { code: "20", label: "Travel & Vehicle", description: "Car, van, travel, hotels and business accommodation" },
  { code: "21", label: "Premises Costs", description: "Rent, rates, power, insurance and licences" },
  { code: "22", label: "Repairs & Maintenance", description: "Repairs and maintenance of property and equipment" },
  { code: "23", label: "Office Costs", description: "Phone, mobile, broadband, stationery, postage and software" },
  { code: "24", label: "Advertising", description: "Advertising, website, hosting and marketing costs" },
  { code: "25", label: "Loan Interest", description: "Interest on bank and other loans" },
  { code: "26", label: "Bank Charges", description: "Bank, credit card and other financial charges" },
  { code: "27", label: "Bad Debts", description: "Irrecoverable debts written off" },
  { code: "28", label: "Professional Fees", description: "Accountancy, legal and other professional fees" },
  { code: "29", label: "Depreciation", description: "Depreciation and loss/profit on sale of assets" },
  { code: "30", label: "Other Expenses", description: "Books, magazines, subscriptions, courses, training and other" },
] as const;

// Mapping from legacy/custom category labels to official HMRC box codes
// This ensures existing transactions are correctly categorized
export const LEGACY_CATEGORY_MAPPING: Record<string, string> = {
  // Custom categories mapped to HMRC boxes
  "Accountancy": "28",
  "Books and Professional Magazines": "30",
  "Broadband": "23",
  "Courses and Training": "30",
  "Hotels and Business Accommodation": "20",
  "Insurance & Licences": "21",
  "Mobile Phone": "23",
  "Postage and Stationery": "23",
  "Software and Computer Incidentals": "23",
  "Subscriptions": "30",
  "Website and Hosting": "24",
  // Direct mappings (label to code)
  "Cost of Goods": "17",
  "Subcontractor Costs": "18",
  "Staff Costs": "19",
  "Travel & Vehicle": "20",
  "Premises Costs": "21",
  "Repairs & Maintenance": "22",
  "Office Costs": "23",
  "Advertising": "24",
  "Loan Interest": "25",
  "Bank Charges": "26",
  "Bad Debts": "27",
  "Professional Fees": "28",
  "Depreciation": "29",
  "Other Expenses": "30",
};

// Helper function to get the HMRC box code for any category label
export function getHMRCBoxCode(categoryLabel: string): string {
  return LEGACY_CATEGORY_MAPPING[categoryLabel] || "30"; // Default to "Other Expenses"
}

// Helper function to get the official category label for a box code
export function getOfficialCategoryLabel(code: string): string {
  const category = SA103_EXPENSE_CATEGORIES.find(c => c.code === code);
  return category?.label || "Other Expenses";
}

// Special category for transactions covered by mileage allowance (not included in expenses)
export const MILEAGE_CATEGORY = {
  code: "MILEAGE",
  label: "Covered by Mileage Allowance",
  description: "Cost already covered by HMRC mileage allowance (45p/25p per mile) - not counted as expense"
} as const;

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
