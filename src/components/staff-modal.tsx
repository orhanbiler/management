"use client"

import { useEffect, useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { StaffMember, StaffFormData } from "@/types"
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
  FormDescription,
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
import { Loader2, Award, Calendar } from "lucide-react"
import { Separator } from "@/components/ui/separator"

const formSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  badge_number: z.string().min(1, "Badge number is required"),
  employee_id: z.string().min(1, "Employee ID is required"),
  rank: z.enum(["Chief", "Captain", "Lieutenant", "Sergeant", "Corporal", "Officer", "Detective", "Civilian", "Other"]),
  status: z.enum(["Active", "Inactive", "On Leave", "Terminated"]),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  hire_date: z.string().min(1, "Hire date is required"),
  department: z.string().optional(),
  meters_certification_date: z.string().optional(),
  notes: z.string().optional(),
})

interface StaffModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff?: StaffMember | null
  onSave: (data: StaffFormData) => Promise<void>
}

// Calculate expiration date (2 years from certification)
function calculateExpirationDate(certDate: string): string {
  if (!certDate) return ""
  const date = new Date(certDate)
  date.setFullYear(date.getFullYear() + 2)
  return date.toISOString().split("T")[0]
}

export function StaffModal({ open, onOpenChange, staff, onSave }: StaffModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      badge_number: "",
      employee_id: "",
      rank: "Officer",
      status: "Active",
      email: "",
      phone: "",
      hire_date: new Date().toISOString().split("T")[0],
      department: "",
      meters_certification_date: "",
      notes: "",
    },
  })

  // Watch the METERS certification date to calculate expiration
  const metersCertDate = form.watch("meters_certification_date")
  const metersExpirationDate = useMemo(() => {
    return calculateExpirationDate(metersCertDate || "")
  }, [metersCertDate])

  useEffect(() => {
    if (open) {
      if (staff) {
        form.reset({
          first_name: staff.first_name,
          last_name: staff.last_name,
          badge_number: staff.badge_number,
          employee_id: staff.employee_id,
          rank: staff.rank,
          status: staff.status,
          email: staff.email || "",
          phone: staff.phone || "",
          hire_date: staff.hire_date,
          department: staff.department || "",
          meters_certification_date: staff.meters_certification_date || "",
          notes: staff.notes || "",
        })
      } else {
        form.reset({
          first_name: "",
          last_name: "",
          badge_number: "",
          employee_id: "",
          rank: "Officer",
          status: "Active",
          email: "",
          phone: "",
          hire_date: new Date().toISOString().split("T")[0],
          department: "",
          meters_certification_date: "",
          notes: "",
        })
      }
    }
  }, [staff, open, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    try {
      // Firestore doesn't accept undefined values, use empty strings for optional fields
      await onSave({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        badge_number: values.badge_number.trim(),
        employee_id: values.employee_id.toUpperCase().trim(),
        rank: values.rank,
        status: values.status,
        email: values.email?.trim() || "",
        phone: values.phone?.trim() || "",
        hire_date: values.hire_date,
        department: values.department?.trim() || "",
        meters_certification_date: values.meters_certification_date || "",
        meters_expiration_date: values.meters_certification_date ? calculateExpirationDate(values.meters_certification_date) : "",
        notes: values.notes?.trim() || "",
      })
      onOpenChange(false)
    } catch {
      // Error handled in parent
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{staff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="badge_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Badge Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee ID *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="EMP001" 
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
              <FormField
                control={form.control}
                name="rank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rank *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Chief">Chief</SelectItem>
                        <SelectItem value="Captain">Captain</SelectItem>
                        <SelectItem value="Lieutenant">Lieutenant</SelectItem>
                        <SelectItem value="Sergeant">Sergeant</SelectItem>
                        <SelectItem value="Corporal">Corporal</SelectItem>
                        <SelectItem value="Detective">Detective</SelectItem>
                        <SelectItem value="Officer">Officer</SelectItem>
                        <SelectItem value="Civilian">Civilian</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="On Leave">On Leave</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john.smith@cheverlypd.gov" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="301-555-0101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="hire_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hire Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department/Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="Patrol" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* METERS Certification Section */}
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">METERS Certification</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="meters_certification_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certification Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Date METERS training was completed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel className="text-muted-foreground">Expiration Date (Auto-calculated)</FormLabel>
                  <div className="flex h-9 w-full items-center rounded-md border px-3 py-1 bg-muted text-muted-foreground text-sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    {metersExpirationDate || "Enter certification date"}
                  </div>
                  <FormDescription className="text-xs">
                    Valid for 2 years from certification
                  </FormDescription>
                </FormItem>
              </div>
            </div>

            <Separator className="my-4" />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes..."
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
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
