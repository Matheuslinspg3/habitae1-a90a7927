import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  demoProperties,
  demoLeads,
  demoContracts,
  demoTransactions,
  demoTasks,
  demoAppointments,
  demoActivities,
  calculateDemoStats,
  getTodayDemoTasks,
  getTodayDemoAppointments,
  type DemoProperty,
  type DemoLead,
  type DemoContract,
  type DemoTransaction,
  type DemoTask,
  type DemoAppointment,
  type DemoActivity,
} from "@/data/demoData";

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  organization: string;
  organization_id: string;
  createdAt: Date;
}

export interface DemoStats {
  totalProperties: number;
  activeProperties: number;
  totalLeads: number;
  activeLeads: number;
  newLeadsThisWeek: number;
  activeContracts: number;
  pendingContracts: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  balance: number;
  pipelineValue: number;
  conversionRate: number;
  closedValue: number;
}

export interface DemoData {
  properties: DemoProperty[];
  leads: DemoLead[];
  contracts: DemoContract[];
  transactions: DemoTransaction[];
  tasks: DemoTask[];
  appointments: DemoAppointment[];
}

interface DemoContextType {
  isDemoMode: boolean;
  demoUser: DemoUser | null;
  startDemo: () => void;
  endDemo: () => void;
  
  // Demo data
  demoData: DemoData;
  
  // Calculated stats
  demoStats: DemoStats;
  
  // Recent activities
  recentActivities: DemoActivity[];
  
  // Today's items
  todayTasks: DemoTask[];
  todayAppointments: DemoAppointment[];
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

const DEMO_SESSION_KEY = "habitae_demo_session";

// Generate a unique demo session ID
function generateDemoId(): string {
  return `demo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Initialize demo data
const initialDemoData: DemoData = {
  properties: demoProperties,
  leads: demoLeads,
  contracts: demoContracts,
  transactions: demoTransactions,
  tasks: demoTasks,
  appointments: demoAppointments,
};

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null);
  const navigate = useNavigate();

  // Calculate stats
  const demoStats = calculateDemoStats();
  
  // Get today's items
  const todayTasks = getTodayDemoTasks();
  const todayAppointments = getTodayDemoAppointments();

  // Check for existing demo session on mount
  useEffect(() => {
    const storedSession = sessionStorage.getItem(DEMO_SESSION_KEY);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        setDemoUser({
          ...parsed,
          createdAt: new Date(parsed.createdAt),
        });
      } catch {
        sessionStorage.removeItem(DEMO_SESSION_KEY);
      }
    }
  }, []);

  const startDemo = () => {
    const newDemoUser: DemoUser = {
      id: generateDemoId(),
      email: "demo@habitae.app",
      name: "Usuário Demo",
      organization: "Demonstração Habitae",
      organization_id: "demo-org-001",
      createdAt: new Date(),
    };

    setDemoUser(newDemoUser);
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(newDemoUser));
    navigate("/dashboard");
  };

  const endDemo = () => {
    setDemoUser(null);
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    navigate("/demo");
  };

  const isDemoMode = demoUser !== null;

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        demoUser,
        startDemo,
        endDemo,
        demoData: initialDemoData,
        demoStats,
        recentActivities: demoActivities,
        todayTasks,
        todayAppointments,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error("useDemo must be used within a DemoProvider");
  }
  return context;
}
