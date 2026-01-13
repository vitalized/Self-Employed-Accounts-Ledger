import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateFilter, FilterState } from "@/lib/types";
import { useDateRange } from "@/lib/dateRangeContext";
import { Search, CalendarIcon, X, AlertCircle, Plus, FileSpreadsheet, FileText, FileDown, RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SA103_EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@shared/categories";
import { useQuery } from "@tanstack/react-query";

type ExportType = 'csv' | 'excel' | 'pdf';

interface FiltersProps {
  filterState: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onRefresh: () => void;
  onExport: (type: ExportType) => void;
  onAddJournalEntry?: () => void;
  availableCategories: string[];
  isSyncing?: boolean;
  unreviewedCount?: number;
}

export function Filters({ filterState, onFilterChange, onRefresh, onExport, onAddJournalEntry, availableCategories, isSyncing = false, unreviewedCount = 0 }: FiltersProps) {
  const { 
    dateRange, 
    setDateRange, 
    customStartDate, 
    setCustomStartDate, 
    customEndDate, 
    setCustomEndDate 
  } = useDateRange();

  const { data: taxYears = [] } = useQuery<string[]>({
    queryKey: ["/api/tax-years"],
    queryFn: async () => {
      const res = await fetch("/api/tax-years");
      if (!res.ok) throw new Error("Failed to fetch tax years");
      return res.json();
    },
  });

  const handleDateRangeChange = (value: DateFilter) => {
    setDateRange(value);
    onFilterChange({ dateRange: value });
  };

  const handleCustomStartDateChange = (date: Date | undefined) => {
    setCustomStartDate(date);
    onFilterChange({ customStartDate: date });
  };

  const handleCustomEndDateChange = (date: Date | undefined) => {
    setCustomEndDate(date);
    onFilterChange({ customEndDate: date });
  };

  const hasActiveFilters = filterState.search || filterState.type || filterState.category;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Left side: Filter controls grouped */}
        <div className="inline-flex items-center rounded-md border border-input overflow-hidden">
          <Select 
            value={filterState.type || "All"} 
            onValueChange={(value) => onFilterChange({ type: value === 'All' ? undefined : value as any })}
          >
            <SelectTrigger className="w-[120px] h-9 text-sm rounded-none border-0 border-r border-input focus:z-10 focus:ring-1 focus:ring-ring focus:ring-offset-0" data-testid="filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Types</SelectItem>
              <SelectItem value="Business" className="font-medium">Business</SelectItem>
              <SelectItem value="Business Income" className="pl-6 text-muted-foreground">↳ Income</SelectItem>
              <SelectItem value="Business Expense" className="pl-6 text-muted-foreground">↳ Spending</SelectItem>
              <SelectItem value="Personal">Personal</SelectItem>
              <SelectItem value="Journal">Journal Entries</SelectItem>
              <SelectItem value="Unreviewed">Unreviewed</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={filterState.category || "All"} 
            onValueChange={(value) => onFilterChange({ category: value === 'All' ? undefined : value })}
          >
            <SelectTrigger className="w-[160px] h-9 text-sm rounded-none border-0 border-r border-input focus:z-10 focus:ring-1 focus:ring-ring focus:ring-offset-0" data-testid="filter-category">
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

          <Button
            variant={filterState.type === 'Unreviewed' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onFilterChange({ type: filterState.type === 'Unreviewed' ? undefined : 'Unreviewed' })}
            className={cn(
              "h-9 rounded-none border-0",
              filterState.type === 'Unreviewed'
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
            )}
            data-testid="button-needs-review"
          >
            <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
            Needs Review
            {unreviewedCount > 0 && (
              <span className={cn(
                "ml-1.5 px-1.5 py-0.5 text-xs rounded-full min-w-[20px] text-center",
                filterState.type === 'Unreviewed'
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-700"
              )}>
                {unreviewedCount}
              </span>
            )}
          </Button>
        </div>

        {hasActiveFilters && (
          <>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateRange('this-month');
                setCustomStartDate(undefined);
                setCustomEndDate(undefined);
                onFilterChange({
                  search: '',
                  type: undefined,
                  category: undefined,
                  dateRange: 'this-month',
                  customStartDate: undefined,
                  customEndDate: undefined
                });
              }}
              className="h-9 text-muted-foreground hover:text-foreground px-2"
              data-testid="button-clear-filters"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          </>
        )}

        {/* Right side: Action buttons grouped + Date selector */}
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-input overflow-hidden h-9">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isSyncing}
              className="h-9 px-3 text-sm rounded-none border-0 border-r border-input"
              data-testid="button-sync-bank"
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isSyncing && "animate-spin")} />
              {isSyncing ? "Syncing..." : "Sync Bank"}
            </Button>
            {onAddJournalEntry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddJournalEntry}
                className="h-9 px-3 text-sm rounded-none border-0 border-r border-input bg-primary/10 text-primary hover:bg-primary/20"
                data-testid="button-add-journal"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Journal Entry
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExport('excel')}
              className="h-9 px-3 text-sm rounded-none border-0 border-r border-input"
              data-testid="button-export-excel"
            >
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
              Excel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExport('csv')}
              className="h-9 px-3 text-sm rounded-none border-0 border-r border-input"
              data-testid="button-export-csv"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onExport('pdf')}
              className="h-9 px-3 text-sm rounded-none border-0"
              data-testid="button-export-pdf"
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              PDF
            </Button>
          </div>

          {/* Custom date pickers when custom is selected */}
          {dateRange === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[100px] h-9 justify-start text-left font-normal text-sm",
                      !customStartDate && "text-muted-foreground"
                    )}
                  >
                    {customStartDate ? format(customStartDate, "dd/MM/yy") : "Start"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={handleCustomStartDateChange}
                    defaultMonth={customStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-sm">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[100px] h-9 justify-start text-left font-normal text-sm",
                      !customEndDate && "text-muted-foreground"
                    )}
                  >
                    {customEndDate ? format(customEndDate, "dd/MM/yy") : "End"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={handleCustomEndDateChange}
                    defaultMonth={customEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </>
          )}

          {/* Date selector on the far right */}
          <Select 
            value={dateRange} 
            onValueChange={handleDateRangeChange}
          >
            <SelectTrigger className="w-[160px] sm:w-[180px] h-9" data-testid="select-date-range">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
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
              {taxYears.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Tax Year {taxYears[0]}</SelectLabel>
                    <SelectItem value={`tax-year-${taxYears[0]}`}>Current Tax Year (6 Apr - 5 Apr)</SelectItem>
                    <SelectItem value={`mtd-q1-${taxYears[0]}`}>MTD Q1 (6 Apr - 5 Jul)</SelectItem>
                    <SelectItem value={`mtd-q2-${taxYears[0]}`}>MTD Q2 (6 Apr - 5 Oct)</SelectItem>
                    <SelectItem value={`mtd-q3-${taxYears[0]}`}>MTD Q3 (6 Apr - 5 Jan)</SelectItem>
                    <SelectItem value={`mtd-q4-${taxYears[0]}`}>MTD Q4 (6 Apr - 5 Apr)</SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                </>
              )}
              {taxYears.slice(1).map((taxYear) => (
                <SelectItem key={taxYear} value={`tax-year-${taxYear}`}>Tax Year {taxYear}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search bar on separate line below */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search transactions..."
          className="pl-9 pr-8 h-9 w-full"
          value={filterState.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          data-testid="input-search"
        />
        {filterState.search && (
          <button
            type="button"
            onClick={() => onFilterChange({ search: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            data-testid="button-clear-search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
