export interface Device {
  id: string;
  serial_number: string;
  pid_number: string;
  asset_id: string;
  device_type: "Toughbook" | "Laptop" | "Desktop" | "Other";
  ori_number?: string;
  status: "Assigned" | "Unassigned" | "Retired";
  officer: string;
  assignment_date: string;
  notes: string;
  updated_at?: string;
}

export type DeviceFormData = Omit<Device, "id" | "updated_at">;

