import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Building, Download, Trash2, Key, ChevronDown, ChevronUp, ExternalLink, Info } from "lucide-react";
import { useTheme } from "next-themes";
import { useDataMode } from "@/lib/dataContext";

export default function Settings() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { useMockData, setUseMockData } = useDataMode();
  const [starlingConnected, setStarlingConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [token, setToken] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Check Starling connection status on mount
  useEffect(() => {
    setMounted(true);
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

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your bank integrations and application preferences.
          </p>
        </div>

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
                     {/* Placeholder icon for Starling */}
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
                        Connected • Syncing active
                     </div>
                  )}
                </div>
              </div>
              <div>
                 {starlingConnected ? (
                   <Button variant="outline" size="sm" onClick={handleDisconnectStarling} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                     Disconnect
                   </Button>
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
                               Visit the <a href="https://developer.starlingbank.com/signup" target="_blank" rel="noreferrer" className="text-purple-600 underline hover:text-purple-700">Starling Developer Portal</a> and sign up for a developer account using your email address.
                             </p>
                           </div>
                         </div>

                         <div className="flex gap-3">
                           <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">2</div>
                           <div className="space-y-1">
                             <p className="font-medium text-sm">Link Your Starling Bank Account</p>
                             <p className="text-sm text-muted-foreground">
                               In the Developer Portal, go to <strong>"Personal Access"</strong> in the left sidebar and click <strong>"Link Account"</strong>. 
                               Log in with your Starling mobile app to authorise the connection.
                             </p>
                           </div>
                         </div>

                         <div className="flex gap-3">
                           <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">3</div>
                           <div className="space-y-1">
                             <p className="font-medium text-sm">Create a Personal Access Token</p>
                             <p className="text-sm text-muted-foreground">
                               Once linked, click <strong>"Create Token"</strong>. Select these permissions:
                             </p>
                             <ul className="text-sm text-muted-foreground list-disc ml-4 mt-1 space-y-0.5">
                               <li><code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">account:read</code> - View account details</li>
                               <li><code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">balance:read</code> - View account balance</li>
                               <li><code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">transaction:read</code> - View transactions</li>
                             </ul>
                           </div>
                         </div>

                         <div className="flex gap-3">
                           <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">4</div>
                           <div className="space-y-1">
                             <p className="font-medium text-sm">Copy and Paste Your Token</p>
                             <p className="text-sm text-muted-foreground">
                               Copy the generated token (it starts with <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">eyJ...</code>) and paste it in the field above.
                               <strong className="text-amber-600 dark:text-amber-400"> Save it securely - you won't be able to see it again!</strong>
                             </p>
                           </div>
                         </div>
                       </div>
                     </div>

                     <Separator />

                     <div className="space-y-4">
                       <h5 className="font-semibold text-base">Sandbox Testing (Optional)</h5>
                       <p className="text-sm text-muted-foreground">
                         If you want to test without using real money, you can use the Starling Sandbox:
                       </p>
                       <div className="space-y-3">
                         <div className="flex gap-3">
                           <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">1</div>
                           <div className="space-y-1">
                             <p className="font-medium text-sm">Register an Application</p>
                             <p className="text-sm text-muted-foreground">
                               In the Developer Portal, go to <strong>"My Applications"</strong> and click <strong>"Create Application"</strong>.
                               Give it a name like "TaxTrack Testing".
                             </p>
                           </div>
                         </div>

                         <div className="flex gap-3">
                           <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">2</div>
                           <div className="space-y-1">
                             <p className="font-medium text-sm">Use the Sandbox Simulator</p>
                             <p className="text-sm text-muted-foreground">
                               Go to <strong>"Sandbox"</strong> → <strong>"Sandbox Customers"</strong>. Create test customers and accounts, 
                               then use the simulator to generate dummy transactions.
                             </p>
                           </div>
                         </div>

                         <div className="flex gap-3">
                           <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">3</div>
                           <div className="space-y-1">
                             <p className="font-medium text-sm">Get Sandbox Access Token</p>
                             <p className="text-sm text-muted-foreground">
                               The sandbox uses a different API URL (<code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">api-sandbox.starlingbank.com</code>). 
                               Generate a sandbox token from your application's sandbox settings.
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
                       <span className="text-muted-foreground">•</span>
                       <a 
                         href="https://developer.starlingbank.com/community" 
                         target="_blank" 
                         rel="noreferrer"
                         className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium"
                       >
                         <ExternalLink className="h-3.5 w-3.5" />
                         Developer Slack Community
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
                  <Label>Dark Mode</Label>
                  <p className="text-[0.8rem] text-muted-foreground">
                     Toggle application theme
                  </p>
               </div>
               <Switch 
                  checked={mounted && theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  disabled={!mounted}
               />
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

        <Card>
           <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>
                 Irreversible actions for your data.
              </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                 <div className="space-y-0.5">
                    <Label>Clear All Data</Label>
                    <p className="text-[0.8rem] text-muted-foreground">
                       Remove all imported transactions and reset settings.
                    </p>
                 </div>
                 <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Reset App
                 </Button>
              </div>
           </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
