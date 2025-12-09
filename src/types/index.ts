/**
 * Type definitions for the Toughbook Tracker application
 * All types are strictly defined to ensure type safety
 */

// Device status options
export type DeviceStatus = "Assigned" | "Unassigned" | "Retired" | "Unknown";

// Device type options
export type DeviceType = "Toughbook" | "Laptop" | "Desktop" | "Other";

// Operating system options
export type OperatingSystem = "Windows 11" | "Windows 10" | "Windows 8" | "Windows 7";

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
  /** Operating system installed */
  operating_system?: OperatingSystem;
  /** ORI Number (for Desktop/Other types) */
  ori_number?: string;
  /** Current assignment status */
  status: DeviceStatus;
  /** Flag indicating device is scheduled for retirement */
  to_be_retired?: boolean;
  /** Flag indicating PID is registered in the system */
  pid_registered?: boolean;
  
  // Retirement process checklist
  /** Step 1: PID deactivated from MSP */
  retirement_msp_deactivated?: boolean;
  /** Step 2: PID deactivated from CAPWIN */
  retirement_capwin_deactivated?: boolean;
  /** Step 3: Disconnected from domain controller */
  retirement_domain_disconnected?: boolean;
  /** Step 4: Device formatted */
  retirement_formatted?: boolean;
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

/**
 * Staff employment status
 */
export type StaffStatus = "Active" | "Inactive" | "On Leave" | "Terminated";

/**
 * Staff rank/position
 */
export type StaffRank = "Chief" | "Captain" | "Lieutenant" | "Sergeant" | "Corporal" | "Officer" | "Detective" | "Civilian" | "Other";

/**
 * METERS certification status
 */
export type MetersCertStatus = "Valid" | "Expiring Soon" | "Expired" | "Not Certified";

/**
 * Staff member entity
 */
export interface StaffMember {
  /** Unique identifier from Firestore */
  id: string;
  /** First name */
  first_name: string;
  /** Last name */
  last_name: string;
  /** Badge number */
  badge_number: string;
  /** Employee ID */
  employee_id: string;
  /** Rank/position */
  rank: StaffRank;
  /** Current employment status */
  status: StaffStatus;
  /** Email address */
  email?: string;
  /** Phone number */
  phone?: string;
  /** Hire date (ISO format) */
  hire_date: string;
  /** Department/unit */
  department?: string;
  /** METERS certification date (ISO format) - when they completed the training */
  meters_certification_date?: string;
  /** METERS expiration date (ISO format) - 2 years from certification */
  meters_expiration_date?: string;
  /** Additional notes */
  notes?: string;
  /** Last update timestamp (ISO format) */
  updated_at?: string;
}

/**
 * Form data for creating/updating staff members
 */
export type StaffFormData = Omit<StaffMember, "id" | "updated_at">;

/**
 * Statistics about staff
 */
export interface StaffStats {
  total: number;
  byStatus: Record<StaffStatus, number>;
  byRank: Record<StaffRank, number>;
  metersCertified: number;
  metersExpiringSoon: number;
  metersExpired: number;
  metersNotCertified: number;
}
