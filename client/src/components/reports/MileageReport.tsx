import { useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Download, FileSpreadsheet, FileText, Car, Info, TrendingUp, Map, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";

interface MileageTrip {
  id: string;
  date: string;
  description: string;
  miles: string;
  transactionId: string | null;
  createdAt: string;
}

interface MileageSummary {
  taxYear: string;
  totalMiles: number;
  allowance: number;
  tripCount: number;
  trips: MileageTrip[];
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
}

interface MileageReportProps {
  yearLabel: string;
}

export function MileageReport({ yearLabel }: MileageReportProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: mileageSummary, isLoading } = useQuery<MileageSummary>({
    queryKey: ["/api/mileage-summary", yearLabel],
    queryFn: async () => {
      const res = await fetch(`/api/mileage-summary?taxYear=${yearLabel}`);
      if (!res.ok) throw new Error("Failed to fetch mileage summary");
      return res.json();
    },
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    queryFn: async () => {
      const res = await fetch("/api/transactions");
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
  });

  const tripsWithRunningTotal = useMemo(() => {
    if (!mileageSummary?.trips) return [];
    
    const sortedTrips = [...mileageSummary.trips].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    let runningTotal = 0;
    return sortedTrips.map(trip => {
      const miles = parseFloat(trip.miles);
      runningTotal += miles;
      
      const linkedTransaction = trip.transactionId 
        ? transactions.find(t => t.id === trip.transactionId)
        : null;
      
      let allowanceForTrip = 0;
      const prevTotal = runningTotal - miles;
      if (prevTotal < 10000) {
        const milesAt45p = Math.min(miles, 10000 - prevTotal);
        const milesAt25p = miles - milesAt45p;
        allowanceForTrip = (milesAt45p * 0.45) + (milesAt25p * 0.25);
      } else {
        allowanceForTrip = miles * 0.25;
      }
      
      return {
        ...trip,
        miles,
        runningTotal,
        allowanceForTrip,
        linkedTransaction,
      };
    });
  }, [mileageSummary?.trips, transactions]);

  const milesAt45pRate = useMemo(() => {
    if (!mileageSummary) return 0;
    return Math.min(mileageSummary.totalMiles, 10000);
  }, [mileageSummary]);

  const milesAt25pRate = useMemo(() => {
    if (!mileageSummary) return 0;
    return Math.max(0, mileageSummary.totalMiles - 10000);
  }, [mileageSummary]);

  const allowanceAt45p = milesAt45pRate * 0.45;
  const allowanceAt25p = milesAt25pRate * 0.25;

  const exportToCSV = () => {
    if (!tripsWithRunningTotal.length) return;
    
    const headers = ["Date", "Description", "Miles", "Running Total", "Allowance Earned", "Linked Transaction"];
    const rows = tripsWithRunningTotal.map(trip => [
      format(parseISO(trip.date), "dd/MM/yyyy"),
      trip.description,
      trip.miles.toFixed(1),
      trip.runningTotal.toFixed(1),
      `£${trip.allowanceForTrip.toFixed(2)}`,
      trip.linkedTransaction?.description || ""
    ]);
    
    const summaryRows = [
      [],
      ["SUMMARY"],
      ["Total Miles", mileageSummary?.totalMiles?.toFixed(1) || "0"],
      ["Miles at 45p rate", milesAt45pRate.toFixed(1)],
      ["Miles at 25p rate", milesAt25pRate.toFixed(1)],
      ["Allowance at 45p", `£${allowanceAt45p.toFixed(2)}`],
      ["Allowance at 25p", `£${allowanceAt25p.toFixed(2)}`],
      ["Total Allowance", `£${mileageSummary?.allowance?.toFixed(2) || "0.00"}`],
    ];
    
    const csvContent = [headers, ...rows, ...summaryRows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mileage-report-${yearLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    if (!tripsWithRunningTotal.length) return;
    
    const tripData = tripsWithRunningTotal.map(trip => ({
      Date: format(parseISO(trip.date), "dd/MM/yyyy"),
      Description: trip.description,
      Miles: trip.miles,
      "Running Total": trip.runningTotal,
      "Allowance Earned": trip.allowanceForTrip,
      "Linked Transaction": trip.linkedTransaction?.description || ""
    }));
    
    const summaryData = [
      { Metric: "Total Miles", Value: mileageSummary?.totalMiles || 0 },
      { Metric: "Miles at 45p rate", Value: milesAt45pRate },
      { Metric: "Miles at 25p rate", Value: milesAt25pRate },
      { Metric: "Allowance at 45p", Value: allowanceAt45p },
      { Metric: "Allowance at 25p", Value: allowanceAt25p },
      { Metric: "Total Allowance", Value: mileageSummary?.allowance || 0 },
    ];
    
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(tripData);
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    
    XLSX.utils.book_append_sheet(wb, ws1, "Trip Log");
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");
    
    XLSX.writeFile(wb, `mileage-report-${yearLabel}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Loading mileage data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" ref={cardRef}>
      {/* HMRC Rate Reference */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Info className="h-5 w-5" />
            HMRC Approved Mileage Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <Car className="h-8 w-8 text-blue-600" />
              <div>
                <div className="font-bold text-lg">45p per mile</div>
                <div className="text-sm text-muted-foreground">First 10,000 miles</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Car className="h-8 w-8 text-blue-400" />
              <div>
                <div className="font-bold text-lg">25p per mile</div>
                <div className="text-sm text-muted-foreground">Over 10,000 miles</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-blue-500" />
              <div>
                <div className="font-bold text-lg">Tax Year {yearLabel}</div>
                <div className="text-sm text-muted-foreground">6 April - 5 April</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Map className="h-4 w-4 text-muted-foreground" />
              Total Miles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mileageSummary?.totalMiles?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">{mileageSummary?.tripCount || 0} trips recorded</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Miles @ 45p</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{milesAt45pRate.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">= £{allowanceAt45p.toFixed(2)}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Miles @ 25p</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{milesAt25pRate.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">= £{allowanceAt25p.toFixed(2)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Total Allowance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">£{mileageSummary?.allowance?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Claimable amount</p>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={exportToCSV} data-testid="button-export-mileage-csv">
          <FileText className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={exportToExcel} data-testid="button-export-mileage-excel">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* Trip Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trip Log</CardTitle>
          <CardDescription>Detailed record of all business mileage for tax year {yearLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          {tripsWithRunningTotal.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Miles</TableHead>
                    <TableHead className="text-right">Running Total</TableHead>
                    <TableHead className="text-right">Allowance</TableHead>
                    <TableHead>Linked Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tripsWithRunningTotal.map((trip, index) => (
                    <TableRow key={trip.id} data-testid={`row-mileage-trip-${index}`}>
                      <TableCell className="font-medium">
                        {format(parseISO(trip.date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>{trip.description}</TableCell>
                      <TableCell className="text-right">{trip.miles.toFixed(1)}</TableCell>
                      <TableCell className="text-right">
                        <span className={trip.runningTotal > 10000 ? "text-amber-600 font-medium" : ""}>
                          {trip.runningTotal.toFixed(1)}
                        </span>
                        {trip.runningTotal > 10000 && index > 0 && tripsWithRunningTotal[index - 1].runningTotal <= 10000 && (
                          <span className="ml-1 text-xs text-amber-600">(25p rate)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        £{trip.allowanceForTrip.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {trip.linkedTransaction ? (
                          <span title={`£${Math.abs(trip.linkedTransaction.amount).toFixed(2)}`}>
                            {trip.linkedTransaction.description}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No mileage trips recorded</p>
              <p className="text-sm mt-1">
                To record mileage, categorize a transaction as "Covered by Mileage Allowance" and enter the miles driven.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allowance Summary */}
      {mileageSummary && mileageSummary.totalMiles > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Allowance Calculation</CardTitle>
            <CardDescription>Breakdown of your mileage allowance claim</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">First 10,000 miles @ 45p</span>
                <span>{milesAt45pRate.toLocaleString()} miles = <span className="font-medium">£{allowanceAt45p.toFixed(2)}</span></span>
              </div>
              {milesAt25pRate > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Additional miles @ 25p</span>
                  <span>{milesAt25pRate.toLocaleString()} miles = <span className="font-medium">£{allowanceAt25p.toFixed(2)}</span></span>
                </div>
              )}
              <div className="flex justify-between py-3 font-bold text-lg border-t-2">
                <span>Total Mileage Allowance</span>
                <span className="text-green-600">£{mileageSummary.allowance.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
