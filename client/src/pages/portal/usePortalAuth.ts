import { useState, useEffect, useCallback } from "react";

interface PortalClient {
  id: number;
  name: string;
  email: string;
  cpf: string;
  phone?: string;
  phone2?: string;
  identityNumber?: string;
  identityIssueDate?: string;
  identityIssuer?: string;
  identityUf?: string;
  birthDate?: string;
  gender?: string;
  motherName?: string;
  fatherName?: string;
  maritalStatus?: string;
  profession?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  residenceUf?: string;
}

interface PortalAuthState {
  client: PortalClient | null;
  lgpdAccepted: boolean;
  lgpdAcceptedAt: string | null;
  loading: boolean;
  error: string | null;
}

export function usePortalAuth() {
  const [state, setState] = useState<PortalAuthState>({
    client: null,
    lgpdAccepted: false,
    lgpdAcceptedAt: null,
    loading: true,
    error: null,
  });

  const fetchMe = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/portal/me", { credentials: "include" });
      if (res.status === 401) {
        setState({
          client: null,
          lgpdAccepted: false,
          lgpdAcceptedAt: null,
          loading: false,
          error: null,
        });
        return;
      }
      if (!res.ok) throw new Error("Erro ao buscar dados");
      const data = await res.json();
      setState({
        client: data.client,
        lgpdAccepted: data.lgpdAccepted,
        lgpdAcceptedAt: data.lgpdAcceptedAt,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    await fetch("/api/portal/logout", { method: "POST", credentials: "include" });
    setState({
      client: null,
      lgpdAccepted: false,
      lgpdAcceptedAt: null,
      loading: false,
      error: null,
    });
  }, []);

  return { ...state, refetch: fetchMe, logout };
}
