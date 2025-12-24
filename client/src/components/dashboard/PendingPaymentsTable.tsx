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
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { SA103_EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@shared/categories";

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
    return SA103_EXPENSE_CATEGORIES;
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
    <div className="rounded-lg border border-dashed border-amber-200/60 dark:border-amber-800/40 bg-amber-50/20 dark:bg-amber-900/5 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3.5 w-3.5 text-amber-500/70" />
        <span className="text-sm font-medium text-amber-700/80 dark:text-amber-400/80">Due Payments</span>
        <span className="text-xs text-amber-600/60 bg-amber-100/50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
          {transactions.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {sortedTransactions.map((t) => (
          <div 
            key={t.id} 
            data-testid={`row-pending-${t.id}`}
            className="flex items-center gap-3 text-sm py-1.5 px-2 rounded bg-white/50 dark:bg-slate-900/30"
          >
            <span className="text-xs text-amber-600/70 dark:text-amber-400/70 w-[70px] shrink-0">
              {format(parseISO(t.date), 'dd/MM/yy')}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm truncate block">{t.description || 'No description'}</span>
            </div>
            <span className={cn(
              "text-sm font-medium w-[80px] text-right shrink-0",
              t.amount > 0 ? "text-emerald-600" : "text-slate-700 dark:text-slate-300"
            )}>
              £{Math.abs(t.amount).toFixed(2)}
            </span>
            <div className="inline-flex rounded border border-slate-200 dark:border-slate-700 shrink-0">
              <Button 
                data-testid={`button-pending-type-business-${t.id}`}
                variant={t.type === 'Business' ? 'default' : 'ghost'} 
                size="sm"
                className="h-5 text-[9px] px-1.5 rounded-none rounded-l border-0"
                onClick={() => handleTypeChange(t, 'Business')}
              >
                Biz
              </Button>
              <Button 
                data-testid={`button-pending-type-personal-${t.id}`}
                variant={t.type === 'Personal' ? 'secondary' : 'ghost'} 
                size="sm"
                className="h-5 text-[9px] px-1.5 rounded-none rounded-r border-0 border-l"
                onClick={() => handleTypeChange(t, 'Personal')}
              >
                Per
              </Button>
            </div>
            {t.type === 'Business' ? (
              <Select
                value={t.category || ""}
                onValueChange={(value) => handleCategoryChange(t, value)}
              >
                <SelectTrigger 
                  data-testid={`select-pending-category-${t.id}`}
                  className="h-6 text-xs w-[120px] shrink-0"
                >
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {getCategoriesForTransaction(t).map((cat) => (
                    <SelectItem 
                      key={cat.code} 
                      value={cat.label}
                      data-testid={`option-pending-category-${cat.code}`}
                    >
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-[120px] shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
