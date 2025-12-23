import { useState, useEffect, useCallback } from "react";
import { useRoute, useLocation, Redirect } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Building, Key, ChevronDown, ChevronUp, ExternalLink, Info, Plus, Play, ListFilter, Pencil, Check, Upload, FileSpreadsheet, Trash2 } from "lucide-react";
import { useDataMode } from "@/lib/dataContext";
import { SA103_EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@shared/categories";
import { useQueryClient } from "@tanstack/react-query";

interface CategorizationRule {
  id: string;
  keyword: string;
  type: string;
  businessType: string | null;
  category: string | null;
  createdAt: string;
}

export default function Settings() {
  const { toast } = useToast();
  const { useMockData, setUseMockData } = useDataMode();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/settings/:sectionId");
  
  // Redirect /settings to /settings/rules
  if (location === "/settings") {
    return <Redirect to="/settings/rules" />;
  }
  
  const currentSection = params?.sectionId || "rules";
  
  const [starlingConnected, setStarlingConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [token, setToken] = useState("");
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [backfillingRefs, setBackfillingRefs] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    categorized: number;
    total: number;
    message: string;
    skippedTransactions?: Array<{date: string, description: string, amount: number, reason: string}>;
  } | null>(null);

  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [applyingRules, setApplyingRules] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    keyword: "",
    type: "Personal",
    businessType: null as string | null,
    category: null as string | null,
  });
  const [editRule, setEditRule] = useState({
    keyword: "",
    type: "Personal",
    businessType: null as string | null,
    category: null as string | null,
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file.",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const csvContent = await file.text();
      
      const response = await fetch("/api/import/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent })
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult({
          imported: data.imported,
          skipped: data.skipped,
          categorized: data.categorized,
          total: data.total,
          message: data.message,
          skippedTransactions: data.skippedTransactions
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        
        toast({
          title: "Import Successful",
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
      setIsImporting(false);
    }
  };

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
    } finally {
      setLoadingRules(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.keyword.trim()) {
      toast({
        title: "Keyword Required",
        description: "Please enter a keyword to match.",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule)
      });

      if (response.ok) {
        const created = await response.json();
        setRules([created, ...rules]);
        setNewRule({ keyword: "", type: "Personal", businessType: null, category: null });
        toast({
          title: "Rule Created",
          description: `Transactions containing "${created.keyword}" will be categorized automatically.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create rule.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      const response = await fetch(`/api/rules/${id}`, { method: "DELETE" });
      if (response.ok) {
        setRules(rules.filter(r => r.id !== id));
        toast({ title: "Rule Deleted" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete rule.", variant: "destructive" });
    }
  };

  const handleStartEdit = (rule: CategorizationRule) => {
    setEditingRuleId(rule.id);
    setEditRule({
      keyword: rule.keyword,
      type: rule.type,
      businessType: rule.businessType,
      category: rule.category,
    });
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setEditRule({ keyword: "", type: "Personal", businessType: null, category: null });
  };

  const handleSaveEdit = async () => {
    if (!editingRuleId || !editRule.keyword.trim()) {
      toast({ title: "Keyword Required", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`/api/rules/${editingRuleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRule)
      });

      if (response.ok) {
        const updated = await response.json();
        setRules(rules.map(r => r.id === editingRuleId ? updated : r));
        setEditingRuleId(null);
        setEditRule({ keyword: "", type: "Personal", businessType: null, category: null });
        toast({ title: "Rule Updated" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update rule.", variant: "destructive" });
    }
  };

  const handleApplyAllRules = async () => {
    setApplyingRules(true);
    try {
      const response = await fetch("/api/rules/apply-all", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Rules Applied",
          description: data.message,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to apply rules.", variant: "destructive" });
    } finally {
      setApplyingRules(false);
    }
  };

  useEffect(() => {
    checkStarlingStatus();
  }, []);

  const checkStarlingStatus = async () => {
    try {
      setCheckingStatus(true);
      const response = await fetch("/api/starling/status");
      const data = await response.json();
      setStarlingConnected(data.connected);
    } catch (error) {
      console.error("Error checking Starling status:", error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnectStarling = async () => {
    if (!token) {
      toast({
        title: "Access Token Required",
        description: "Please enter your Starling Personal Access Token.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/starling/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, useSandbox: false })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStarlingConnected(true);
        setToken("");
        toast({
          title: "Starling Bank Connected",
          description: data.message || "Successfully authenticated with Starling Bank API.",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.message || "Could not connect to Starling Bank. Please check your token.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Failed to connect to Starling Bank. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectStarling = async () => {
    try {
      const response = await fetch("/api/starling/disconnect", {
        method: "POST"
      });
      
      if (response.ok) {
        setStarlingConnected(false);
        setToken("");
        toast({
          title: "Disconnected",
          description: "Starling Bank account has been disconnected.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBackfillReferences = async () => {
    setBackfillingRefs(true);
    try {
      const response = await fetch("/api/starling/backfill-references", {
        method: "POST"
      });
      
      const data = await response.json();
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        toast({
          title: "References Updated",
          description: data.message || `Updated ${data.updated} transactions with references.`,
        });
      } else {
        toast({
          title: "Update Failed",
          description: data.error || "Failed to update transaction references.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update references. Please try again.",
        variant: "destructive"
      });
    } finally {
      setBackfillingRefs(false);
    }
  };

  const handleTabChange = (value: string) => {
    setLocation(`/settings/${value}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your rules, bank integrations and application preferences.
          </p>
        </div>

        <Tabs value={currentSection} onValueChange={handleTabChange} className="w-full">
          <TabsList data-testid="tabs-settings">
            <TabsTrigger value="rules" data-testid="tab-rules">Rules</TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">Integrations</TabsTrigger>
            <TabsTrigger value="preferences" data-testid="tab-preferences">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ListFilter className="h-5 w-5 text-blue-600" />
                  <CardTitle>Auto-Categorization Rules</CardTitle>
                </div>
                <CardDescription>
                  Create rules to automatically categorize transactions based on keywords in the transaction name.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4 border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50">
                  <h4 className="font-medium text-sm">Add New Rule</h4>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="keyword">Contains keyword</Label>
                      <Input
                        id="keyword"
                        placeholder="e.g. Amazon, Tesco"
                        value={newRule.keyword}
                        onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                        data-testid="input-rule-keyword"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Transaction Type</Label>
                      <Select
                        value={newRule.type}
                        onValueChange={(value) => setNewRule({ 
                          ...newRule, 
                          type: value,
                          businessType: value === "Business" ? "Expense" : null,
                          category: null 
                        })}
                      >
                        <SelectTrigger data-testid="select-rule-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Personal">Personal</SelectItem>
                          <SelectItem value="Business">Business</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newRule.type === "Business" && (
                      <>
                        <div className="space-y-2">
                          <Label>Business Type</Label>
                          <Select
                            value={newRule.businessType || "Expense"}
                            onValueChange={(value) => setNewRule({ ...newRule, businessType: value, category: null })}
                          >
                            <SelectTrigger data-testid="select-rule-business-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Income">Income</SelectItem>
                              <SelectItem value="Expense">Expense</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Select
                            value={newRule.category || ""}
                            onValueChange={(value) => setNewRule({ ...newRule, category: value })}
                          >
                            <SelectTrigger data-testid="select-rule-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {newRule.businessType === "Income" ? (
                                INCOME_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat.code} value={cat.label}>{cat.label}</SelectItem>
                                ))
                              ) : (
                                SA103_EXPENSE_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat.code} value={cat.label}>{cat.label}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                  <Button onClick={handleAddRule} className="mt-2" data-testid="button-add-rule">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Rule
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Existing Rules ({rules.length})</h4>
                    {rules.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleApplyAllRules}
                        disabled={applyingRules}
                        data-testid="button-apply-all-rules"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {applyingRules ? "Applying..." : "Apply All Rules to Existing Transactions"}
                      </Button>
                    )}
                  </div>
                  
                  {loadingRules ? (
                    <p className="text-sm text-muted-foreground">Loading rules...</p>
                  ) : rules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rules created yet. Add a rule above to get started.</p>
                  ) : (
                    <div className="space-y-2">
                      {rules.map((rule) => (
                        <div 
                          key={rule.id} 
                          className="p-3 border rounded-md bg-white dark:bg-slate-950"
                          data-testid={`rule-item-${rule.id}`}
                        >
                          {editingRuleId === rule.id ? (
                            <div className="space-y-3">
                              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                <Input
                                  value={editRule.keyword}
                                  onChange={(e) => setEditRule({ ...editRule, keyword: e.target.value })}
                                  placeholder="Keyword"
                                  data-testid={`input-edit-keyword-${rule.id}`}
                                />
                                <Select
                                  value={editRule.type}
                                  onValueChange={(value) => setEditRule({ 
                                    ...editRule, 
                                    type: value,
                                    businessType: value === "Business" ? "Expense" : null,
                                    category: null 
                                  })}
                                >
                                  <SelectTrigger data-testid={`select-edit-type-${rule.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Personal">Personal</SelectItem>
                                    <SelectItem value="Business">Business</SelectItem>
                                  </SelectContent>
                                </Select>
                                {editRule.type === "Business" && (
                                  <>
                                    <Select
                                      value={editRule.businessType || "Expense"}
                                      onValueChange={(value) => setEditRule({ ...editRule, businessType: value, category: null })}
                                    >
                                      <SelectTrigger data-testid={`select-edit-business-type-${rule.id}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Income">Income</SelectItem>
                                        <SelectItem value="Expense">Expense</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Select
                                      value={editRule.category || ""}
                                      onValueChange={(value) => setEditRule({ ...editRule, category: value })}
                                    >
                                      <SelectTrigger data-testid={`select-edit-category-${rule.id}`}>
                                        <SelectValue placeholder="Category" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {editRule.businessType === "Income" ? (
                                          INCOME_CATEGORIES.map((cat) => (
                                            <SelectItem key={cat.code} value={cat.label}>{cat.label}</SelectItem>
                                          ))
                                        ) : (
                                          SA103_EXPENSE_CATEGORIES.map((cat) => (
                                            <SelectItem key={cat.code} value={cat.label}>{cat.label}</SelectItem>
                                          ))
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleSaveEdit} data-testid={`button-save-rule-${rule.id}`}>
                                  <Check className="mr-1 h-3 w-3" />
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleCancelEdit} data-testid={`button-cancel-edit-${rule.id}`}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 text-sm">
                                <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                  "{rule.keyword}"
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className={`font-medium ${rule.type === 'Business' ? 'text-blue-600' : 'text-gray-600'}`}>
                                  {rule.type}
                                </span>
                                {rule.type === "Business" && (
                                  <>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-sm">{rule.businessType}</span>
                                    {rule.category && (
                                      <>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-sm text-muted-foreground">{rule.category}</span>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleStartEdit(rule)}
                                  data-testid={`button-edit-rule-${rule.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDeleteRule(rule.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  data-testid={`button-delete-rule-${rule.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-purple-600" />
                  <CardTitle>Bank Integrations</CardTitle>
                </div>
                <CardDescription>
                  Connect your bank accounts to automatically import transactions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between space-x-4 rounded-md border p-4 bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900/20">
                      <svg className="h-6 w-6 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/>
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold">Starling Bank</h4>
                      <p className="text-sm text-muted-foreground">
                        Connect your Starling business or personal account via API.
                      </p>
                      {starlingConnected && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 mt-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Connected
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {starlingConnected ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleBackfillReferences}
                          disabled={backfillingRefs}
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        >
                          {backfillingRefs ? "Updating..." : "Update References"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDisconnectStarling} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <div className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 rounded text-xs font-medium text-muted-foreground">
                        Not Connected
                      </div>
                    )}
                  </div>
                </div>

                {!starlingConnected && (
                  <div className="space-y-4 border-l-2 border-purple-200 pl-4 ml-2">
                    <div className="grid gap-2">
                      <Label htmlFor="token" className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        Personal Access Token
                      </Label>
                      <div className="flex gap-2">
                        <Input 
                          id="token" 
                          placeholder="Paste your Starling API Personal Access Token" 
                          type="password"
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          className="font-mono text-sm"
                        />
                        <Button onClick={handleConnectStarling} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
                          {loading ? "Connecting..." : "Connect"}
                        </Button>
                      </div>
                      <p className="text-[0.8rem] text-muted-foreground">
                        You can generate this in the <a href="https://developer.starlingbank.com/" target="_blank" rel="noreferrer" className="underline hover:text-primary">Starling Developer Portal</a>.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowSetupGuide(!showSetupGuide)}
                      className="flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                      data-testid="button-toggle-setup-guide"
                    >
                      {showSetupGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {showSetupGuide ? "Hide Setup Guide" : "Show Setup Guide"}
                    </button>

                    {showSetupGuide && (
                      <div className="space-y-6 rounded-lg border bg-white dark:bg-slate-950 p-4">
                        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-900">
                          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Personal Access Tokens</strong> allow you to access your own Starling account data. 
                            They don't expire and have a rate limit of 5 requests/second and 1,000 requests/day.
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="font-semibold text-base">Getting Started</h5>
                          
                          <div className="space-y-3">
                            <div className="flex gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">1</div>
                              <div className="space-y-1">
                                <p className="font-medium text-sm">Create a Developer Portal Account</p>
                                <p className="text-sm text-muted-foreground">
                                  Visit the <a href="https://developer.starlingbank.com/signup" target="_blank" rel="noreferrer" className="text-purple-600 underline hover:text-purple-700">Starling Developer Portal</a> and sign up.
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">2</div>
                              <div className="space-y-1">
                                <p className="font-medium text-sm">Link Your Starling Bank Account</p>
                                <p className="text-sm text-muted-foreground">
                                  Go to <strong>"Personal Access"</strong> → <strong>"Link Account"</strong>.
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">3</div>
                              <div className="space-y-1">
                                <p className="font-medium text-sm">Create a Personal Access Token</p>
                                <p className="text-sm text-muted-foreground">
                                  Select permissions: <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">account:read</code>, <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">balance:read</code>, <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">transaction:read</code>
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">4</div>
                              <div className="space-y-1">
                                <p className="font-medium text-sm">Copy and Paste Your Token</p>
                                <p className="text-sm text-muted-foreground">
                                  Paste the token above. <strong className="text-amber-600">Save it securely!</strong>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <a 
                            href="https://developer.starlingbank.com/docs" 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Full API Documentation
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <CardTitle>CSV Import</CardTitle>
                </div>
                <CardDescription>
                  Import transactions from a Starling Bank CSV statement. Duplicates will be automatically detected and skipped.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging 
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                      : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
                  }`}
                  data-testid="csv-drop-zone"
                >
                  {isImporting ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                      <p className="text-sm font-medium">Importing transactions...</p>
                    </div>
                  ) : (
                    <>
                      <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? 'text-green-600' : 'text-gray-400'}`} />
                      <p className="text-sm font-medium mb-1">
                        {isDragging ? "Drop CSV file here" : "Drag and drop your CSV file here"}
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        or click to browse
                      </p>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="csv-file-input"
                        data-testid="input-csv-file"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => document.getElementById('csv-file-input')?.click()}
                        data-testid="button-select-csv"
                      >
                        Select CSV File
                      </Button>
                    </>
                  )}
                </div>

                {importResult && (
                  <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 p-4" data-testid="import-result">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="w-full">
                        <p className="font-medium text-green-800 dark:text-green-200">{importResult.message}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total rows:</span>
                            <span className="font-medium">{importResult.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Imported:</span>
                            <span className="font-medium text-green-600">{importResult.imported}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Duplicates skipped:</span>
                            <span className="font-medium text-amber-600">{importResult.skipped}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Auto-categorized:</span>
                            <span className="font-medium text-blue-600">{importResult.categorized}</span>
                          </div>
                        </div>
                        
                        {importResult.skippedTransactions && importResult.skippedTransactions.length > 0 && (
                          <div className="mt-4 border-t border-green-200 dark:border-green-800 pt-3">
                            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                              Skipped Transactions:
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {importResult.skippedTransactions.map((tx, idx) => (
                                <div key={idx} className="text-xs bg-amber-50 dark:bg-amber-950/30 rounded p-2 border border-amber-200 dark:border-amber-800">
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="font-medium">{tx.date} - {tx.description}</span>
                                    <span className="text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground mt-1">{tx.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-900">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Supported format:</strong> Starling Bank CSV exports with columns Date, Counter Party, Reference, Type, Amount (GBP), Balance (GBP), Spending Category, Notes.
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Application Preferences</CardTitle>
                <CardDescription>
                  Configure how the application calculates and displays your data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tax Year</Label>
                    <Select defaultValue="uk-standard">
                      <SelectTrigger>
                        <SelectValue placeholder="Select tax year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uk-standard">UK Standard (6 April - 5 April)</SelectItem>
                        <SelectItem value="calendar">Calendar Year (1 Jan - 31 Dec)</SelectItem>
                        <SelectItem value="us-standard">US Standard (1 Jan - 31 Dec)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[0.8rem] text-muted-foreground">
                      Determines the start and end dates for tax calculations.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Base Currency</Label>
                    <Select defaultValue="gbp">
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gbp">British Pound (£)</SelectItem>
                        <SelectItem value="usd">US Dollar ($)</SelectItem>
                        <SelectItem value="eur">Euro (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mock Data</Label>
                    <p className="text-[0.8rem] text-muted-foreground">
                      Use generated data for testing purposes
                    </p>
                  </div>
                  <Switch 
                    checked={useMockData} 
                    onCheckedChange={(checked) => {
                      setUseMockData(checked);
                      toast({
                        title: checked ? "Mock Data Enabled" : "Mock Data Disabled",
                        description: checked 
                          ? "Using generated sample data for testing." 
                          : "Using real database transactions.",
                      });
                    }}
                    data-testid="switch-mock-data"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
