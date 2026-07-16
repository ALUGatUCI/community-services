"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "./Button";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };

type ConfirmOptions = { confirmLabel?: string; danger?: boolean };
type PromptOptions = { defaultValue?: string; confirmLabel?: string };

type DialogState = {
  open: boolean;
  message: string;
  withInput: boolean;
  value: string;
  confirmLabel: string;
  danger: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (result: any) => void;
};

type UIContextValue = {
  toast: (message: string, type?: ToastType) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
};

const UIContext = createContext<UIContextValue | null>(null);

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within <UIProvider>.");
  return ctx;
}

const CLOSED: DialogState = {
  open: false,
  message: "",
  withInput: false,
  value: "",
  confirmLabel: "Confirm",
  danger: false,
};

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<DialogState>(CLOSED);
  const idRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = (idRef.current += 1);
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback(
    (message: string, options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) => {
        setDialog({
          open: true,
          message,
          withInput: false,
          value: "",
          confirmLabel: options.confirmLabel ?? "Confirm",
          danger: !!options.danger,
          resolve,
        });
      }),
    [],
  );

  const prompt = useCallback(
    (message: string, options: PromptOptions = {}) =>
      new Promise<string | null>((resolve) => {
        setDialog({
          open: true,
          message,
          withInput: true,
          value: options.defaultValue ?? "",
          confirmLabel: options.confirmLabel ?? "Save",
          danger: false,
          resolve,
        });
      }),
    [],
  );

  const settle = useCallback((result: boolean | string | null) => {
    setDialog((current) => {
      current.resolve?.(result);
      return CLOSED;
    });
  }, []);

  const cancel = () => settle(dialog.withInput ? null : false);
  const accept = () => settle(dialog.withInput ? dialog.value : true);

  return (
    <UIContext.Provider value={{ toast, confirm, prompt }}>
      {children}

      <div className="toast-region">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            {t.message}
          </div>
        ))}
      </div>

      {dialog.open ? (
        <div className="modal-overlay" onClick={cancel}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <p>{dialog.message}</p>
            {dialog.withInput ? (
              <input
                autoFocus
                value={dialog.value}
                onChange={(event) =>
                  setDialog((current) => ({
                    ...current,
                    value: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") accept();
                }}
              />
            ) : null}
            <div className="modal-actions">
              <Button variant="secondary" onClick={cancel}>
                Cancel
              </Button>
              <Button
                variant={dialog.danger ? "danger" : "primary"}
                onClick={accept}
              >
                {dialog.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </UIContext.Provider>
  );
}
