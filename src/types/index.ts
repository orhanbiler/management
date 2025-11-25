/**
 * Type definitions for the Toughbook Tracker application
 * All types are strictly defined to ensure type safety
 */

// Device status options
export type DeviceStatus = "Assigned" | "Unassigned" | "Retired" | "Unknown";

// Device type options
export type DeviceType = "Toughbook" | "Laptop" | "Desktop" | "Other";

/**
 * Device entity representing inventory items
 * All fields are carefully validated before storage
 */
export interface Device {
  /** Unique identifier from Firestore */
  id: string;
  /** Serial number of the device (alphanumeric) */
  serial_number: string;
  /** PID (Personal ID) number for CAPWIN */
  pid_number: string;
  /** Internal asset tracking ID */
  asset_id: string;
  /** Type of device */
  device_type: DeviceType;
  /** ORI Number (for Desktop/Other types) */
  ori_number?: string;
  /** Current assignment status */
  status: DeviceStatus;
  /** Flag indicating device is scheduled for retirement */
  to_be_retired?: boolean;
  /** Flag indicating PID is registered in the system */
  pid_registered?: boolean;
  /** Name of assigned officer/user */
  officer: string;
  /** Date device was assigned (ISO format) */
  assignment_date: string;
  /** Additional notes about the device */
  notes: string;
  /** Last update timestamp (ISO format) */
  updated_at?: string;
}

/**
 * Form data for creating/updating devices
 * Excludes system-managed fields like id and updated_at
 */
export type DeviceFormData = Omit<Device, "id" | "updated_at">;

/**
 * Firebase error type for consistent error handling
 */
export interface FirebaseError {
  code?: string;
  message?: string;
  name?: string;
}

/**
 * Sorting options for inventory table
 */
export type SortField = "asset_id" | "serial_number" | "pid_number" | "officer" | "status";
export type SortOrder = "asc" | "desc";

/**
 * Filter state for inventory
 */
export interface InventoryFilters {
  searchQuery: string;
  statusFilter: DeviceStatus | "All";
  pidRegisteredFilter: "All" | "Registered" | "Not Registered";
}

/**
 * Statistics about the inventory
 */
export interface InventoryStats {
  total: number;
  byStatus: Record<DeviceStatus, number>;
  byType: Record<DeviceType, number>;
  toBeRetired: number;
  pidMismatches: number;
  withoutSerial: number;
  withoutPid: number;
  withoutAssetId: number;
  recentlyAssigned: number;
  assignmentRate: number;
}

/**
 * Email template data
 */
export interface EmailData {
  subject: string;
  body: string;
  warning?: string;
  recipient?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  blocked: boolean;
  remainingAttempts: number;
  retryAfterMs?: number;
}
