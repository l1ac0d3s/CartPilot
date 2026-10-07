import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message, tone = 'info') => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-3), { id, message, tone }]);
      setTimeout(() => dismiss(id), 3500);
    },
    [dismiss],
  );
  const value = useMemo(
    () => ({ show, success: (m) => show(m, 'success'), error: (m) => show(m, 'error') }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <button key={toast.id} className={`toast toast-${toast.tone}`} onClick={() => dismiss(toast.id)}>
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
