import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Building2, CalendarIcon, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Business {
  id: string;
  name: string;
  tradingName: string | null;
  registeredAddress: string | null;
  startDate: string | null;
  periodStartMonth: number | null;
  periodStartDay: number | null;
  preferredBank: string | null;
  utr: string | null;
  createdAt: string;
}

export default function BusinessSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    tradingName: "",
    registeredAddress: "",
    startDate: null as Date | null,
    periodStartMonth: "",
    periodStartDay: "",
    preferredBank: "",
    utr: "",
  });

  const { data: business, isLoading } = useQuery<Business | null>({
    queryKey: ["/api/business"],
    queryFn: async () => {
      const res = await fetch("/api/business");
      if (!res.ok) throw new Error("Failed to fetch business");
      return res.json();
    },
  });

  useEffect(() => {
    if (business) {
      setFormData({
        name: business.name || "",
        tradingName: business.tradingName || "",
        registeredAddress: business.registeredAddress || "",
        startDate: business.startDate ? new Date(business.startDate) : null,
        periodStartMonth: business.periodStartMonth?.toString() || "",
        periodStartDay: business.periodStartDay?.toString() || "",
        preferredBank: business.preferredBank || "",
        utr: business.utr || "",
      });
    }
  }, [business]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          tradingName: data.tradingName || null,
          registeredAddress: data.registeredAddress || null,
          startDate: data.startDate?.toISOString() || null,
          periodStartMonth: data.periodStartMonth ? parseInt(data.periodStartMonth) : null,
          periodStartDay: data.periodStartDay ? parseInt(data.periodStartDay) : null,
          preferredBank: data.preferredBank || null,
          utr: data.utr || null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save business details");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business"] });
      toast({
        title: "Business Details Saved",
        description: "Your business information has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Business name is required.",
        variant: "destructive",
      });
      return;
    }
    if (formData.utr && !/^\d{10}$/.test(formData.utr)) {
      toast({
        title: "Validation Error",
        description: "UTR must be exactly 10 digits.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(formData);
  };

  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const days = Array.from({ length: 31 }, (_, i) => ({
    value: (i + 1).toString(),
    label: (i + 1).toString(),
  }));

  const banks = [
    { value: "Starling", label: "Starling" },
    { value: "Monzo", label: "Monzo" },
    { value: "HSBC", label: "HSBC" },
    { value: "Other", label: "Other" },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <CardTitle>Business Details</CardTitle>
        </div>
        <CardDescription>
          Configure your sole trader business information for tax reporting and invoicing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name *</Label>
              <Input
                id="name"
                placeholder="Your Business Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-business-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradingName">Trading Name</Label>
              <Input
                id="tradingName"
                placeholder="Trading As (optional)"
                value={formData.tradingName}
                onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                data-testid="input-trading-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="registeredAddress">Registered Address</Label>
            <Textarea
              id="registeredAddress"
              placeholder="Enter your registered business address"
              value={formData.registeredAddress}
              onChange={(e) => setFormData({ ...formData, registeredAddress: e.target.value })}
              rows={3}
              data-testid="textarea-registered-address"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Business Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.startDate && "text-muted-foreground"
                    )}
                    data-testid="button-start-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.startDate ? format(formData.startDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.startDate || undefined}
                    onSelect={(date) => setFormData({ ...formData, startDate: date || null })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredBank">Preferred Bank</Label>
              <Select
                value={formData.preferredBank}
                onValueChange={(value) => setFormData({ ...formData, preferredBank: value })}
              >
                <SelectTrigger data-testid="select-preferred-bank">
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.value} value={bank.value}>
                      {bank.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tax Year Start</Label>
            <p className="text-sm text-muted-foreground">
              Set the start of your accounting period. UK tax year typically starts April 6th.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={formData.periodStartMonth}
                onValueChange={(value) => setFormData({ ...formData, periodStartMonth: value })}
              >
                <SelectTrigger data-testid="select-period-month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={formData.periodStartDay}
                onValueChange={(value) => setFormData({ ...formData, periodStartDay: value })}
              >
                <SelectTrigger data-testid="select-period-day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="utr">Unique Tax Reference (UTR)</Label>
            <Input
              id="utr"
              placeholder="10-digit UTR number"
              value={formData.utr}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                setFormData({ ...formData, utr: value });
              }}
              maxLength={10}
              data-testid="input-utr"
            />
            <p className="text-sm text-muted-foreground">
              Your 10-digit Unique Taxpayer Reference from HMRC.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-business">
              <Save className="mr-2 h-4 w-4" />
              {mutation.isPending ? "Saving..." : "Save Business Details"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
