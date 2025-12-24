import { useState, useEffect } from "react";
import { Transaction } from "@/lib/types";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock, AlertCircle } from "lucide-react";
import { SA103_EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@shared/categories";
import { useToast } from "@/hooks/use-toast";
import { BusinessType } from "@/lib/types";

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
  const { toast } = useToast();
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
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10">
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          Due Payments
          <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700">
            {transactions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Due Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-[100px]">Amount</TableHead>
              <TableHead className="w-[140px]">Type</TableHead>
              <TableHead className="w-[180px]">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransactions.map((t) => (
              <TableRow key={t.id} data-testid={`row-pending-${t.id}`}>
                <TableCell className="font-medium text-amber-700 dark:text-amber-400">
                  {format(parseISO(t.date), 'dd/MM/yyyy')}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{t.description || 'No description'}</div>
                  <div className="text-xs text-muted-foreground">{t.reference || t.merchant || ''}</div>
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
                  {t.type === 'Unreviewed' ? (
                    <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Review
                    </Badge>
                  ) : t.type === 'Business' ? (
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
      </CardContent>
    </Card>
  );
}
