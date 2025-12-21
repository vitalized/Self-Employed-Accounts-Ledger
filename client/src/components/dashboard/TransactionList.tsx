import { useState, useEffect, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { AlertCircle, Wand2, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { SA103_EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@shared/categories";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

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
  onRefresh?: () => void;
}

export function TransactionList({ transactions, onUpdateTransaction, onRefresh }: TransactionListProps) {
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
  const [applyToPast, setApplyToPast] = useState(true);
  const [sortColumn, setSortColumn] = useState<'date' | 'description' | 'amount' | 'type' | 'category'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

  const toggleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: typeof sortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    let comparison = 0;
    switch (sortColumn) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case 'description':
        comparison = (a.description || '').localeCompare(b.description || '');
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'type':
        comparison = (a.type || '').localeCompare(b.type || '');
        break;
      case 'category':
        comparison = (a.category || '').localeCompare(b.category || '');
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / ITEMS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 when transactions change (filters applied)
  useEffect(() => {
    setCurrentPage(1);
  }, [transactions]);

  useEffect(() => {
    fetchRules();
    fetchNotes();
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

  const fetchNotes = async () => {
    try {
      const data = await api.notes.getAll();
      const notesMap: Record<string, string> = {};
      for (const n of data) {
        notesMap[n.description] = n.note;
      }
      setNotes(notesMap);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  const handleNoteChange = (description: string, value: string) => {
    setPendingNotes(prev => ({ ...prev, [description]: value }));
  };

  const saveNote = useCallback(async (description: string, note: string) => {
    try {
      await api.notes.set(description, note);
      setNotes(prev => ({ ...prev, [description]: note }));
    } catch (error) {
      toast({ title: "Error", description: "Failed to save note.", variant: "destructive" });
    }
  }, [toast]);

  const handleNoteBlur = (description: string) => {
    const pendingValue = pendingNotes[description];
    if (pendingValue !== undefined && pendingValue !== notes[description]) {
      saveNote(description, pendingValue);
    }
    setPendingNotes(prev => {
      const copy = { ...prev };
      delete copy[description];
      return copy;
    });
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
      let saveSucceeded = false;
      
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
          saveSucceeded = true;
          toast({ title: "Rule Updated", description: `Rule for "${pendingRule.keyword}" has been updated.` });
          fetchRules();
        } else {
          toast({ title: "Error", description: "Failed to update rule.", variant: "destructive" });
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
          saveSucceeded = true;
          toast({ title: "Rule Created", description: `Future "${pendingRule.keyword}" transactions will be auto-categorized.` });
          fetchRules();
        } else {
          toast({ title: "Error", description: "Failed to create rule.", variant: "destructive" });
        }
      }
      
      // Apply to past transactions if checkbox is checked and save succeeded
      if (applyToPast && saveSucceeded) {
        try {
          const applyResponse = await fetch("/api/rules/apply-all", { method: "POST" });
          if (applyResponse.ok) {
            const result = await applyResponse.json();
            if (result.updated > 0) {
              toast({ title: "Rules Applied", description: `${result.updated} past transactions were updated.` });
              // Refresh the transaction list to show updated categorizations
              onRefresh?.();
            }
          } else {
            toast({ title: "Warning", description: "Rule saved, but could not apply to past transactions.", variant: "destructive" });
          }
        } catch (applyError) {
          toast({ title: "Warning", description: "Rule saved, but could not apply to past transactions.", variant: "destructive" });
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save rule.", variant: "destructive" });
    }
    
    setShowRuleDialog(false);
    setPendingRule(null);
    setExistingRule(null);
    setApplyToPast(true);
  };

  const handleSkipRule = () => {
    setShowRuleDialog(false);
    setPendingRule(null);
    setExistingRule(null);
  };

  return (
    <div className="rounded-md border bg-card">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px] px-3">
              <button 
                onClick={() => toggleSort('date')} 
                className="flex items-center hover:text-foreground transition-colors"
                data-testid="sort-date"
              >
                Date <SortIcon column="date" />
              </button>
            </TableHead>
            <TableHead className="px-3">
              <button 
                onClick={() => toggleSort('description')} 
                className="flex items-center hover:text-foreground transition-colors"
                data-testid="sort-description"
              >
                Transaction <SortIcon column="description" />
              </button>
            </TableHead>
            <TableHead className="text-right px-3">
              <button 
                onClick={() => toggleSort('amount')} 
                className="flex items-center ml-auto hover:text-foreground transition-colors"
                data-testid="sort-amount"
              >
                Amount <SortIcon column="amount" />
              </button>
            </TableHead>
            <TableHead className="w-[120px] px-3">
              <button 
                onClick={() => toggleSort('type')} 
                className="flex items-center hover:text-foreground transition-colors"
                data-testid="sort-type"
              >
                Type <SortIcon column="type" />
              </button>
            </TableHead>
            <TableHead className="w-[180px] px-3">
              <button 
                onClick={() => toggleSort('category')} 
                className="flex items-center hover:text-foreground transition-colors"
                data-testid="sort-category"
              >
                Category <SortIcon column="category" />
              </button>
            </TableHead>
            <TableHead className="w-[150px] px-3">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTransactions.map((t) => (
            <TableRow key={t.id} data-testid={`row-transaction-${t.id}`} className={cn(
              t.type === 'Unreviewed' ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
            )}>
              <TableCell className="font-medium text-muted-foreground px-3">
                {format(parseISO(t.date), 'dd/MM/yyyy')}
              </TableCell>
              <TableCell className="px-3">
                <div className="font-medium">{t.description}</div>
                <div className="text-xs text-muted-foreground">{t.reference || t.merchant}</div>
              </TableCell>
              <TableCell className={cn(
                "text-right font-bold px-3",
                t.amount > 0 ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"
              )}>
                {t.amount > 0 ? '+' : ''}£{Math.abs(t.amount).toFixed(2)}
              </TableCell>
              <TableCell className="px-3">
                <div className="inline-flex rounded-md border">
                  <Button 
                    data-testid={`button-type-business-${t.id}`}
                    variant={t.type === 'Business' ? 'default' : 'ghost'} 
                    size="sm"
                    className="h-6 text-[10px] px-2 rounded-none rounded-l-md border-0"
                    onClick={() => handleTypeChange(t, 'Business')}
                  >
                    <span className="md:hidden">Biz</span>
                    <span className="hidden md:inline">Business</span>
                  </Button>
                  <Button 
                    data-testid={`button-type-personal-${t.id}`}
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
              <TableCell className="px-3">
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
                      className="h-8 text-xs w-full"
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
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
              <TableCell className="px-3">
                <Input
                  data-testid={`input-note-${t.id}`}
                  placeholder="Add note..."
                  className="h-7 text-xs"
                  value={pendingNotes[t.description] ?? notes[t.description] ?? ''}
                  onChange={(e) => handleNoteChange(t.description, e.target.value)}
                  onBlur={() => handleNoteBlur(t.description)}
                />
              </TableCell>
            </TableRow>
          ))}
          {transactions.length === 0 && (
             <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No transactions found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, sortedTransactions.length)} of {sortedTransactions.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={validPage === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {validPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={validPage === totalPages}
              data-testid="button-next-page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="apply-to-past"
                  checked={applyToPast}
                  onCheckedChange={(checked) => setApplyToPast(checked === true)}
                  data-testid="checkbox-apply-to-past"
                />
                <Label htmlFor="apply-to-past" className="text-sm font-normal cursor-pointer">
                  Apply to all past transactions
                </Label>
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
