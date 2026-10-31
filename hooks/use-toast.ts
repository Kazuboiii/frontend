"use client";

import * as React from "react";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
};

let count = 0;

function genId() {
  return (count++).toString();
}

export type Toast = ToastProps & {
  id: string;
};

export function useToast() {
  return { toast, toasts: useModuleToasts(), dismiss: dismissToast };
}

/* Module-level toast for convenience in components that don't use the hook. */
const listeners = new Set<(toasts: Toast[]) => void>();
let moduleToasts: Toast[] = [];

export function toast(props: ToastProps) {
  const id = genId();
  const newToast: Toast = { ...props, id, duration: props.duration ?? 4000 };
  moduleToasts = [...moduleToasts, newToast];
  listeners.forEach((fn) => fn(moduleToasts));
  setTimeout(() => {
    moduleToasts = moduleToasts.filter((t) => t.id !== id);
    listeners.forEach((fn) => fn(moduleToasts));
  }, newToast.duration);
  return id;
}

export function dismissToast(id?: string) {
  moduleToasts = id === undefined ? [] : moduleToasts.filter((t) => t.id !== id);
  listeners.forEach((fn) => fn(moduleToasts));
}

export function useModuleToasts() {
  const [toasts, setToasts] = React.useState<Toast[]>(moduleToasts);
  React.useEffect(() => {
    const fn = (t: Toast[]) => setToasts(t);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return toasts;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return children;
}
