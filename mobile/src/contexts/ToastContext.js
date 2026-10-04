import { createContext, useCallback, useContext, useState } from 'react';
import { Toast } from '../components/common/Toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toastState, setToastState] = useState({
    visible: false,
    type: 'success',
    title: '',
    message: '',
    duration: 4000,
  });

  const hideToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  const showToast = useCallback(({ type = 'success', title = '', message = '', duration = 4000 }) => {
    setToastState({
      visible: true,
      type,
      title,
      message,
      duration,
    });
  }, []);

  const showSuccess = useCallback(
    (message, title = '') => {
      showToast({ type: 'success', title, message });
    },
    [showToast],
  );

  const showError = useCallback(
    (message, title = '') => {
      showToast({ type: 'danger', title, message });
    },
    [showToast],
  );

  const showWarning = useCallback(
    (message, title = '') => {
      showToast({ type: 'warning', title, message });
    },
    [showToast],
  );

  const showInfo = useCallback(
    (message, title = '') => {
      showToast({ type: 'info', title, message });
    },
    [showToast],
  );

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        hideToast,
      }}
    >
      {children}
      <Toast
        visible={toastState.visible}
        type={toastState.type}
        title={toastState.title}
        message={toastState.message}
        duration={toastState.duration}
        onDismiss={hideToast}
      />
    </ToastContext.Provider>
  );
}

const NOOP = () => {};
const DEFAULT_CONTEXT = {
  showToast: NOOP,
  showSuccess: NOOP,
  showError: NOOP,
  showWarning: NOOP,
  showInfo: NOOP,
  hideToast: NOOP,
};

export function useToast() {
  const context = useContext(ToastContext);
  return context || DEFAULT_CONTEXT;
}
