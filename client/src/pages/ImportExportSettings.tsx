import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { FileDown, Upload, CheckCircle2, AlertCircle, FileSpreadsheet, ListFilter, Tag } from "lucide-react";

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors?: string[];
  message: string;
}

export default function ImportExportSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [transactionsDragging, setTransactionsDragging] = useState(false);
  const [rulesDragging, setRulesDragging] = useState(false);
  const [categoriesDragging, setCategoriesDragging] = useState(false);
  
  const [transactionsImporting, setTransactionsImporting] = useState(false);
  const [rulesImporting, setRulesImporting] = useState(false);
  const [categoriesImporting, setCategoriesImporting] = useState(false);
  
  const [transactionsResult, setTransactionsResult] = useState<ImportResult | null>(null);
  const [rulesResult, setRulesResult] = useState<ImportResult | null>(null);
  const [categoriesResult, setCategoriesResult] = useState<ImportResult | null>(null);

  const handleExport = async (type: 'transactions' | 'rules' | 'categories') => {
    try {
      const response = await fetch(`/api/export/${type}`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: `Failed to export ${type}.`,
        variant: "destructive"
      });
    }
  };

  const handleImport = useCallback(async (
    file: File,
    type: 'transactions' | 'rules' | 'categories',
    setImporting: (v: boolean) => void,
    setResult: (r: ImportResult | null) => void
  ) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file.",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const csvContent = await file.text();
      
      const response = await fetch(`/api/import/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent })
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        
        if (type === 'transactions') {
          queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        } else if (type === 'rules') {
          queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
        } else if (type === 'categories') {
          queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        }
        
        toast({
          title: "Import Complete",
          description: data.message,
        });
      } else {
        toast({
          title: "Import Failed",
          description: data.error || "Failed to import CSV.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Import Error",
        description: "Failed to read or import the CSV file.",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  }, [toast, queryClient]);

  const createDropHandlers = (
    type: 'transactions' | 'rules' | 'categories',
    setDragging: (v: boolean) => void,
    setImporting: (v: boolean) => void,
    setResult: (r: ImportResult | null) => void
  ) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleImport(files[0], type, setImporting, setResult);
      }
    }
  });

  const createFileInputHandler = (
    type: 'transactions' | 'rules' | 'categories',
    setImporting: (v: boolean) => void,
    setResult: (r: ImportResult | null) => void
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImport(files[0], type, setImporting, setResult);
    }
  };

  const renderImportResult = (result: ImportResult | null) => {
    if (!result) return null;
    
    const isSuccess = result.imported > 0;
    const hasErrors = result.errors && result.errors.length > 0;
    
    return (
      <Alert variant={isSuccess ? "default" : "destructive"} className="mt-4">
        {isSuccess ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        <AlertTitle>{result.message}</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="text-sm">
            <span className="font-medium">Total: </span>{result.total} rows
            <span className="mx-2">•</span>
            <span className="font-medium text-green-600">Imported: </span>{result.imported}
            <span className="mx-2">•</span>
            <span className="font-medium text-amber-600">Skipped: </span>{result.skipped}
          </div>
          {hasErrors && (
            <div className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">Errors: </span>
              {result.errors!.slice(0, 3).join(', ')}
              {result.errors!.length > 3 && ` (+${result.errors!.length - 3} more)`}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-green-600" />
            <CardTitle>Export Data</CardTitle>
          </div>
          <CardDescription>
            Download your data as CSV files for backup or use in other applications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              onClick={() => handleExport('transactions')}
              data-testid="button-export-transactions"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Transactions
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('rules')}
              data-testid="button-export-rules"
            >
              <ListFilter className="mr-2 h-4 w-4" />
              Export Rules
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('categories')}
              data-testid="button-export-categories"
            >
              <Tag className="mr-2 h-4 w-4" />
              Export Categories
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            <CardTitle>Import Data</CardTitle>
          </div>
          <CardDescription>
            Import data from CSV files. Duplicate records will be skipped automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Import Transactions
            </h4>
            <div
              {...createDropHandlers('transactions', setTransactionsDragging, setTransactionsImporting, setTransactionsResult)}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                transactionsDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input
                type="file"
                accept=".csv"
                onChange={createFileInputHandler('transactions', setTransactionsImporting, setTransactionsResult)}
                className="hidden"
                id="import-transactions"
                disabled={transactionsImporting}
                data-testid="input-import-transactions"
              />
              <label htmlFor="import-transactions" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {transactionsImporting ? 'Importing...' : 'Drop CSV file here or click to upload'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected columns: date, description, amount, merchant, type, category, businessType, status
                </p>
              </label>
            </div>
            {renderImportResult(transactionsResult)}
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <ListFilter className="h-4 w-4" />
              Import Categorization Rules
            </h4>
            <div
              {...createDropHandlers('rules', setRulesDragging, setRulesImporting, setRulesResult)}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                rulesDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input
                type="file"
                accept=".csv"
                onChange={createFileInputHandler('rules', setRulesImporting, setRulesResult)}
                className="hidden"
                id="import-rules"
                disabled={rulesImporting}
                data-testid="input-import-rules"
              />
              <label htmlFor="import-rules" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {rulesImporting ? 'Importing...' : 'Drop CSV file here or click to upload'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected columns: keyword, type, businessType, category
                </p>
              </label>
            </div>
            {renderImportResult(rulesResult)}
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Import Categories
            </h4>
            <div
              {...createDropHandlers('categories', setCategoriesDragging, setCategoriesImporting, setCategoriesResult)}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                categoriesDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input
                type="file"
                accept=".csv"
                onChange={createFileInputHandler('categories', setCategoriesImporting, setCategoriesResult)}
                className="hidden"
                id="import-categories"
                disabled={categoriesImporting}
                data-testid="input-import-categories"
              />
              <label htmlFor="import-categories" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {categoriesImporting ? 'Importing...' : 'Drop CSV file here or click to upload'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected columns: code, label, description, type, hmrcBox
                </p>
              </label>
            </div>
            {renderImportResult(categoriesResult)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
