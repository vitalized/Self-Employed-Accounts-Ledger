import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  FileText, 
  PieChart, 
  Calculator, 
  TrendingUp,
  Receipt,
  Menu,
  Star,
  StarOff
} from "lucide-react";

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category: "tax" | "financial" | "vat" | "analytics";
  icon: ReactNode;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "sa103f",
    name: "Self-Assessment (SA103F)",
    description: "HMRC self-employment tax return summary",
    category: "tax",
    icon: <FileText className="h-4 w-4" />
  },
  {
    id: "profit-loss",
    name: "Profit & Loss Statement",
    description: "Detailed income and expense breakdown",
    category: "financial",
    icon: <TrendingUp className="h-4 w-4" />
  },
  {
    id: "expense-breakdown",
    name: "Expense Breakdown",
    description: "Category-wise expense analysis",
    category: "financial",
    icon: <PieChart className="h-4 w-4" />
  },
  {
    id: "tax-calculator",
    name: "Tax Calculator",
    description: "Estimated UK income tax and NI",
    category: "tax",
    icon: <Calculator className="h-4 w-4" />
  },
  {
    id: "vat-summary",
    name: "VAT Summary",
    description: "VAT threshold tracking and reporting",
    category: "vat",
    icon: <Receipt className="h-4 w-4" />
  }
];

const CATEGORY_LABELS: Record<string, string> = {
  tax: "Tax Reports",
  financial: "Financial Reports",
  vat: "VAT Reports",
  analytics: "Analytics"
};

interface ReportsLayoutProps {
  children: ReactNode;
  selectedReport: string;
  onSelectReport: (reportId: string) => void;
  pinnedReports: string[];
  onTogglePinned: (reportId: string) => void;
}

export function ReportsLayout({ 
  children, 
  selectedReport, 
  onSelectReport,
  pinnedReports,
  onTogglePinned
}: ReportsLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredReports = REPORT_DEFINITIONS.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedReportsList = REPORT_DEFINITIONS.filter(r => pinnedReports.includes(r.id));
  
  const groupedReports = filteredReports.reduce((acc, report) => {
    if (!acc[report.category]) acc[report.category] = [];
    acc[report.category].push(report);
    return acc;
  }, {} as Record<string, ReportDefinition[]>);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {!collapsed && (
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              className="pl-8 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-reports"
            />
          </div>
        </div>
      )}
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {pinnedReportsList.length > 0 && !collapsed && (
            <div className="mb-4">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Star className="h-3 w-3" />
                Pinned
              </div>
              {pinnedReportsList.map(report => (
                <ReportItem 
                  key={report.id} 
                  report={report} 
                  selected={selectedReport === report.id}
                  collapsed={collapsed}
                  pinned={true}
                  onSelect={() => {
                    onSelectReport(report.id);
                    setMobileOpen(false);
                  }}
                  onTogglePinned={() => onTogglePinned(report.id)}
                />
              ))}
            </div>
          )}

          {Object.entries(groupedReports).map(([category, reports]) => (
            <div key={category} className="mb-4">
              {!collapsed && (
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {CATEGORY_LABELS[category]}
                </div>
              )}
              {reports.map(report => (
                <ReportItem 
                  key={report.id} 
                  report={report} 
                  selected={selectedReport === report.id}
                  collapsed={collapsed}
                  pinned={pinnedReports.includes(report.id)}
                  onSelect={() => {
                    onSelectReport(report.id);
                    setMobileOpen(false);
                  }}
                  onTogglePinned={() => onTogglePinned(report.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-2 hidden lg:block">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
          data-testid="button-toggle-sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className={cn(
        "hidden lg:flex flex-col border-r bg-muted/30 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}>
        <SidebarContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" 
            className="lg:hidden fixed bottom-4 left-4 z-50 shadow-lg"
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

interface ReportItemProps {
  report: ReportDefinition;
  selected: boolean;
  collapsed: boolean;
  pinned: boolean;
  onSelect: () => void;
  onTogglePinned: () => void;
}

function ReportItem({ report, selected, collapsed, pinned, onSelect, onTogglePinned }: ReportItemProps) {
  return (
    <div 
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors",
        selected 
          ? "bg-primary text-primary-foreground" 
          : "hover:bg-muted"
      )}
      onClick={onSelect}
      data-testid={`report-item-${report.id}`}
    >
      <div className={cn(
        "flex-shrink-0",
        selected ? "text-primary-foreground" : "text-muted-foreground"
      )}>
        {report.icon}
      </div>
      {!collapsed && (
        <>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{report.name}</div>
            <div className={cn(
              "text-xs truncate",
              selected ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {report.description}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
              pinned && "opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePinned();
            }}
            data-testid={`button-pin-${report.id}`}
          >
            {pinned ? (
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            ) : (
              <StarOff className="h-3.5 w-3.5" />
            )}
          </Button>
        </>
      )}
    </div>
  );
}
