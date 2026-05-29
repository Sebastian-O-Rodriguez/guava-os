import { createContext, useContext, useState, useCallback } from "react";
import type { Action } from "./actions/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionType = "nutrition" | "gym" | "running" | "custom";

export type ActionModalPayload = {
  type: ActionType;
  /** Pre-filled fields (from chat estimator or defaults) */
  fields: Record<string, string | number>;
  /** Action object for chat confirmation flow (round-tripped to server) */
  pendingAction?: Action;
  /** Source that opened the modal */
  source: "chat" | "manual";
};

type ActionModalState = {
  isOpen: boolean;
  payload: ActionModalPayload | null;
  open: (payload: ActionModalPayload) => void;
  close: () => void;
  /** Called after successful execution — triggers data refresh */
  onSuccess: (() => void) | null;
  setOnSuccess: (cb: (() => void) | null) => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ActionModalContext = createContext<ActionModalState>({
  isOpen: false,
  payload: null,
  open: () => {},
  close: () => {},
  onSuccess: null,
  setOnSuccess: () => {},
});

export function useActionModal() {
  return useContext(ActionModalContext);
}

export function ActionModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<ActionModalPayload | null>(null);
  const [onSuccess, setOnSuccessState] = useState<(() => void) | null>(null);

  const open = useCallback((p: ActionModalPayload) => {
    setPayload(p);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setPayload(null);
  }, []);

  const setOnSuccess = useCallback((cb: (() => void) | null) => {
    setOnSuccessState(() => cb);
  }, []);

  return (
    <ActionModalContext.Provider value={{ isOpen, payload, open, close, onSuccess, setOnSuccess }}>
      {children}
    </ActionModalContext.Provider>
  );
}
