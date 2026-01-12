import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Receipt, 
  PieChart, 
  Settings, 
  LogOut, 
  FileCheck,
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
  PiggyBank,
  Tags,
  Wrench,
  Users,
  FileDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/lib/authContext";
import { queryClient } from "@/lib/queryClient";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const reportSubItems = [
  { href: "/reports/sa103f", label: "SA103F Summary", icon: FileText },
  { href: "/reports/profit-loss", label: "Profit & Loss", icon: TrendingUp },
  { href: "/reports/expenses", label: "Expense Breakdown", icon: Wallet },
  { href: "/reports/customer-profitability", label: "Customer Profitability", icon: Users },
];

const toolsSubItems = [
  { href: "/reports/tax-calculator", label: "Tax Calculator", icon: Calculator },
  { href: "/reports/vat", label: "VAT Threshold Tracker", icon: ReceiptText },
  { href: "/reports/mileage", label: "Mileage Report", icon: Car },
  { href: "/reports/mtd-quarterly", label: "MTD Quarterly", icon: Calendar },
  { href: "/reports/use-of-home", label: "Use of Home", icon: Home },
  { href: "/reports/payment-on-account", label: "Payment on Account", icon: Clock },
  { href: "/reports/payment-planner", label: "Tax Payment Planner", icon: PiggyBank },
];

const settingsSubItems = [
  { href: "/settings/users", label: "Users", icon: Users },
  { href: "/settings/business", label: "Business", icon: Building },
  { href: "/settings/categories", label: "Categories", icon: Tags },
  { href: "/settings/rules", label: "Rules", icon: ListFilter },
  { href: "/settings/integrations", label: "Integrations", icon: Building },
  { href: "/settings/import-export", label: "Import/Export", icon: FileDown },
  { href: "/settings/preferences", label: "Preferences", icon: Sliders },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { logout } = useAuthContext();
  const [mounted, setMounted] = useState(false);
  const [reportsExpanded, setReportsExpanded] = useState(() => 
    reportSubItems.some(item => location === item.href)
  );
  const [toolsExpanded, setToolsExpanded] = useState(() => 
    toolsSubItems.some(item => location === item.href)
  );
  const [settingsExpanded, setSettingsExpanded] = useState(() => location.startsWith('/settings'));

  const handleLogout = async () => {
    queryClient.clear();
    await logout();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (reportSubItems.some(item => location === item.href)) {
      setReportsExpanded(true);
    }
    if (toolsSubItems.some(item => location === item.href)) {
      setToolsExpanded(true);
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

  const isReportsActive = reportSubItems.some(item => location === item.href);
  const isToolsActive = toolsSubItems.some(item => location === item.href);
  const isSettingsActive = location.startsWith('/settings');

  return (
    <div className={cn(
      "flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-16 items-center border-b border-sidebar-border px-3 justify-between">
        <div className={cn("flex items-center", collapsed && "justify-center w-full")}>
          <FileCheck className={cn("h-6 w-6 text-primary", !collapsed && "mr-2")} />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold">Viatlized</span>
              <span className="text-xs text-muted-foreground">SA103F Self-Employment</span>
            </div>
          )}
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
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <PieChart className="h-5 w-5 mr-3" />
                    Reports
                  </div>
                  <span className="text-xs text-muted-foreground ml-8">Financial statements</span>
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
              href="/reports/tax-calculator"
              className={cn(
                "flex items-center rounded-md py-2 text-sm font-medium transition-colors justify-center px-2",
                isToolsActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              data-testid="nav-tools"
              title="Tools"
            >
              <Wrench className="h-5 w-5" />
            </Link>
          ) : (
            <div>
              <button
                onClick={() => setToolsExpanded(!toolsExpanded)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md py-2 px-3 text-sm font-medium transition-colors",
                  isToolsActive 
                    ? "bg-sidebar-primary/50 text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid="nav-tools-toggle"
              >
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <Wrench className="h-5 w-5 mr-3" />
                    Tools
                  </div>
                  <span className="text-xs text-muted-foreground ml-8">Calculators & trackers</span>
                </div>
                {toolsExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              
              {toolsExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                  {toolsSubItems.map((item) => {
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
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <Settings className="h-5 w-5 mr-3" />
                    Settings
                  </div>
                  <span className="text-xs text-muted-foreground ml-8">Configuration</span>
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
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center rounded-md py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
            collapsed ? "justify-center px-2" : "px-3"
          )}
          data-testid="button-sign-out"
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className={cn("h-5 w-5", !collapsed && "mr-3")} />
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </div>
  );
}
