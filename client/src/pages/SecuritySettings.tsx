import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth, useAuth } from "@/hooks/use-auth";
import { Shield, Mail, KeyRound, Plus, Trash2, CheckCircle2 } from "lucide-react";

interface PasskeyInfo {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  createdAt: string;
}

export default function SecuritySettings() {
  const { toast } = useToast();
  const { user, refetch: refetchUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);

  useEffect(() => {
    if (user?.twoFactorMethod === "webauthn") {
      fetchPasskeys();
    } else {
      setLoading(false);
    }
  }, [user?.twoFactorMethod]);

  const fetchPasskeys = async () => {
    try {
      const res = await fetchWithAuth("/api/auth/webauthn/credentials");
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data);
      }
    } catch (error) {
      console.error("Failed to fetch passkeys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2FA = async (method: "email" | "webauthn") => {
    if (method === "webauthn") {
      await handleRegisterPasskey();
    } else {
      setSaving(true);
      try {
        const res = await fetchWithAuth("/api/auth/2fa/setup", {
          method: "POST",
          body: JSON.stringify({ method }),
        });
        if (res.ok) {
          toast({ title: "2FA enabled", description: "Email verification codes will be required at login." });
          refetchUser();
        } else {
          const data = await res.json();
          toast({ title: "Failed", description: data.message || data.error, variant: "destructive" });
        }
      } catch (error) {
        toast({ title: "Error", description: "Failed to enable 2FA", variant: "destructive" });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleRegisterPasskey = async () => {
    setRegisteringPasskey(true);
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
        toast({ title: "Passkey registered", description: "You can now use this passkey to sign in." });
        refetchUser();
        fetchPasskeys();
      } else {
        const data = await verifyRes.json();
        toast({ title: "Failed", description: data.message || data.error, variant: "destructive" });
      }
    } catch (error: any) {
      if (error.name === "NotAllowedError") {
        toast({ title: "Cancelled", description: "Passkey registration was cancelled.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to register passkey", variant: "destructive" });
      }
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const handleDisable2FA = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/auth/2fa", {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "2FA disabled", description: "Two-factor authentication has been removed." });
        refetchUser();
        setPasskeys([]);
      } else {
        const data = await res.json();
        toast({ title: "Failed", description: data.message || data.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to disable 2FA", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/auth/webauthn/credentials/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "Passkey removed" });
        fetchPasskeys();
      } else {
        const data = await res.json();
        toast({ title: "Failed", description: data.message || data.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove passkey", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  const currentMethod = user?.twoFactorMethod;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <CardTitle>Two-Factor Authentication</CardTitle>
        </div>
        <CardDescription>
          Add an extra layer of security to your account by requiring a second form of verification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!currentMethod ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose how you want to verify your identity when signing in:
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSetup2FA("email")}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Mail className="h-8 w-8 text-blue-600" />
                    <div>
                      <h4 className="font-semibold">Email Verification</h4>
                      <p className="text-sm text-muted-foreground">
                        Receive a 6-digit code via email each time you sign in.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    disabled={saving}
                    onClick={(e) => { e.stopPropagation(); handleSetup2FA("email"); }}
                    data-testid="button-enable-email-2fa"
                  >
                    {saving ? "Enabling..." : "Enable Email 2FA"}
                  </Button>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSetup2FA("webauthn")}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <KeyRound className="h-8 w-8 text-green-600" />
                    <div>
                      <h4 className="font-semibold">Passkey / Touch ID</h4>
                      <p className="text-sm text-muted-foreground">
                        Use your device's biometrics or security key for quick, secure sign-in.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    disabled={registeringPasskey}
                    onClick={(e) => { e.stopPropagation(); handleSetup2FA("webauthn"); }}
                    data-testid="button-enable-passkey-2fa"
                  >
                    {registeringPasskey ? "Registering..." : "Register Passkey"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">2FA is enabled</p>
                  <p className="text-sm text-muted-foreground">
                    Method: {currentMethod === "email" ? "Email verification codes" : "Passkey / Touch ID"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisable2FA}
                disabled={saving}
                data-testid="button-disable-2fa"
              >
                {saving ? "Disabling..." : "Disable 2FA"}
              </Button>
            </div>

            {currentMethod === "webauthn" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Registered Passkeys</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegisterPasskey}
                    disabled={registeringPasskey}
                    data-testid="button-add-passkey"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Passkey
                  </Button>
                </div>
                {passkeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No passkeys registered yet.</p>
                ) : (
                  <div className="space-y-2">
                    {passkeys.map((pk) => (
                      <div key={pk.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{pk.deviceName || "Passkey"}</p>
                            <p className="text-xs text-muted-foreground">
                              Added {new Date(pk.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePasskey(pk.id)}
                          data-testid={`button-delete-passkey-${pk.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
