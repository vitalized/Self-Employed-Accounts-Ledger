import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { BookOpen, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { SA103_EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@shared/categories";
import { useToast } from "@/hooks/use-toast";
import { Transaction } from "@/lib/types";

interface JournalEntryDialogProps {
  onSuccess?: () => void;
  editTransaction?: Transaction | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const JOURNAL_CATEGORIES = [
  { code: "JE001", label: "Bank Transfer" },
  { code: "JE002", label: "Balance Adjustment" },
  { code: "JE003", label: "Opening Balance" },
  { code: "JE004", label: "Closing Entry" },
  { code: "JE007", label: "Write-off" },
  { code: "JE008", label: "Correction" },
];

const TRANSFER_CATEGORIES = [
  { code: "DRW", label: "Drawings" },
  { code: "CAP", label: "Capital Injection" },
  { code: "BTX", label: "Bank Transfer (Internal)" },
  { code: "PRS", label: "Personal Use Adjustment" },
];

const SESSION_TOKEN_KEY = "auth_session_token";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export function JournalEntryDialog({ onSuccess, editTransaction, open: controlledOpen, onOpenChange }: JournalEntryDialogProps) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const isEditMode = !!editTransaction;

  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    amount: "",
    type: "Expense" as "Income" | "Expense" | "Transfer",
    category: "",
    notes: "",
  });

  useEffect(() => {
    if (editTransaction && open) {
      const desc = editTransaction.description.replace(/^\[Journal\]\s*/, '');
      setFormData({
        date: format(parseISO(editTransaction.date), "yyyy-MM-dd"),
        description: desc,
        amount: Math.abs(editTransaction.amount).toString(),
        type: (editTransaction.businessType as "Income" | "Expense" | "Transfer") || "Expense",
        category: editTransaction.category || "",
        notes: editTransaction.reference || "",
      });
    }
  }, [editTransaction, open]);

  const resetForm = () => {
    setFormData({
      date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      amount: "",
      type: "Expense" as "Income" | "Expense" | "Transfer",
      category: "",
      notes: "",
    });
  };

  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      toast({
        title: "Description Required",
        description: "Please enter a description for the journal entry.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount === 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid non-zero amount.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category) {
      toast({
        title: "Category Required",
        description: "Please select a category for the journal entry.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const transactionData = {
        date: new Date(formData.date).toISOString(),
        description: `[Journal] ${formData.description}`,
        merchant: "Journal Entry",
        amount: Math.abs(amount),
        type: "Business",
        category: formData.category,
        businessType: formData.type,
        status: "Cleared",
        tags: ["journal:entry"],
        reference: formData.notes || null,
      };

      if (isEditMode && editTransaction) {
        const response = await fetch(`/api/transactions/${editTransaction.id}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify(transactionData),
        });

        if (!response.ok) {
          throw new Error("Failed to update journal entry");
        }

        toast({
          title: "Journal Entry Updated",
          description: `Successfully updated ${formData.type.toLowerCase()} of £${Math.abs(amount).toFixed(2)}.`,
        });
      } else {
        const response = await fetch("/api/transactions", {
          method: "POST",
          headers: getAuthHeaders(),
          credentials: "include",
          body: JSON.stringify(transactionData),
        });

        if (!response.ok) {
          throw new Error("Failed to create journal entry");
        }

        toast({
          title: "Journal Entry Created",
          description: `Successfully recorded ${formData.type.toLowerCase()} of £${Math.abs(amount).toFixed(2)}.`,
        });
      }

      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving journal entry:", error);
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'create'} journal entry. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editTransaction) return;

    if (!confirm("Are you sure you want to delete this journal entry? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/transactions/${editTransaction.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete journal entry");
      }

      toast({
        title: "Journal Entry Deleted",
        description: "The journal entry has been removed from your transactions.",
      });

      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error deleting journal entry:", error);
      toast({
        title: "Error",
        description: "Failed to delete journal entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-new-journal">
            <BookOpen className="h-4 w-4" />
            Journal Entry
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {isEditMode ? "Edit Journal Entry" : "New Journal Entry"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update this journal entry. Changes will be saved to your transactions."
              : "Create a manual adjustment or transfer. This will appear in your transactions."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="journal-date">Date</Label>
              <Input
                id="journal-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                data-testid="input-journal-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="journal-type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "Income" | "Expense" | "Transfer") =>
                  setFormData({ ...formData, type: value, category: "" })
                }
              >
                <SelectTrigger id="journal-type" data-testid="select-journal-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Income">Income (Money In)</SelectItem>
                  <SelectItem value="Expense">Expense (Money Out)</SelectItem>
                  <SelectItem value="Transfer">Transfer / Drawings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="journal-description">Description</Label>
            <Input
              id="journal-description"
              placeholder="e.g., Opening balance, Balance correction..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              data-testid="input-journal-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="journal-amount">Amount (£)</Label>
              <Input
                id="journal-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                data-testid="input-journal-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="journal-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="journal-category" data-testid="select-journal-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {formData.type === "Transfer" ? (
                    <SelectGroup>
                      <SelectLabel className="text-purple-600">Transfer Categories</SelectLabel>
                      {TRANSFER_CATEGORIES.map(cat => (
                        <SelectItem key={cat.code} value={cat.label}>{cat.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ) : (
                    <>
                      <SelectGroup>
                        <SelectLabel className="text-blue-600">Journal Categories</SelectLabel>
                        {JOURNAL_CATEGORIES.map(cat => (
                          <SelectItem key={cat.code} value={cat.label}>{cat.label}</SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className={formData.type === "Income" ? "text-emerald-600" : "text-red-600"}>
                          {formData.type === "Income" ? "Income Categories" : "Expense Categories"}
                        </SelectLabel>
                        {(formData.type === "Income" ? INCOME_CATEGORIES : SA103_EXPENSE_CATEGORIES).map(cat => (
                          <SelectItem key={cat.code} value={cat.label}>{cat.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="journal-notes">Notes (Optional)</Label>
            <Textarea
              id="journal-notes"
              placeholder="Any additional details about this journal entry..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              data-testid="input-journal-notes"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          {isEditMode && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="mr-auto"
              data-testid="button-journal-delete"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-journal-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isDeleting}
              data-testid="button-journal-submit"
            >
              {isSubmitting
                ? (isEditMode ? "Updating..." : "Creating...")
                : (isEditMode ? "Update Entry" : "Create Entry")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
