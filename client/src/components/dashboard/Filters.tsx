import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateFilter, FilterState } from "@/lib/types";
import { Search, Download, RefreshCw, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface FiltersProps {
  filterState: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onRefresh: () => void;
  onExport: () => void;
  availableCategories: string[];
}

export function Filters({ filterState, onFilterChange, onRefresh, onExport, availableCategories }: FiltersProps) {
  return (
    <div className="mb-6 flex flex-col space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-month">This Month</SelectItem>
            <SelectItem value="last-month">Last Month</SelectItem>
            <SelectItem value="last-3-months">Last 3 Months</SelectItem>
            <SelectItem value="tax-year-current">Tax Year 2025-26</SelectItem>
            <SelectItem value="tax-year-previous">Tax Year 2024-25</SelectItem>
            <SelectItem value="custom">Custom Date</SelectItem>
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
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            {availableCategories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Bank
        </Button>
        <Button onClick={onExport} className="bg-emerald-600 hover:bg-emerald-700">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </div>
  );
}
