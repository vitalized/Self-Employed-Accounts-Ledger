import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DateFilter } from './types';

interface DateRangeContextType {
  dateRange: DateFilter;
  setDateRange: (value: DateFilter) => void;
  customStartDate: Date | undefined;
  setCustomStartDate: (value: Date | undefined) => void;
  customEndDate: Date | undefined;
  setCustomEndDate: (value: Date | undefined) => void;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

const STORAGE_KEYS = {
  dateRange: 'dateFilter_dateRange',
  customStartDate: 'dateFilter_customStartDate',
  customEndDate: 'dateFilter_customEndDate',
};

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRangeState] = useState<DateFilter>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.dateRange);
    return (stored as DateFilter) || 'this-month';
  });

  const [customStartDate, setCustomStartDateState] = useState<Date | undefined>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.customStartDate);
    return stored ? new Date(stored) : undefined;
  });

  const [customEndDate, setCustomEndDateState] = useState<Date | undefined>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.customEndDate);
    return stored ? new Date(stored) : undefined;
  });

  const setDateRange = (value: DateFilter) => {
    setDateRangeState(value);
    localStorage.setItem(STORAGE_KEYS.dateRange, value);
  };

  const setCustomStartDate = (value: Date | undefined) => {
    setCustomStartDateState(value);
    if (value) {
      localStorage.setItem(STORAGE_KEYS.customStartDate, value.toISOString());
    } else {
      localStorage.removeItem(STORAGE_KEYS.customStartDate);
    }
  };

  const setCustomEndDate = (value: Date | undefined) => {
    setCustomEndDateState(value);
    if (value) {
      localStorage.setItem(STORAGE_KEYS.customEndDate, value.toISOString());
    } else {
      localStorage.removeItem(STORAGE_KEYS.customEndDate);
    }
  };

  return (
    <DateRangeContext.Provider
      value={{
        dateRange,
        setDateRange,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
      }}
    >
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (context === undefined) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }
  return context;
}
