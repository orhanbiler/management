"use client"

import { useEffect, useState } from "react"
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  FirestoreError
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  StaffMember,
  StaffFormData,
  StaffRank,
  MetersCertStatus
} from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { StaffModal } from "@/components/staff-modal"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  Search,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  UserPlus,
  Shield,
  AlertCircle,
  Award,
  MoreHorizontal
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { getFirebaseErrorMessage, secureLog } from "@/lib/security"

// Helper function to check if date is within 60 days (expiring soon for 2-year cert)
function isExpiringSoon(dateStr?: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const now = new Date()
  const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
  return date <= sixtyDaysFromNow && date >= now
}

// Helper function to check if date is expired
function isExpired(dateStr?: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  return date < new Date()
}

// Get METERS certification status
function getMetersCertStatus(member: StaffMember): MetersCertStatus {
  if (!member.meters_certification_date || !member.meters_expiration_date) {
    return "Not Certified"
  }
  if (isExpired(member.meters_expiration_date)) {
    return "Expired"
  }
  if (isExpiringSoon(member.meters_expiration_date)) {
    return "Expiring Soon"
  }
  return "Valid"
}

// Helper function to format date
function formatDate(dateStr?: string): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}

export function StaffDashboard() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [metersFilter, setMetersFilter] = useState<string>("All")

  // Sorting State
  const [sortBy, setSortBy] = useState<
    "last_name" | "badge_number" | "rank" | "status" | "meters_expiration_date"
  >("last_name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  // Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null)

  // Loading States
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set())

  // Calculate stats
  const stats = {
    total: staff.length,
    active: staff.filter((s) => s.status === "Active").length,
    metersCertified: staff.filter((s) => getMetersCertStatus(s) === "Valid")
      .length,
    metersExpiringSoon: staff.filter(
      (s) => getMetersCertStatus(s) === "Expiring Soon"
    ).length,
    metersExpired: staff.filter((s) => getMetersCertStatus(s) === "Expired")
      .length,
    metersNotCertified: staff.filter(
      (s) => getMetersCertStatus(s) === "Not Certified"
    ).length
  }

  // Data Fetching
  useEffect(() => {
    if (!db) {
      secureLog("warn", "No Firestore connection. Using mock data.")
      const mockData: StaffMember[] = [
        {
          id: "1",
          first_name: "John",
          last_name: "Smith",
          badge_number: "001",
          employee_id: "EMP001",
          rank: "Sergeant",
          status: "Active",
          email: "jsmith@cheverlypd.gov",
          phone: "301-555-0101",
          hire_date: "2015-03-15",
          department: "Patrol",
          meters_certification_date: "2024-01-15",
          meters_expiration_date: "2026-01-15",
          notes: "Field Training Officer"
        },
        {
          id: "2",
          first_name: "Jane",
          last_name: "Doe",
          badge_number: "002",
          employee_id: "EMP002",
          rank: "Officer",
          status: "Active",
          hire_date: "2020-06-01",
          department: "Patrol",
          meters_certification_date: "2023-06-01",
          meters_expiration_date: "2025-06-01",
          notes: ""
        }
      ]
      setStaff(mockData)
      setIsLoading(false)
      return
    }

    const q = query(collection(db, "staff"), orderBy("last_name"))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as StaffMember[]
        setStaff(data)
        setLoadError("")
        setIsLoading(false)
      },
      (error: FirestoreError) => {
        secureLog("error", "Error fetching staff data", {
          code: error.code,
          message: error.message
        })
        setIsLoading(false)

        setLoadError(getFirebaseErrorMessage(error))
        if (error.code === "permission-denied") {
          toast.error(
            "Permission denied. Deploy Firestore rules with staff collection access."
          )
        } else {
          const errorMessage = getFirebaseErrorMessage(error)
          toast.error(errorMessage)
        }
      }
    )

    return () => unsubscribe()
  }, [])

  // Filtering & Sorting
  useEffect(() => {
    let result = staff

    if (searchQuery) {
      const q = searchQuery.toUpperCase()
      result = result.filter(
        (item) =>
          item.first_name.toUpperCase().includes(q) ||
          item.last_name.toUpperCase().includes(q) ||
          item.badge_number.includes(q) ||
          item.employee_id.toUpperCase().includes(q) ||
          (item.email && item.email.toUpperCase().includes(q))
      )
    }

    if (statusFilter !== "All") {
      result = result.filter((item) => item.status === statusFilter)
    }

    if (metersFilter !== "All") {
      result = result.filter(
        (item) => getMetersCertStatus(item) === metersFilter
      )
    }

    // Sorting
    const rankOrder: StaffRank[] = [
      "Chief",
      "Captain",
      "Lieutenant",
      "Sergeant",
      "Corporal",
      "Detective",
      "Officer",
      "Civilian",
      "Other"
    ]

    result = [...result].sort((a, b) => {
      let aValue: string | number = ""
      let bValue: string | number = ""

      switch (sortBy) {
        case "last_name":
          aValue = a.last_name.toUpperCase()
          bValue = b.last_name.toUpperCase()
          break
        case "badge_number":
          aValue = parseInt(a.badge_number) || 0
          bValue = parseInt(b.badge_number) || 0
          break
        case "rank":
          aValue = rankOrder.indexOf(a.rank)
          bValue = rankOrder.indexOf(b.rank)
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        case "meters_expiration_date":
          aValue = a.meters_expiration_date
            ? new Date(a.meters_expiration_date).getTime()
            : 0
          bValue = b.meters_expiration_date
            ? new Date(b.meters_expiration_date).getTime()
            : 0
          break
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      return sortOrder === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })

    setFilteredStaff(result)
  }, [staff, searchQuery, statusFilter, metersFilter, sortBy, sortOrder])

  // Toggle sort
  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const getSortIcon = (field: typeof sortBy) => {
    if (sortBy !== field)
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    )
  }

  // CRUD Operations
  const handleSaveStaff = async (data: StaffFormData) => {
    if (!db) {
      toast.error("Database not initialized")
      return
    }

    const actionId = editingStaff ? `update-${editingStaff.id}` : "create"
    setLoadingActions((prev) => new Set(prev).add(actionId))

    try {
      if (editingStaff) {
        await updateDoc(doc(db, "staff", editingStaff.id), {
          ...data,
          updated_at: new Date().toISOString()
        })
        toast.success("Staff record updated")
      } else {
        await addDoc(collection(db, "staff"), {
          ...data,
          updated_at: new Date().toISOString()
        })
        toast.success("Staff member added")
      }
      setIsStaffModalOpen(false)
      setEditingStaff(null)
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string }
      secureLog("error", "Error saving staff", {
        code: firebaseError?.code,
        message: firebaseError?.message
      })

      // Show specific error message
      if (firebaseError?.code === "permission-denied") {
        toast.error(
          "Permission denied. Please check Firestore rules are deployed."
        )
      } else {
        toast.error(
          `Failed to save: ${firebaseError?.message || "Unknown error"}`
        )
      }
      throw error
    } finally {
      setLoadingActions((prev) => {
        const next = new Set(prev)
        next.delete(actionId)
        return next
      })
    }
  }

  const handleDeleteStaff = async () => {
    if (!db || !staffToDelete) return

    setLoadingActions((prev) => new Set(prev).add(`delete-${staffToDelete.id}`))

    try {
      await deleteDoc(doc(db, "staff", staffToDelete.id))
      toast.success("Staff record deleted")
      setDeleteConfirmOpen(false)
      setStaffToDelete(null)
    } catch (error) {
      secureLog("error", "Error deleting staff", { error })
      toast.error("Failed to delete staff record")
    } finally {
      setLoadingActions((prev) => {
        const next = new Set(prev)
        next.delete(`delete-${staffToDelete.id}`)
        return next
      })
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-10 w-[120px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[100px]" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-heading">
        <div>
          <p className="eyebrow">People & readiness</p>
          <h1 className="page-title">Staff directory</h1>
          <p className="page-description">
            Keep your team organized and certifications up to date.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingStaff(null)
            setIsStaffModalOpen(true)
          }}
        >
          <UserPlus />
          Add staff
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Total staff", value: stats.total, icon: Users },
          { label: "Active", value: stats.active, icon: Shield },
          {
            label: "METERS valid",
            value: stats.metersCertified,
            icon: CheckCircle2
          },
          {
            label: "Expiring soon",
            value: stats.metersExpiringSoon,
            icon: Clock
          },
          { label: "Expired", value: stats.metersExpired, icon: XCircle },
          {
            label: "Not certified",
            value: stats.metersNotCertified,
            icon: AlertCircle
          }
        ].map(({ label, value, icon: Icon }) => (
          <div className="metric-card" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <Icon className="size-3.5 shrink-0" />
            </div>
            <div className="metric-value">
              {value.toString().padStart(2, "0")}
            </div>
          </div>
        ))}
      </div>
      <section className="surface" aria-label="Staff records">
        <div className="flex items-center gap-2 px-5 pt-5">
          <h2 className="section-title">Your people</h2>
          <span className="tab-count">{staff.length}</span>
        </div>
        <div className="filter-tabs" aria-label="Filter staff by status">
          {["All", "Active", "On Leave", "Inactive", "Terminated"].map(
            (status) => (
              <button
                key={status}
                className="filter-tab"
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {status === "All" ? "All staff" : status}
              </button>
            )
          )}
        </div>
        <div className="table-toolbar">
          <div className="search-field">
            <Search />
            <Input
              className="h-10 pl-9 text-sm"
              aria-label="Search staff"
              placeholder="Search name, badge, or employee ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={metersFilter} onValueChange={setMetersFilter}>
              <SelectTrigger
                aria-label="Filter by METERS certification"
                className="h-10! w-[186px] text-xs"
              >
                <Award className="size-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All METERS statuses</SelectItem>
                {["Valid", "Expiring Soon", "Expired", "Not Certified"].map(
                  (status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            {(searchQuery ||
              statusFilter !== "All" ||
              metersFilter !== "All") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("All")
                  setMetersFilter("All")
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
        <div className="flex justify-end border-b px-4 py-2 lg:hidden">
          <Select
            value={sortBy}
            onValueChange={(value) => toggleSort(value as typeof sortBy)}
          >
            <SelectTrigger
              aria-label="Sort staff"
              className="w-[190px] text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_name">Name</SelectItem>
              <SelectItem value="badge_number">Badge</SelectItem>
              <SelectItem value="rank">Rank</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="meters_expiration_date">
                Certification expiry
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              sortOrder === "asc" ? "Sort descending" : "Sort ascending"
            }
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            {sortOrder === "asc" ? <ArrowUp /> : <ArrowDown />}
          </Button>
        </div>
        {loadError && (
          <div
            role="alert"
            className="border-b bg-destructive/5 p-4 text-sm text-destructive"
          >
            {loadError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="inventory-table">
            <caption className="sr-only">
              Staff directory and METERS certifications
            </caption>
            <thead>
              <tr>
                {(
                  [
                    ["last_name", "Staff member"],
                    ["badge_number", "Badge / ID"],
                    ["rank", "Rank"],
                    ["status", "Status"]
                  ] as const
                ).map(([field, label]) => (
                  <th
                    key={field}
                    aria-sort={
                      sortBy === field
                        ? sortOrder === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      className="sort-button"
                      onClick={() => toggleSort(field)}
                    >
                      {label}
                      {getSortIcon(field)}
                    </button>
                  </th>
                ))}
                <th
                  aria-sort={
                    sortBy === "meters_expiration_date"
                      ? sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    className="sort-button"
                    onClick={() => toggleSort("meters_expiration_date")}
                  >
                    METERS certification{getSortIcon("meters_expiration_date")}
                  </button>
                </th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-empty">
                    <div className="empty-state">
                      <Users className="size-8 text-muted-foreground/50" />
                      <h3 className="text-sm font-semibold">
                        {loadError
                          ? "Staff directory unavailable"
                          : "No staff members to show"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {loadError
                          ? "Refresh the page to try again."
                          : "Try adjusting your filters or add a staff member to get started."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const metersStatus = getMetersCertStatus(member)
                  return (
                    <tr key={member.id}>
                      <td className="cell-device">
                        <button
                          className="flex items-center gap-3 text-left"
                          onClick={() => {
                            setEditingStaff(member)
                            setIsStaffModalOpen(true)
                          }}
                        >
                          <span className="avatar size-9!">
                            {member.first_name[0]}
                            {member.last_name[0]}
                          </span>
                          <span>
                            <span className="font-semibold">
                              {member.first_name} {member.last_name}
                            </span>
                            <span className="mt-1 block text-[10px] text-muted-foreground">
                              {member.department || "Department not recorded"}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td
                        className="cell-detail"
                        data-label="Badge / employee ID"
                      >
                        <span className="font-mono text-[11px]">
                          #{member.badge_number}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {member.employee_id}
                        </span>
                      </td>
                      <td className="cell-status" data-label="Rank">
                        {member.rank}
                      </td>
                      <td className="cell-detail" data-label="Employment">
                        <span
                          className={`status-pill status-${member.status.toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td
                        className="cell-status"
                        data-label="METERS certification"
                      >
                        <span
                          className={`status-pill status-${metersStatus.toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {metersStatus}
                        </span>
                        <p className="mt-1.5 text-[10px] text-muted-foreground">
                          Expires {formatDate(member.meters_expiration_date)}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Certified{" "}
                          {formatDate(member.meters_certification_date)}
                        </p>
                      </td>
                      <td className="cell-actions">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${member.first_name} ${member.last_name}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingStaff(member)
                                setIsStaffModalOpen(true)
                              }}
                            >
                              <Edit />
                              Edit staff member
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setStaffToDelete(member)
                                setDeleteConfirmOpen(true)
                              }}
                            >
                              <Trash2 />
                              Delete staff member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span aria-live="polite">
            Showing {filteredStaff.length} of {staff.length} staff members
          </span>
          <span>METERS renewal every 2 years</span>
        </div>
      </section>
      <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        <Shield className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-medium text-foreground">
            Stay ahead of renewals.
          </span>{" "}
          Certifications are marked as expiring soon within 60 days of their
          expiration date.
        </p>
      </div>
      {/* Modals */}
      <StaffModal
        open={isStaffModalOpen}
        onOpenChange={setIsStaffModalOpen}
        staff={editingStaff}
        onSave={handleSaveStaff}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Staff Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {staffToDelete?.first_name}{" "}
              {staffToDelete?.last_name}&apos;s record? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteStaff}
              disabled={loadingActions.has(`delete-${staffToDelete?.id}`)}
            >
              {loadingActions.has(`delete-${staffToDelete?.id}`) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
