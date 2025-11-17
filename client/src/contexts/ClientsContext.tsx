import { WorkflowStep } from "@/hooks/useWorkflowState";
import { createContext, useContext, useEffect, useState } from "react";

export interface Client {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  createdAt: string;
  workflow: WorkflowStep[];
}

interface ClientsContextType {
  clients: Client[];
  addClient: (client: Omit<Client, "id" | "createdAt" | "workflow">) => void;
  updateClient: (id: string, client: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClient: (id: string) => Client | undefined;
  updateWorkflow: (clientId: string, workflow: WorkflowStep[]) => void;
}

const ClientsContext = createContext<ClientsContextType | undefined>(undefined);

const STORAGE_KEY = "firerange-clients";

const INITIAL_WORKFLOW: WorkflowStep[] = [
  { id: "processo-venda", title: "Processo de Venda", completed: false },
  { id: "cadastro", title: "Cadastro", completed: false },
  {
    id: "boas-vindas",
    title: "Boas Vindas",
    completed: false,
    subTasks: [
      { id: "bv-1", label: "Enviar mensagem de boas-vindas", completed: false },
      { id: "bv-2", label: "Enviar checklist de documentos", completed: false },
      { id: "bv-3", label: "Criar pasta digital do cliente", completed: false },
    ],
  },
  {
    id: "agendamento-psicotecnico",
    title: "Agendamento Psicotécnico",
    completed: false,
    subTasks: [
      { id: "ap-1", label: "Enviar encaminhamento para clínica", completed: false },
      { id: "ap-2", label: "Cliente agendar exame", completed: false },
      { id: "ap-3", label: "Confirmar realização do exame", completed: false },
      { id: "ap-4", label: "Receber laudo aprovado", completed: false },
    ],
  },
  {
    id: "juntada-documento",
    title: "Juntada de Documento",
    completed: false,
    subTasks: [
      { id: "jd-1", label: "Comprovante de residência atual", completed: false },
      { id: "jd-2", label: "Comprovantes 5 anos anteriores", completed: false },
      { id: "jd-3", label: "Certidão Justiça Federal", completed: false },
      { id: "jd-4", label: "Certidão Justiça Militar", completed: false },
      { id: "jd-5", label: "Certidão Crimes Eleitorais", completed: false },
      { id: "jd-6", label: "Certidão TJDFT", completed: false },
      { id: "jd-7", label: "Comprovante ocupação lícita", completed: false },
      { id: "jd-8", label: "Declarações assinadas", completed: false },
    ],
  },
  { id: "laudo-arma", title: "Laudo Arma de Fogo", completed: false },
  { id: "despachante", title: "Despachante", completed: false },
  { id: "fim", title: "Fim", completed: false },
];

export function ClientsProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  }, [clients]);

  const addClient = (clientData: Omit<Client, "id" | "createdAt" | "workflow">) => {
    const newClient: Client = {
      ...clientData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      workflow: INITIAL_WORKFLOW,
    };
    setClients((prev) => [...prev, newClient]);
  };

  const updateClient = (id: string, clientData: Partial<Client>) => {
    setClients((prev) =>
      prev.map((client) =>
        client.id === id ? { ...client, ...clientData } : client
      )
    );
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((client) => client.id !== id));
  };

  const getClient = (id: string) => {
    return clients.find((client) => client.id === id);
  };

  const updateWorkflow = (clientId: string, workflow: WorkflowStep[]) => {
    setClients((prev) =>
      prev.map((client) =>
        client.id === clientId ? { ...client, workflow } : client
      )
    );
  };

  return (
    <ClientsContext.Provider
      value={{
        clients,
        addClient,
        updateClient,
        deleteClient,
        getClient,
        updateWorkflow,
      }}
    >
      {children}
    </ClientsContext.Provider>
  );
}

export function useClients() {
  const context = useContext(ClientsContext);
  if (context === undefined) {
    throw new Error("useClients must be used within a ClientsProvider");
  }
  return context;
}
