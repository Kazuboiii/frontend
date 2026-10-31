import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-NP", {
    timeZone: "Asia/Kathmandu",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatRelative(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-NP", { timeZone: "Asia/Kathmandu", timeStyle: "short" });
}
