import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { DataProvider } from "@/lib/dataContext";
import { DateRangeProvider } from "@/lib/dateRangeContext";
import { AuthProvider, useAuthContext } from "@/lib/authContext";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, FileCheck, AlertCircle, Mail, KeyRound, Shield } from "lucide-react";
import { fetchWithAuth } from "@/hooks/use-auth";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/transactions" component={Dashboard} />
      <Route path="/reports" component={Reports} />
      <Route path="/reports/:reportId" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route path="/settings/:sectionId" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function LoginPage() {
  const { login } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await login(email, password);
    
    if (!result.success && result.error) {
      setError(result.error);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <FileCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Viatlized</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function InitialSetupPage({ onComplete }: { onComplete: () => void }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/initial-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Setup failed");
        setIsLoading(false);
        return;
      }

      onComplete();
    } catch (err) {
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <FileCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Viatlized</CardTitle>
          <CardDescription>Create your admin account to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setupEmail">Email</Label>
              <Input
                id="setupEmail"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-setup-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setupPassword">Password</Label>
              <Input
                id="setupPassword"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-setup-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-confirm-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-create-account"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function TwoFactorSetupPage({ onComplete }: { onComplete: () => void }) {
  const { logout, refetch } = useAuthContext();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSetupEmail = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetchWithAuth("/api/auth/2fa/setup", {
        method: "POST",
        body: JSON.stringify({ method: "email" }),
      });
      
      if (res.ok) {
        await refetch();
        onComplete();
      } else {
        const data = await res.json();
        setError(data.message || data.error || "Failed to enable email 2FA");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupPasskey = async () => {
    setIsLoading(true);
    setError("");
    try {
      const optionsRes = await fetchWithAuth("/api/auth/webauthn/register/options");
      if (!optionsRes.ok) {
        throw new Error("Failed to get registration options");
      }
      const options = await optionsRes.json();

      const { startRegistration } = await import("@simplewebauthn/browser");
      const credential = await startRegistration(options);

      const verifyRes = await fetchWithAuth("/api/auth/webauthn/register", {
        method: "POST",
        body: JSON.stringify({ response: credential, deviceName: "My Passkey" }),
      });

      if (verifyRes.ok) {
        await refetch();
        onComplete();
      } else {
        const data = await verifyRes.json();
        setError(data.message || data.error || "Failed to register passkey");
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Passkey registration was cancelled.");
      } else {
        setError("Failed to register passkey. Try email verification instead.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>Choose how you want to verify your identity when signing in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={handleSetupEmail}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <Mail className="h-10 w-10 text-blue-600" />
                  <div>
                    <h4 className="font-semibold">Email Verification</h4>
                    <p className="text-sm text-muted-foreground">
                      Receive a 6-digit code via email each time you sign in.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  disabled={isLoading}
                  onClick={(e) => { e.stopPropagation(); handleSetupEmail(); }}
                  data-testid="button-setup-email-2fa"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Enable Email 2FA
                </Button>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={handleSetupPasskey}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <KeyRound className="h-10 w-10 text-green-600" />
                  <div>
                    <h4 className="font-semibold">Passkey / Touch ID</h4>
                    <p className="text-sm text-muted-foreground">
                      Use your device's biometrics or security key for quick sign-in.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  disabled={isLoading}
                  onClick={(e) => { e.stopPropagation(); handleSetupPasskey(); }}
                  data-testid="button-setup-passkey-2fa"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Register Passkey
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={logout}
              className="text-sm"
              data-testid="button-cancel-2fa-setup"
            >
              Cancel and Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TwoFactorPage() {
  const { verify2FA, resend2FA, logout, user, refetch } = useAuthContext();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const isWebAuthn = user?.twoFactorMethod === 'webauthn';

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleWebAuthnVerify = async () => {
    setError("");
    setIsLoading(true);
    
    try {
      // Get authentication options from server
      const optionsRes = await fetch("/api/auth/webauthn/authenticate/options", {
        method: "POST",
        credentials: "include",
      });
      
      if (!optionsRes.ok) {
        const data = await optionsRes.json();
        throw new Error(data.error || "Failed to get authentication options");
      }
      
      const options = await optionsRes.json();
      
      // Start WebAuthn authentication
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const authResponse = await startAuthentication({ optionsJSON: options });
      
      // Verify with server
      const verifyRes = await fetch("/api/auth/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResponse),
        credentials: "include",
      });
      
      const verifyData = await verifyRes.json();
      
      if (verifyRes.ok && verifyData.success) {
        await refetch();
      } else {
        throw new Error(verifyData.error || "Authentication failed");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "WebAuthn authentication failed";
      if (errorMessage.includes("cancelled") || errorMessage.includes("NotAllowedError")) {
        setError("Authentication was cancelled. Please try again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-start WebAuthn verification when page loads for passkey users
  useEffect(() => {
    if (isWebAuthn && !isLoading && !error) {
      handleWebAuthnVerify();
    }
  }, [isWebAuthn]);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    
    setError("");
    setIsLoading(true);

    const result = await verify2FA(code);
    
    if (!result.success && result.error) {
      setError(result.error);
      setCode("");
    }
    
    setIsLoading(false);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    const result = await resend2FA();
    
    if (result.success) {
      setResendCooldown(60);
    } else if (result.error) {
      setError(result.error);
    }
  };

  useEffect(() => {
    if (code.length === 6) {
      handleVerify();
    }
  }, [code]);

  // WebAuthn/Passkey verification UI
  if (isWebAuthn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Fingerprint className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Verify Your Identity</CardTitle>
            <CardDescription>
              Use your passkey or biometrics to complete sign in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            
            {isLoading ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Waiting for passkey...</p>
              </div>
            ) : (
              <Button
                onClick={handleWebAuthnVerify}
                className="w-full"
                size="lg"
                data-testid="button-verify-passkey"
              >
                <Fingerprint className="h-5 w-5 mr-2" />
                Authenticate with Passkey
              </Button>
            )}
            
            <Button
              type="button"
              variant="ghost"
              onClick={logout}
              className="w-full"
              data-testid="button-cancel-2fa"
            >
              Cancel and Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Email code verification UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {user?.email || "your email"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              disabled={isLoading}
              data-testid="input-2fa-code"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {isLoading && (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="w-full"
              data-testid="button-resend-code"
            >
              {resendCooldown > 0 
                ? `Resend code in ${resendCooldown}s`
                : "Resend Code"
              }
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={logout}
              className="w-full"
              data-testid="button-cancel-2fa"
            >
              Cancel and Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { isLoading, isAuthenticated, require2FA, needs2FASetup, refetch } = useAuthContext();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [show2FASetup, setShow2FASetup] = useState(false);

  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch("/api/auth/needs-setup");
        const data = await res.json();
        setNeedsSetup(data.needsSetup);
      } catch (error) {
        console.error("Failed to check setup status:", error);
        setNeedsSetup(false);
      } finally {
        setCheckingSetup(false);
      }
    }
    checkSetup();
  }, []);

  // When needs2FASetup changes to true, show the setup page
  useEffect(() => {
    if (needs2FASetup) {
      setShow2FASetup(true);
    }
  }, [needs2FASetup]);

  if (isLoading || checkingSetup) {
    return <LoadingScreen />;
  }

  if (needsSetup) {
    return <InitialSetupPage onComplete={() => {
      setNeedsSetup(false);
      // After initial setup, refresh to get user state and show 2FA setup
      refetch();
    }} />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Show 2FA setup if user hasn't configured it yet
  if (show2FASetup || needs2FASetup) {
    return <TwoFactorSetupPage onComplete={() => {
      setShow2FASetup(false);
      refetch();
    }} />;
  }

  if (require2FA) {
    return <TwoFactorPage />;
  }

  return (
    <DataProvider>
      <DateRangeProvider>
        <Router />
      </DateRangeProvider>
    </DataProvider>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" attribute="class">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AuthenticatedApp />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
