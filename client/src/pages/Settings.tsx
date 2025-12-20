import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle, Building, Download, Trash2, Key } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [starlingConnected, setStarlingConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  const handleConnectStarling = () => {
    if (!token) {
      toast({
        title: "Access Token Required",
        description: "Please enter your Starling Personal Access Token.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    // Simulate API connection delay
    setTimeout(() => {
      setLoading(false);
      setStarlingConnected(true);
      toast({
        title: "Starling Bank Connected",
        description: "Successfully authenticated with Starling Bank API.",
      });
    }, 1500);
  };

  const handleDisconnectStarling = () => {
    setStarlingConnected(false);
    setToken("");
    toast({
      title: "Disconnected",
      description: "Starling Bank account has been disconnected.",
    });
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
               <Switch />
            </div>
            
            <Separator />
            
             <div className="flex items-center justify-between">
               <div className="space-y-0.5">
                  <Label>Mock Data</Label>
                  <p className="text-[0.8rem] text-muted-foreground">
                     Use generated data for testing purposes
                  </p>
               </div>
               <Switch defaultChecked disabled />
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
