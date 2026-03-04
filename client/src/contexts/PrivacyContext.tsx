import React, { createContext, useContext, useState, useEffect } from 'react';

interface PrivacyContextType {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  // Inicializa o estado. Como o requisito é estar sempre ativo por padrão a cada login, 
  // nós apenas iniciamos como true em memória. Se precisasse persistir a desativação, 
  // usaríamos localStorage, mas o pedido foi "por padrão modo privacidade habilitado em todo novo login"
  const [isPrivacyMode, setIsPrivacyMode] = useState(true);

  // Garantir que sempre que o app (ou o contexto) for recarregado (como num login), 
  // ele volta para o modo privacidade = true.
  useEffect(() => {
    setIsPrivacyMode(true);
  }, []);

  const togglePrivacyMode = () => {
    setIsPrivacyMode((prev: boolean) => !prev);
  };

  return (
    <PrivacyContext.Provider value={{ isPrivacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (context === undefined) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
}
