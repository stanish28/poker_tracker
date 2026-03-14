import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const bg = isSuccess ? 'bg-green-50 border-green-200' : isError ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200';
          const iconColor = isSuccess ? 'text-green-600' : isError ? 'text-red-600' : 'text-blue-600';
          const Icon = isSuccess ? CheckCircle : isError ? XCircle : Info;
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-2 p-3 rounded-lg border shadow-sm ${bg}`}
              role="alert"
            >
              <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
              <p className="text-sm text-gray-900 flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5 rounded"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ToastContainer;
