import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateFilter, FilterState } from "@/lib/types";
import { Search, Download, RefreshCw, CalendarIcon, X, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SA103_EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@shared/categories";
import { useQuery } from "@tanstack/react-query";

interface FiltersProps {
  filterState: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onRefresh: () => void;
  onExport: () => void;
  availableCategories: string[];
  isSyncing?: boolean;
}

export function Filters({ filterState, onFilterChange, onRefresh, onExport, availableCategories, isSyncing = false }: FiltersProps) {
  const { data: taxYears = [] } = useQuery<string[]>({
    queryKey: ["/api/tax-years"],
    queryFn: async () => {
      const res = await fetch("/api/tax-years");
      if (!res.ok) throw new Error("Failed to fetch tax years");
      return res.json();
    },
  });

  return (
    <div className="mb-6 flex flex-col space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filterState.type === 'Unreviewed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange({ type: filterState.type === 'Unreviewed' ? undefined : 'Unreviewed' })}
          className={cn(
            filterState.type === 'Unreviewed' 
              ? "bg-amber-500 hover:bg-amber-600 text-white" 
              : "border-amber-300 text-amber-700 hover:bg-amber-50"
          )}
          data-testid="button-needs-review"
        >
          <AlertCircle className="mr-1 h-4 w-4" />
          Needs Review
        </Button>
        
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search transactions..."
            className="pl-9"
            value={filterState.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
          />
        </div>
        
        <Select 
          value={filterState.dateRange} 
          onValueChange={(value) => onFilterChange({ dateRange: value as DateFilter })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            <SelectGroup>
              <SelectLabel>Quick Filters</SelectLabel>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="custom">Custom Date</SelectItem>
            </SelectGroup>
            {taxYears.map((taxYear, index) => (
              <SelectGroup key={taxYear}>
                <SelectLabel>Tax Year {taxYear}</SelectLabel>
                <SelectItem value={`tax-year-${taxYear}`}>Full Year (6 Apr - 5 Apr)</SelectItem>
                {index === 0 && (
                  <>
                    <SelectItem value={`mtd-q1-${taxYear}`}>MTD Q1 (6 Apr - 5 Jul)</SelectItem>
                    <SelectItem value={`mtd-q2-${taxYear}`}>MTD Q2 (6 Apr - 5 Oct)</SelectItem>
                    <SelectItem value={`mtd-q3-${taxYear}`}>MTD Q3 (6 Apr - 5 Jan)</SelectItem>
                    <SelectItem value={`mtd-q4-${taxYear}`}>MTD Q4 (6 Apr - 5 Apr)</SelectItem>
                  </>
                )}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {filterState.dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !filterState.customStartDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterState.customStartDate ? format(filterState.customStartDate, "dd/MM/yyyy") : <span>Start date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterState.customStartDate}
                  onSelect={(date) => onFilterChange({ customStartDate: date })}
                  defaultMonth={filterState.customStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground">-</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !filterState.customEndDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterState.customEndDate ? format(filterState.customEndDate, "dd/MM/yyyy") : <span>End date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterState.customEndDate}
                  onSelect={(date) => onFilterChange({ customEndDate: date })}
                  defaultMonth={filterState.customEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <Select 
          value={filterState.type || "All"} 
          onValueChange={(value) => onFilterChange({ type: value === 'All' ? undefined : value as any })}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Types</SelectItem>
            <SelectItem value="Business" className="font-medium">Business</SelectItem>
            <SelectItem value="Business Income" className="pl-6 text-muted-foreground">↳ Income</SelectItem>
            <SelectItem value="Business Expense" className="pl-6 text-muted-foreground">↳ Spending</SelectItem>
            <SelectItem value="Personal">Personal</SelectItem>
            <SelectItem value="Unreviewed">Unreviewed</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={filterState.category || "All"} 
          onValueChange={(value) => onFilterChange({ category: value === 'All' ? undefined : value })}
        >
          <SelectTrigger className="w-[180px]" data-testid="filter-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-y-auto">
            <SelectItem value="All">All Categories</SelectItem>
            <SelectGroup>
              <SelectLabel className="text-emerald-600">Income</SelectLabel>
              {INCOME_CATEGORIES.map(cat => (
                <SelectItem key={cat.code} value={cat.label}>{cat.label}</SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-red-600">Expenses (SA103)</SelectLabel>
              {SA103_EXPENSE_CATEGORIES.map(cat => (
                <SelectItem key={cat.code} value={cat.label}>{cat.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(filterState.search || filterState.type || filterState.category || filterState.dateRange !== 'this-month') && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onFilterChange({ 
              search: '', 
              type: undefined, 
              category: undefined, 
              dateRange: 'this-month',
              customStartDate: undefined,
              customEndDate: undefined
            })}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-clear-filters"
          >
            <X className="mr-1 h-4 w-4" />
            Clear Filters
          </Button>
        )}
        <Button variant="outline" onClick={onRefresh} disabled={isSyncing}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing..." : "Sync Bank"}
        </Button>
        <Button onClick={onExport} className="bg-emerald-600 hover:bg-emerald-700">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </div>
  );
}
