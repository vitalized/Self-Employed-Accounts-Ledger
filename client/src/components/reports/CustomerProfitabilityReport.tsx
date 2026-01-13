import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Transaction, isIncludedInProfit } from "@/lib/types";
import { ArrowUpDown, Search } from "lucide-react";
import { parseISO, format } from "date-fns";

interface CustomerProfitabilityReportProps {
  transactions: Transaction[];
  yearLabel: string;
}

type SortField = "clientName" | "totalRevenue" | "transactionCount" | "percentage" | "firstDate" | "latestDate";
type SortDirection = "asc" | "desc";

interface ClientData {
  clientName: string;
  totalRevenue: number;
  transactionCount: number;
  percentage: number;
  firstDate: string;
  latestDate: string;
}

export function CustomerProfitabilityReport({ transactions, yearLabel }: CustomerProfitabilityReportProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalRevenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { totalRevenue, clientCount, avgRevenuePerClient, clientData } = useMemo(() => {
    let total = 0;
    const clients: Record<string, { revenue: number; count: number; dates: string[] }> = {};

    transactions.forEach(t => {
      if (t.type === 'Business' && t.businessType === 'Income' && isIncludedInProfit(t)) {
        const amount = Math.abs(Number(t.amount));
        total += amount;
        
        const clientName = t.description || t.merchant || 'Unknown Client';
        
        if (!clients[clientName]) {
          clients[clientName] = { revenue: 0, count: 0, dates: [] };
        }
        clients[clientName].revenue += amount;
        clients[clientName].count += 1;
        clients[clientName].dates.push(t.date);
      }
    });

    const data: ClientData[] = Object.entries(clients).map(([name, info]) => {
      const sortedDates = info.dates.sort();
      return {
        clientName: name,
        totalRevenue: info.revenue,
        transactionCount: info.count,
        percentage: total > 0 ? (info.revenue / total) * 100 : 0,
        firstDate: sortedDates[0] || '',
        latestDate: sortedDates[sortedDates.length - 1] || '',
      };
    });

    return {
      totalRevenue: total,
      clientCount: Object.keys(clients).length,
      avgRevenuePerClient: Object.keys(clients).length > 0 ? total / Object.keys(clients).length : 0,
      clientData: data,
    };
  }, [transactions]);

  const filteredAndSortedData = useMemo(() => {
    let filtered = clientData;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = clientData.filter(client => 
        client.clientName.toLowerCase().includes(query)
      );
    }
    
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "clientName":
          comparison = a.clientName.localeCompare(b.clientName);
          break;
        case "totalRevenue":
          comparison = a.totalRevenue - b.totalRevenue;
          break;
        case "transactionCount":
          comparison = a.transactionCount - b.transactionCount;
          break;
        case "percentage":
          comparison = a.percentage - b.percentage;
          break;
        case "firstDate":
          comparison = a.firstDate.localeCompare(b.firstDate);
          break;
        case "latestDate":
          comparison = a.latestDate.localeCompare(b.latestDate);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [clientData, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
      data-testid={`header-${field}`}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  return (
    <div className="p-6 space-y-6" data-testid="customer-profitability-report">
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-total-revenue">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="value-total-revenue">
              £{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-number-of-clients">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Number of Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="value-number-of-clients">
              {clientCount}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-revenue">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Revenue Per Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="value-avg-revenue">
              £{avgRevenuePerClient.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-client-table">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Revenue by Client</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-clients"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAndSortedData.length > 0 ? (
            <Table data-testid="table-clients">
              <TableHeader>
                <TableRow>
                  <SortableHeader field="clientName">Client Name</SortableHeader>
                  <SortableHeader field="totalRevenue">Total Revenue</SortableHeader>
                  <SortableHeader field="transactionCount">Transactions</SortableHeader>
                  <SortableHeader field="percentage">% of Total</SortableHeader>
                  <SortableHeader field="firstDate">First Transaction</SortableHeader>
                  <SortableHeader field="latestDate">Latest Transaction</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedData.map((client, index) => (
                  <TableRow key={client.clientName} data-testid={`row-client-${index}`}>
                    <TableCell className="font-medium" data-testid={`cell-client-name-${index}`}>
                      {client.clientName}
                    </TableCell>
                    <TableCell className="text-green-600 font-semibold" data-testid={`cell-revenue-${index}`}>
                      £{client.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell data-testid={`cell-count-${index}`}>
                      {client.transactionCount}
                    </TableCell>
                    <TableCell data-testid={`cell-percentage-${index}`}>
                      {client.percentage.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`cell-first-date-${index}`}>
                      {formatDate(client.firstDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`cell-latest-date-${index}`}>
                      {formatDate(client.latestDate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground" data-testid="empty-state">
              {searchQuery ? 'No clients match your search' : 'No income transactions found for this period'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
