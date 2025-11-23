import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateExpectedPid(sn: string | undefined): string {
  if (!sn || sn.length < 5) return "";
  // Rule: Replace first 4 chars with Z100
  // Note: Serial numbers are variable length.
  return "Z100" + sn.substring(4);
}

export function isPidMismatch(sn: string | undefined, pid: string | undefined): boolean {
  if (!sn || !pid) return false;
  const expected = calculateExpectedPid(sn);
  return expected !== pid;
}
