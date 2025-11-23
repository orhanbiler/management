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
import { calculateExpectedPid, isPidMismatch } from "@/lib/utils"
import { AlertTriangle, Loader2 } from "lucide-react"

const formSchema = z.object({
  serial_number: z.string().min(1, "Serial Number is required"),
  pid_number: z.string().min(1, "PID Number is required"),
  asset_id: z.string().optional(),
  device_type: z.enum(["Toughbook", "Laptop", "Desktop", "Other"]),
  ori_number: z.string().optional(),
  status: z.enum(["Assigned", "Unassigned", "Retired"]),
  officer: z.string().optional(),
  assignment_date: z.string().optional(),
  notes: z.string().optional(),
})

interface DeviceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device?: Device | null
  onSave: (data: DeviceFormData) => Promise<void>
}

export function DeviceModal({ open, onOpenChange, device, onSave }: DeviceModalProps) {
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
    return calculateExpectedPid(serialNumber?.toUpperCase())
  }, [serialNumber])

  const mismatch = useMemo(() => {
    return isPidMismatch(serialNumber?.toUpperCase(), pidNumber?.toUpperCase())
  }, [serialNumber, pidNumber])

  // Auto-uppercase inputs on change handled via onChange in render
  // or just normalize on submit. 
  // Requirement: "Input Enforcement: All SN, PID, and Assigned Officer inputs must be automatically converted and stored in UPPERCASE."
  // I will do it on onChange for better UX.

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    try {
      await onSave({
        serial_number: values.serial_number.toUpperCase(),
        pid_number: values.pid_number.toUpperCase(),
        asset_id: (values.asset_id || "").toUpperCase(),
        device_type: values.device_type,
        ori_number: values.ori_number ? values.ori_number.toUpperCase() : "",
        status: values.status,
        officer: (values.officer || "").toUpperCase(),
        assignment_date: values.assignment_date || "",
        notes: values.notes || "",
      })
      onOpenChange(false)
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
                    <FormLabel>Serial Number <span className="text-red-500">*</span></FormLabel>
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
                      />
                    </FormControl>
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
                    <FormLabel>PID Number (Actual) <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. Z100A13927" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    {mismatch && (
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
                        <SelectItem value="Retired">Retired (Decommissioned)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
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

