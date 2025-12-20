import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DataContextType {
  useMockData: boolean;
  setUseMockData: (value: boolean) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [useMockData, setUseMockData] = useState(() => {
    const stored = localStorage.getItem('use-mock-data');
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('use-mock-data', String(useMockData));
  }, [useMockData]);

  return (
    <DataContext.Provider value={{ useMockData, setUseMockData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useDataMode() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataMode must be used within a DataProvider');
  }
  return context;
}
