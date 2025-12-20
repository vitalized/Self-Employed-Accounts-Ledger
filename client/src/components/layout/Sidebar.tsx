import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Receipt, 
  PieChart, 
  Settings, 
  LogOut, 
  Briefcase 
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transactions", label: "Transactions", icon: Receipt },
    { href: "/reports", label: "Reports", icon: PieChart },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Briefcase className="mr-2 h-6 w-6 text-primary" />
        <span className="text-lg font-bold">TaxTrack</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                data-testid={`nav-${link.label.toLowerCase()}`}
              >
                <Icon className="mr-3 h-5 w-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-sidebar-border p-4">
        <button className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
