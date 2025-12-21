import { Sidebar } from "./Sidebar";
import { useDataMode } from "@/lib/dataContext";
import { FlaskConical, X } from "lucide-react";
import { useState } from "react";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { useMockData, setUseMockData } = useDataMode();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {useMockData && !bannerDismissed && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white px-4 py-2 flex items-center justify-center gap-3 animate-pulse shadow-lg">
            <FlaskConical className="h-5 w-5 animate-bounce" />
            <span className="font-semibold text-sm tracking-wide">
              DEMO MODE - Showing sample data, not your real transactions
            </span>
            <button
              onClick={() => setUseMockData(false)}
              className="ml-2 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-medium transition-colors"
              data-testid="button-switch-to-real-data"
            >
              Switch to Real Data
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="ml-1 hover:bg-white/20 p-1 rounded-full transition-colors"
              data-testid="button-dismiss-mock-banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className={`container mx-auto p-8 ${useMockData ? 'relative' : ''}`}>
          {useMockData && (
            <div className="absolute inset-0 pointer-events-none border-4 border-dashed border-amber-400/30 rounded-lg" />
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
