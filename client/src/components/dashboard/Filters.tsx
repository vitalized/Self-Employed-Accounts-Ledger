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
import { Search, Download, RefreshCw } from "lucide-react";

interface FiltersProps {
  filterState: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onRefresh: () => void;
  onExport: () => void;
}

export function Filters({ filterState, onFilterChange, onRefresh, onExport }: FiltersProps) {
  return (
    <div className="mb-6 flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative w-full max-w-sm">
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
          <SelectTrigger className="w-[180px]">
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

        <Select 
          value={filterState.type || "All"} 
          onValueChange={(value) => onFilterChange({ type: value === 'All' ? undefined : value as any })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">Type: All</SelectItem>
            <SelectItem value="Business">Business</SelectItem>
            <SelectItem value="Personal">Personal</SelectItem>
            <SelectItem value="Unreviewed">Unreviewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
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
