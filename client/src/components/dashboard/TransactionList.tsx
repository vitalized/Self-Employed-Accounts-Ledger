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
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Check, X, AlertCircle } from "lucide-react";

interface TransactionListProps {
  transactions: Transaction[];
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
}

export function TransactionList({ transactions, onUpdateTransaction }: TransactionListProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead>Transaction</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-[300px]">Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={t.id} className={cn(
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
                    variant={t.type === 'Business' ? 'default' : 'outline'} 
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onUpdateTransaction(t.id, { type: 'Business', businessType: t.amount > 0 ? 'Income' : 'Expense' })}
                  >
                    Business
                  </Button>
                  <Button 
                    variant={t.type === 'Personal' ? 'secondary' : 'outline'} 
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onUpdateTransaction(t.id, { type: 'Personal', businessType: undefined })}
                  >
                    Personal
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                {t.type === 'Unreviewed' ? (
                  <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Review Needed
                  </Badge>
                ) : (
                  <div className="text-sm text-muted-foreground">{t.category || '-'}</div>
                )}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <span className="sr-only">Menu</span>
                  <div className="h-4 w-4 rounded-full bg-slate-200 dark:bg-slate-700" />
                </Button>
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
    </div>
  );
}
