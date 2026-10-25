import { create } from 'zustand';

export interface ToastMessage
{
  id: number;
  message: string;
  tone: 'info' | 'error';
}

interface ToastState
{
  toasts: ToastMessage[];
  show: (message: string, tone?: ToastMessage['tone']) => void;
  dismiss: (id: number) => void;
}

let nextToastId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, tone = 'info') => set((state) =>
  {
    if (state.toasts.some((toast) => toast.message === message))
    {
      return state;
    }
    return { toasts: [...state.toasts, { id: nextToastId++, message, tone }].slice(-3) };
  }),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function showToast(message: string, tone: ToastMessage['tone'] = 'info'): void
{
  useToastStore.getState().show(message, tone);
}
