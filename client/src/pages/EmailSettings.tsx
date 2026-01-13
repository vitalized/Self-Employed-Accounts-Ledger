import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Save, Send, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

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

interface EmailConfig {
  postmarkApiToken: string;
  postmarkFromEmail: string;
  postmarkFromName: string;
}

export default function EmailSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [config, setConfig] = useState<EmailConfig>({
    postmarkApiToken: "",
    postmarkFromEmail: "",
    postmarkFromName: "Viatlized",
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/email/config", {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setConfig({
          postmarkApiToken: data.postmarkApiToken || "",
          postmarkFromEmail: data.postmarkFromEmail || "",
          postmarkFromName: data.postmarkFromName || "Viatlized",
        });
        setIsConfigured(!!data.postmarkApiToken && !!data.postmarkFromEmail);
      }
    } catch (error) {
      console.error("Failed to fetch email config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.postmarkApiToken || !config.postmarkFromEmail) {
      toast({
        title: "Missing fields",
        description: "Please fill in the API token and from email address.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/email/config", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setIsConfigured(true);
        toast({
          title: "Settings saved",
          description: "Your email configuration has been updated.",
        });
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast({
          title: "Test email sent",
          description: `A test email was sent to ${data.sentTo}`,
        });
      } else {
        throw new Error(data.error || "Failed to send test email");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <CardTitle>Email Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure Postmark for sending verification codes, invitations, and password reset emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
            {isConfigured ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm">Email sending is configured and ready</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span className="text-sm">Email sending is not configured - verification codes will be logged to console</span>
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="postmarkApiToken">Postmark Server API Token</Label>
              <div className="relative">
                <Input
                  id="postmarkApiToken"
                  type={showToken ? "text" : "password"}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={config.postmarkApiToken}
                  onChange={(e) => setConfig({ ...config, postmarkApiToken: e.target.value })}
                  className="pr-10"
                  data-testid="input-postmark-token"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in your Postmark account under Server &gt; API Tokens
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="postmarkFromEmail">From Email Address</Label>
              <Input
                id="postmarkFromEmail"
                type="email"
                placeholder="noreply@yourdomain.com"
                value={config.postmarkFromEmail}
                onChange={(e) => setConfig({ ...config, postmarkFromEmail: e.target.value })}
                data-testid="input-postmark-from-email"
              />
              <p className="text-xs text-muted-foreground">
                This must be a verified sender signature in Postmark
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="postmarkFromName">From Name</Label>
              <Input
                id="postmarkFromName"
                type="text"
                placeholder="Viatlized"
                value={config.postmarkFromName}
                onChange={(e) => setConfig({ ...config, postmarkFromName: e.target.value })}
                data-testid="input-postmark-from-name"
              />
              <p className="text-xs text-muted-foreground">
                The display name that recipients will see
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-email-config">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
            {isConfigured && (
              <Button variant="outline" onClick={handleTestEmail} disabled={testing} data-testid="button-test-email">
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Test Email
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About Postmark</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Postmark is a transactional email service that provides reliable delivery for verification codes, 
            password resets, and user invitations.
          </p>
          <p>
            To get started:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Create a free account at <a href="https://postmarkapp.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">postmarkapp.com</a></li>
            <li>Add and verify your sender signature (the email address you'll send from)</li>
            <li>Copy your Server API Token from the server settings</li>
            <li>Paste the token above and save</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
