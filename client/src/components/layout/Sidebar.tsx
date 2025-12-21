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
  PanelLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transactions", label: "Transactions", icon: Receipt },
    { href: "/reports", label: "Reports", icon: PieChart },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

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
          {links.map((link) => {
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
