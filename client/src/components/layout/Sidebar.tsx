import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Receipt, 
  PieChart, 
  Settings, 
  LogOut, 
  Briefcase,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  TrendingUp,
  Wallet,
  Calculator,
  ReceiptText,
  ListFilter,
  Building,
  Sliders,
  Car,
  Calendar,
  Home,
  Clock,
  PiggyBank
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const reportSubItems = [
  { href: "/reports/sa103f", label: "SA103F Summary", icon: FileText },
  { href: "/reports/profit-loss", label: "Profit & Loss", icon: TrendingUp },
  { href: "/reports/expenses", label: "Expense Breakdown", icon: Wallet },
  { href: "/reports/tax-calculator", label: "Tax Calculator", icon: Calculator },
  { href: "/reports/vat", label: "VAT Threshold Tracker", icon: ReceiptText },
  { href: "/reports/mileage", label: "Mileage Report", icon: Car },
  { href: "/reports/mtd-quarterly", label: "MTD Quarterly", icon: Calendar },
  { href: "/reports/use-of-home", label: "Use of Home", icon: Home },
  { href: "/reports/payment-on-account", label: "Payment on Account", icon: Clock },
  { href: "/reports/payment-planner", label: "Tax Payment Planner", icon: PiggyBank },
];

const settingsSubItems = [
  { href: "/settings/rules", label: "Rules", icon: ListFilter },
  { href: "/settings/integrations", label: "Integrations", icon: Building },
  { href: "/settings/preferences", label: "Preferences", icon: Sliders },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [reportsExpanded, setReportsExpanded] = useState(() => location.startsWith('/reports'));
  const [settingsExpanded, setSettingsExpanded] = useState(() => location.startsWith('/settings'));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (location.startsWith('/reports')) {
      setReportsExpanded(true);
    }
    if (location.startsWith('/settings')) {
      setSettingsExpanded(true);
    }
  }, [location]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const mainLinks = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transactions", label: "Transactions", icon: Receipt },
  ];

  const isReportsActive = location.startsWith('/reports');
  const isSettingsActive = location.startsWith('/settings');

  return (
    <div className={cn(
      "flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-16 items-center border-b border-sidebar-border px-3 justify-between">
        <div className={cn("flex items-center", collapsed && "justify-center w-full")}>
          <Briefcase className={cn("h-6 w-6 text-primary", !collapsed && "mr-2")} />
          {!collapsed && <span className="text-lg font-bold">TaxTrack</span>}
        </div>
        {!collapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
            data-testid="button-collapse-sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        )}
      </div>
      
      {collapsed && (
        <button
          onClick={onToggle}
          className="flex justify-center p-3 hover:bg-sidebar-accent transition-colors"
          data-testid="button-expand-sidebar"
          title="Expand sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      )}
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className={cn("space-y-1", collapsed ? "px-2" : "px-3")}>
          {mainLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2" : "px-3",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid={`nav-${link.label.toLowerCase()}`}
                title={collapsed ? link.label : undefined}
              >
                <Icon className={cn("h-5 w-5", !collapsed && "mr-3")} />
                {!collapsed && link.label}
              </Link>
            );
          })}

          {collapsed ? (
            <Link 
              href="/reports/sa103f"
              className={cn(
                "flex items-center rounded-md py-2 text-sm font-medium transition-colors justify-center px-2",
                isReportsActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              data-testid="nav-reports"
              title="Reports"
            >
              <PieChart className="h-5 w-5" />
            </Link>
          ) : (
            <div>
              <button
                onClick={() => setReportsExpanded(!reportsExpanded)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md py-2 px-3 text-sm font-medium transition-colors",
                  isReportsActive 
                    ? "bg-sidebar-primary/50 text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid="nav-reports-toggle"
              >
                <div className="flex items-center">
                  <PieChart className="h-5 w-5 mr-3" />
                  Reports
                </div>
                {reportsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              
              {reportsExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                  {reportSubItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center rounded-md py-1.5 px-2 text-sm transition-colors",
                          isActive 
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" 
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {collapsed ? (
            <Link 
              href="/settings/rules"
              className={cn(
                "flex items-center rounded-md py-2 text-sm font-medium transition-colors justify-center px-2",
                isSettingsActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              data-testid="nav-settings"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </Link>
          ) : (
            <div>
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md py-2 px-3 text-sm font-medium transition-colors",
                  isSettingsActive 
                    ? "bg-sidebar-primary/50 text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid="nav-settings-toggle"
              >
                <div className="flex items-center">
                  <Settings className="h-5 w-5 mr-3" />
                  Settings
                </div>
                {settingsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              
              {settingsExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                  {settingsSubItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center rounded-md py-1.5 px-2 text-sm transition-colors",
                          isActive 
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" 
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      <div className={cn("border-t border-sidebar-border space-y-1", collapsed ? "p-2" : "p-4")}>
        <button 
          onClick={toggleTheme}
          className={cn(
            "flex w-full items-center rounded-md py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
            collapsed ? "justify-center px-2" : "px-3"
          )}
          data-testid="button-theme-toggle"
          title={collapsed ? (mounted && theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
        >
          {mounted && theme === "dark" ? (
            <Sun className={cn("h-5 w-5", !collapsed && "mr-3")} />
          ) : (
            <Moon className={cn("h-5 w-5", !collapsed && "mr-3")} />
          )}
          {!collapsed && (mounted && theme === "dark" ? "Light Mode" : "Dark Mode")}
        </button>
        <button 
          className={cn(
            "flex w-full items-center rounded-md py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
            collapsed ? "justify-center px-2" : "px-3"
          )}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className={cn("h-5 w-5", !collapsed && "mr-3")} />
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </div>
  );
}
