import { useState, useEffect } from "react";
import { Transaction, BusinessType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { SA103_EXPENSE_CATEGORIES, INCOME_CATEGORIES, MILEAGE_CATEGORY } from "@shared/categories";

interface CategorizationRule {
  id: string;
  keyword: string;
  type: string;
  businessType: string | null;
  category: string | null;
}

interface PendingPaymentsTableProps {
  transactions: Transaction[];
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  onRefresh?: () => void;
}

export function PendingPaymentsTable({ transactions, onUpdateTransaction, onRefresh }: PendingPaymentsTableProps) {
  const [rules, setRules] = useState<CategorizationRule[]>([]);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await fetch("/api/rules");
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error) {
      console.error("Failed to fetch rules:", error);
    }
  };

  const getCategoriesForTransaction = (transaction: Transaction) => {
    if (transaction.businessType === 'Income') {
      return INCOME_CATEGORIES;
    }
    return [...SA103_EXPENSE_CATEGORIES, MILEAGE_CATEGORY];
  };

  const handleTypeChange = async (transaction: Transaction, newType: 'Business' | 'Personal') => {
    const businessType: BusinessType | undefined = newType === 'Business' 
      ? (transaction.amount > 0 ? 'Income' : 'Expense')
      : undefined;
    
    const updates: Partial<Transaction> = {
      type: newType,
      businessType,
      category: newType === 'Personal' ? undefined : transaction.category
    };

    onUpdateTransaction(transaction.id, updates);

    const matchingRule = rules.find(rule => 
      (transaction.description || '').toLowerCase().includes(rule.keyword.toLowerCase()) ||
      (transaction.merchant || '').toLowerCase().includes(rule.keyword.toLowerCase())
    );

    if (matchingRule && newType === 'Business' && matchingRule.category) {
      onUpdateTransaction(transaction.id, {
        ...updates,
        category: matchingRule.category,
        businessType: matchingRule.businessType as BusinessType | undefined
      });
    }
  };

  const handleCategoryChange = (transaction: Transaction, category: string) => {
    onUpdateTransaction(transaction.id, { category });
  };

  if (transactions.length === 0) {
    return null;
  }

  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="rounded-lg border border-dashed border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-900/10 mb-4">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200/50 dark:border-amber-800/30">
        <Clock className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Upcoming Payments</span>
        <span className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
          {transactions.length}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-amber-200/50 dark:border-amber-800/30">
            <TableHead className="text-amber-700 dark:text-amber-400">Date</TableHead>
            <TableHead className="text-amber-700 dark:text-amber-400">Transaction</TableHead>
            <TableHead className="text-right text-amber-700 dark:text-amber-400">Amount</TableHead>
            <TableHead className="text-amber-700 dark:text-amber-400">Type</TableHead>
            <TableHead className="text-amber-700 dark:text-amber-400">Category</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTransactions.map((t) => (
            <TableRow 
              key={t.id} 
              data-testid={`row-pending-${t.id}`}
              className="hover:bg-amber-50/50 dark:hover:bg-amber-900/20 border-amber-200/30 dark:border-amber-800/20"
            >
              <TableCell className="font-medium text-amber-600 dark:text-amber-400">
                {format(parseISO(t.date), 'dd/MM/yyyy')}
              </TableCell>
              <TableCell>
                <div className="font-medium">{t.description || 'No description'}</div>
                <div className="text-xs text-muted-foreground">{t.reference || t.merchant}</div>
              </TableCell>
              <TableCell className={cn(
                "text-right font-bold",
                t.amount > 0 ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"
              )}>
                {t.amount > 0 ? '+' : ''}£{Math.abs(t.amount).toFixed(2)}
              </TableCell>
              <TableCell>
                <div className="inline-flex rounded-md border">
                  <Button 
                    data-testid={`button-pending-type-business-${t.id}`}
                    variant={t.type === 'Business' ? 'default' : 'ghost'} 
                    size="sm"
                    className="h-6 text-[10px] px-2 rounded-none rounded-l-md border-0"
                    onClick={() => handleTypeChange(t, 'Business')}
                  >
                    <span className="md:hidden">Biz</span>
                    <span className="hidden md:inline">Business</span>
                  </Button>
                  <Button 
                    data-testid={`button-pending-type-personal-${t.id}`}
                    variant={t.type === 'Personal' ? 'secondary' : 'ghost'} 
                    size="sm"
                    className="h-6 text-[10px] px-2 rounded-none rounded-r-md border-0 border-l"
                    onClick={() => handleTypeChange(t, 'Personal')}
                  >
                    <span className="md:hidden">Per</span>
                    <span className="hidden md:inline">Personal</span>
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                {t.type === 'Business' ? (
                  <Select
                    value={t.category || ""}
                    onValueChange={(value) => handleCategoryChange(t, value)}
                  >
                    <SelectTrigger 
                      data-testid={`select-pending-category-${t.id}`}
                      className="h-8 text-xs"
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {getCategoriesForTransaction(t).map((cat) => (
                        <SelectItem 
                          key={cat.code} 
                          value={cat.label}
                          data-testid={`option-pending-category-${cat.code}`}
                        >
                          <span className="font-medium">{cat.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-muted-foreground">-</div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
