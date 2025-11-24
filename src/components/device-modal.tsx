"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Device, DeviceFormData } from "@/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { calculateExpectedPid, isPidMismatch } from "@/lib/utils"
import { AlertTriangle, Loader2 } from "lucide-react"

const formSchema = z.object({
  serial_number: z.string().optional(),
  pid_number: z.string().optional(),
  asset_id: z.string().optional(),
  device_type: z.enum(["Toughbook", "Laptop", "Desktop", "Other"]),
  ori_number: z.string().optional(),
  status: z.enum(["Assigned", "Unassigned", "Retired", "Unknown"]),
  to_be_retired: z.boolean().optional(),
  pid_registered: z.boolean().optional(),
  officer: z.string().optional(),
  assignment_date: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    const hasSerial = data.serial_number && data.serial_number.trim().length > 0;
    const hasPid = data.pid_number && data.pid_number.trim().length > 0;
    return hasSerial || hasPid;
  },
  {
    message: "Either Serial Number or PID Number is required",
    path: ["serial_number"], // Show error on serial_number field
  }
).refine(
  (data) => {
    const hasSerial = data.serial_number && data.serial_number.trim().length > 0;
    const hasPid = data.pid_number && data.pid_number.trim().length > 0;
    return hasSerial || hasPid;
  },
  {
    message: "Either Serial Number or PID Number is required",
    path: ["pid_number"], // Also show error on pid_number field
  }
)

interface DeviceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device?: Device | null
  onSave: (data: DeviceFormData) => Promise<void>
  existingDevices?: Device[] // For duplicate checking
}

export function DeviceModal({ open, onOpenChange, device, onSave, existingDevices = [] }: DeviceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      serial_number: "",
      pid_number: "",
      asset_id: "",
      device_type: "Toughbook",
      ori_number: "",
      status: "Unassigned",
      to_be_retired: false,
      pid_registered: false,
      officer: "",
      assignment_date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  })

  // Reset form when device changes or modal opens
  useEffect(() => {
    if (open) {
      if (device) {
        form.reset({
          serial_number: device.serial_number,
          pid_number: device.pid_number,
          asset_id: device.asset_id || "",
          device_type: device.device_type || "Toughbook",
          ori_number: device.ori_number || "",
          status: device.status,
          to_be_retired: device.to_be_retired || false,
          pid_registered: device.pid_registered || false,
          officer: device.officer,
          assignment_date: device.assignment_date,
          notes: device.notes,
        })
      } else {
        form.reset({
          serial_number: "",
          pid_number: "",
          asset_id: "",
          device_type: "Toughbook",
          ori_number: "",
          status: "Unassigned",
          to_be_retired: false,
          pid_registered: false,
          officer: "",
          assignment_date: new Date().toISOString().split("T")[0],
          notes: "",
        })
      }
    }
  }, [device, open, form])

  // Watch values for real-time calculations
  const serialNumber = form.watch("serial_number")
  const pidNumber = form.watch("pid_number")
  const deviceType = form.watch("device_type")
  
  const expectedPid = useMemo(() => {
    if (!serialNumber || !serialNumber.trim()) return ""
    return calculateExpectedPid(serialNumber.toUpperCase())
  }, [serialNumber])

  const mismatch = useMemo(() => {
    if (!serialNumber || !serialNumber.trim() || !pidNumber || !pidNumber.trim()) return false
    return isPidMismatch(serialNumber.toUpperCase(), pidNumber.toUpperCase())
  }, [serialNumber, pidNumber])

  // Check for duplicate serial number
  const isDuplicateSerial = useMemo(() => {
    if (!serialNumber || !serialNumber.trim() || device) return false // Skip check if editing existing device or no serial number
    const normalizedSerial = serialNumber.toUpperCase().trim()
    return existingDevices.some(
      d => d.serial_number && d.serial_number.toUpperCase().trim() === normalizedSerial
    )
  }, [serialNumber, device, existingDevices])

  // Check for duplicate PID number
  const isDuplicatePid = useMemo(() => {
    if (!pidNumber || !pidNumber.trim() || device) return false // Skip check if editing existing device or no PID number
    const normalizedPid = pidNumber.toUpperCase().trim()
    return existingDevices.some(
      d => d.pid_number && d.pid_number.toUpperCase().trim() === normalizedPid
    )
  }, [pidNumber, device, existingDevices])

  // Auto-uppercase inputs on change handled via onChange in render
  // or just normalize on submit. 
  // Requirement: "Input Enforcement: All SN, PID, and Assigned Officer inputs must be automatically converted and stored in UPPERCASE."
  // I will do it on onChange for better UX.

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Prevent submission if duplicate serial number detected
    if (isDuplicateSerial) {
      form.setError("serial_number", {
        type: "manual",
        message: "A device with this serial number already exists"
      })
      return
    }

    // Prevent submission if duplicate PID number detected
    if (isDuplicatePid) {
      form.setError("pid_number", {
        type: "manual",
        message: "A device with this PID number already exists"
      })
      return
    }

    setIsSubmitting(true)
    try {
      await onSave({
        serial_number: (values.serial_number || "").toUpperCase(),
        pid_number: (values.pid_number || "").toUpperCase(),
        asset_id: (values.asset_id || "").toUpperCase(),
        device_type: values.device_type,
        ori_number: values.ori_number ? values.ori_number.toUpperCase() : "",
        status: values.status,
        to_be_retired: values.to_be_retired || false,
        pid_registered: values.pid_registered || false,
        officer: (values.officer || "").toUpperCase(),
        assignment_date: values.assignment_date || "",
        notes: values.notes || "",
      })
      // Only close modal if save was successful (no error thrown)
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in onSave, just prevent modal from closing
      console.error("Form submission error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{device ? "Edit Device" : "Add New Device"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Serial Number */}
              <FormField
                control={form.control}
                name="serial_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number <span className="text-muted-foreground text-xs">(or PID)</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. 3ITTA13927" 
                        {...field} 
                        onChange={(e) => {
                          field.onChange(e.target.value.toUpperCase())
                          // Auto-fill PID if empty and we have an expected one
                          // const expected = calculateExpectedPid(e.target.value.toUpperCase());
                          // if (!form.getValues("pid_number") && expected) {
                          //   form.setValue("pid_number", expected);
                          // }
                        }}
                        className={isDuplicateSerial ? "border-red-500" : ""}
                      />
                    </FormControl>
                    {isDuplicateSerial && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        A device with this serial number already exists
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Expected PID (Read Only) */}
              <FormItem>
                <FormLabel className="text-muted-foreground">Expected PID (Auto-calc)</FormLabel>
                <FormControl>
                  <Input 
                    readOnly 
                    value={expectedPid} 
                    className="bg-muted text-muted-foreground font-mono" 
                  />
                </FormControl>
              </FormItem>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PID Number */}
              <FormField
                control={form.control}
                name="pid_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PID Number (Actual) <span className="text-muted-foreground text-xs">(or Serial)</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. Z100A13927" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        className={isDuplicatePid ? "border-red-500" : ""}
                      />
                    </FormControl>
                    {isDuplicatePid && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        A device with this PID number already exists
                      </p>
                    )}
                    {mismatch && !isDuplicatePid && (
                      <div className="text-xs text-orange-600 flex items-center gap-1 mt-1 font-medium animate-pulse">
                        <AlertTriangle className="h-3 w-3" />
                        Mismatch with Expected PID
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Asset ID */}
              <FormField
                control={form.control}
                name="asset_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. ASSET-001" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Device Type */}
              <FormField
                control={form.control}
                name="device_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select device type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Toughbook">Toughbook</SelectItem>
                        <SelectItem value="Laptop">Laptop</SelectItem>
                        <SelectItem value="Desktop">Desktop</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignment Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Unassigned">Unassigned (Ready)</SelectItem>
                        <SelectItem value="Assigned">Assigned</SelectItem>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                        <SelectItem value="Retired">Retired (Decommissioned)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* To Be Retired Checkbox */}
              <FormField
                control={form.control}
                name="to_be_retired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        To Be Retired
                      </FormLabel>
                      <FormDescription>
                        Mark this device as scheduled for retirement
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* PID Registered Checkbox */}
              <FormField
                control={form.control}
                name="pid_registered"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        PID Registered
                      </FormLabel>
                      <FormDescription>
                        Mark if PID is registered in the system
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* ORI Number - Only show for Desktop or Other */}
            {(deviceType === "Desktop" || deviceType === "Other") && (
              <FormField
                control={form.control}
                name="ori_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ORI Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. MD1234567" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Officer */}
            <FormField
              control={form.control}
              name="officer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Officer</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. OFF. SMITH" 
                      {...field} 
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Assignment Date */}
            <FormField
              control={form.control}
              name="assignment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignment Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional details..." 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Record"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

