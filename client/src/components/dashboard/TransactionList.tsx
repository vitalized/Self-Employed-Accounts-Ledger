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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertCircle, Wand2 } from "lucide-react";
import { SA103_EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@shared/categories";
import { useToast } from "@/hooks/use-toast";

interface CategorizationRule {
  id: string;
  keyword: string;
  type: string;
  businessType: string | null;
  category: string | null;
}

interface TransactionListProps {
  transactions: Transaction[];
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
}

export function TransactionList({ transactions, onUpdateTransaction }: TransactionListProps) {
  const { toast } = useToast();
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [pendingRule, setPendingRule] = useState<{
    keyword: string;
    type: string;
    businessType: string | null;
    category: string | null;
    transactionId: string;
  } | null>(null);
  const [existingRule, setExistingRule] = useState<CategorizationRule | null>(null);

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
      console.error("Error fetching rules:", error);
    }
  };

  const getCategoriesForTransaction = (t: Transaction) => {
    if (t.amount > 0) {
      return INCOME_CATEGORIES;
    }
    return SA103_EXPENSE_CATEGORIES;
  };

  const handleTypeChange = (transaction: Transaction, type: 'Business' | 'Personal', businessType?: 'Income' | 'Expense') => {
    const finalBusinessType = businessType || (type === 'Business' ? (transaction.amount > 0 ? 'Income' : 'Expense') : undefined);
    
    onUpdateTransaction(transaction.id, { 
      type, 
      businessType: finalBusinessType
    });
    
    // Only show rule dialog immediately for Personal (no category needed)
    // For Business, wait until they select a category
    if (type === 'Personal') {
      const keyword = transaction.merchant || transaction.description;
      const existing = rules.find(r => r.keyword.toLowerCase() === keyword.toLowerCase());
      
      setPendingRule({
        keyword,
        type,
        businessType: null,
        category: null,
        transactionId: transaction.id,
      });
      setExistingRule(existing || null);
      setShowRuleDialog(true);
    }
  };

  const handleCategoryChange = (transaction: Transaction, category: string) => {
    onUpdateTransaction(transaction.id, { category });
    
    const keyword = transaction.merchant || transaction.description;
    const existing = rules.find(r => r.keyword.toLowerCase() === keyword.toLowerCase());
    
    // For Business transactions, we have complete info now (type + category)
    const businessType = transaction.businessType || (transaction.amount > 0 ? 'Income' : 'Expense');
    
    setPendingRule({
      keyword,
      type: 'Business', // Category selection only happens for Business transactions
      businessType,
      category,
      transactionId: transaction.id,
    });
    setExistingRule(existing || null);
    setShowRuleDialog(true);
  };

  const handleCreateRule = async () => {
    if (!pendingRule) return;

    try {
      if (existingRule) {
        const response = await fetch(`/api/rules/${existingRule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: pendingRule.keyword,
            type: pendingRule.type,
            businessType: pendingRule.businessType,
            category: pendingRule.category,
          })
        });
        if (response.ok) {
          toast({ title: "Rule Updated", description: `Rule for "${pendingRule.keyword}" has been updated.` });
          fetchRules();
        }
      } else {
        const response = await fetch("/api/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: pendingRule.keyword,
            type: pendingRule.type,
            businessType: pendingRule.businessType,
            category: pendingRule.category,
          })
        });
        if (response.ok) {
          toast({ title: "Rule Created", description: `Future "${pendingRule.keyword}" transactions will be auto-categorized.` });
          fetchRules();
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save rule.", variant: "destructive" });
    }
    
    setShowRuleDialog(false);
    setPendingRule(null);
    setExistingRule(null);
  };

  const handleSkipRule = () => {
    setShowRuleDialog(false);
    setPendingRule(null);
    setExistingRule(null);
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead>Transaction</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-[200px]">Type</TableHead>
            <TableHead className="w-[200px]">Category</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={t.id} data-testid={`row-transaction-${t.id}`} className={cn(
              t.type === 'Unreviewed' ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
            )}>
              <TableCell className="font-medium text-muted-foreground">
                {format(parseISO(t.date), 'dd/MM/yyyy')}
              </TableCell>
              <TableCell>
                <div className="font-medium">{t.description}</div>
                <div className="text-xs text-muted-foreground">{t.merchant}</div>
              </TableCell>
              <TableCell className={cn(
                "text-right font-bold",
                t.amount > 0 ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"
              )}>
                {t.amount > 0 ? '+' : ''}£{Math.abs(t.amount).toFixed(2)}
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-1">
                  <Button 
                    data-testid={`button-type-business-${t.id}`}
                    variant={t.type === 'Business' ? 'default' : 'outline'} 
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleTypeChange(t, 'Business')}
                  >
                    Business
                  </Button>
                  <Button 
                    data-testid={`button-type-personal-${t.id}`}
                    variant={t.type === 'Personal' ? 'secondary' : 'outline'} 
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleTypeChange(t, 'Personal')}
                  >
                    Personal
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
                      data-testid={`select-category-${t.id}`}
                      className="h-8 text-xs w-[180px]"
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {getCategoriesForTransaction(t).map((cat) => (
                        <SelectItem 
                          key={cat.code} 
                          value={cat.label}
                          data-testid={`option-category-${cat.code}`}
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
          {transactions.length === 0 && (
             <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No transactions found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-600" />
              {existingRule ? "Update Rule?" : "Create Auto-Categorization Rule?"}
            </DialogTitle>
            <DialogDescription>
              {existingRule 
                ? `A rule already exists for "${pendingRule?.keyword}". Would you like to update it?`
                : `Would you like to automatically categorize future "${pendingRule?.keyword}" transactions the same way?`
              }
            </DialogDescription>
          </DialogHeader>
          
          {pendingRule && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rule-keyword">Keyword to match</Label>
                <Input
                  id="rule-keyword"
                  value={pendingRule.keyword}
                  onChange={(e) => setPendingRule({ ...pendingRule, keyword: e.target.value })}
                  data-testid="input-rule-keyword-dialog"
                />
                <p className="text-xs text-muted-foreground">
                  Transactions containing this text will be auto-categorized
                </p>
              </div>
              
              <div className="rounded-md bg-slate-50 dark:bg-slate-900 p-3 space-y-1">
                <div className="text-sm">
                  <span className="text-muted-foreground">Type:</span>{" "}
                  <span className={`font-medium ${pendingRule.type === 'Business' ? 'text-blue-600' : 'text-gray-600'}`}>
                    {pendingRule.type}
                  </span>
                </div>
                {pendingRule.type === "Business" && pendingRule.businessType && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Business Type:</span>{" "}
                    <span className={pendingRule.businessType === 'Income' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {pendingRule.businessType}
                    </span>
                  </div>
                )}
                {pendingRule.category && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Category:</span>{" "}
                    <span className="text-purple-600 font-medium">{pendingRule.category}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleSkipRule} data-testid="button-skip-rule">
              Skip
            </Button>
            <Button onClick={handleCreateRule} data-testid="button-save-rule-dialog">
              {existingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
