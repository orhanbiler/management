"use client"

import { useEffect, useState, Fragment } from "react"
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
  StaffStatus, 
  StaffRank,
  MetersCertStatus,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { StaffModal } from "@/components/staff-modal"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  Search, 
  Filter, 
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
} from "lucide-react"
import { toast } from "sonner"
import { 
  getFirebaseErrorMessage, 
  secureLog 
} from "@/lib/security"

// Status badge variants
const statusVariants: Record<StaffStatus, "default" | "secondary" | "destructive" | "outline"> = {
  "Active": "default",
  "On Leave": "secondary",
  "Inactive": "outline",
  "Terminated": "destructive",
}

const metersStatusVariants: Record<MetersCertStatus, "default" | "secondary" | "destructive" | "outline"> = {
  "Valid": "default",
  "Expiring Soon": "secondary",
  "Expired": "destructive",
  "Not Certified": "outline",
}

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

// Calculate expiration date (2 years from certification)
function calculateExpirationDate(certDate: string): string {
  const date = new Date(certDate)
  date.setFullYear(date.getFullYear() + 2)
  return date.toISOString().split("T")[0]
}

export function StaffDashboard() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [metersFilter, setMetersFilter] = useState<string>("All")
  
  // Sorting State
  const [sortBy, setSortBy] = useState<"last_name" | "badge_number" | "rank" | "status" | "meters_expiration_date">("last_name")
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
    active: staff.filter(s => s.status === "Active").length,
    metersCertified: staff.filter(s => getMetersCertStatus(s) === "Valid").length,
    metersExpiringSoon: staff.filter(s => getMetersCertStatus(s) === "Expiring Soon").length,
    metersExpired: staff.filter(s => getMetersCertStatus(s) === "Expired").length,
    metersNotCertified: staff.filter(s => getMetersCertStatus(s) === "Not Certified").length,
  }

  // Data Fetching
  useEffect(() => {
    if (!db) {
      secureLog("warn", "No Firestore connection. Using mock data.")
      const mockData: StaffMember[] = [
        { 
          id: '1', 
          first_name: 'John', 
          last_name: 'Smith',
          badge_number: '001',
          employee_id: 'EMP001',
          rank: 'Sergeant',
          status: 'Active',
          email: 'jsmith@cheverlypd.gov',
          phone: '301-555-0101',
          hire_date: '2015-03-15',
          department: 'Patrol',
          meters_certification_date: '2024-01-15',
          meters_expiration_date: '2026-01-15',
          notes: 'Field Training Officer'
        },
        { 
          id: '2', 
          first_name: 'Jane', 
          last_name: 'Doe',
          badge_number: '002',
          employee_id: 'EMP002',
          rank: 'Officer',
          status: 'Active',
          hire_date: '2020-06-01',
          department: 'Patrol',
          meters_certification_date: '2023-06-01',
          meters_expiration_date: '2025-06-01',
          notes: ''
        },
      ]
      setStaff(mockData)
      setIsLoading(false)
      return
    }

    const q = query(collection(db, "staff"), orderBy("last_name"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as StaffMember[]
      setStaff(data)
      setIsLoading(false)
    }, (error: FirestoreError) => {
      secureLog("error", "Error fetching staff data", { code: error.code, message: error.message })
      setIsLoading(false)
      
      if (error.code === "permission-denied") {
        toast.error("Permission denied. Deploy Firestore rules with staff collection access.")
      } else {
        const errorMessage = getFirebaseErrorMessage(error)
        toast.error(errorMessage)
      }
    })

    return () => unsubscribe()
  }, [])

  // Filtering & Sorting
  useEffect(() => {
    let result = staff

    if (searchQuery) {
      const q = searchQuery.toUpperCase()
      result = result.filter(item => 
        item.first_name.toUpperCase().includes(q) ||
        item.last_name.toUpperCase().includes(q) ||
        item.badge_number.includes(q) ||
        item.employee_id.toUpperCase().includes(q) ||
        (item.email && item.email.toUpperCase().includes(q))
      )
    }

    if (statusFilter !== "All") {
      result = result.filter(item => item.status === statusFilter)
    }

    if (metersFilter !== "All") {
      result = result.filter(item => getMetersCertStatus(item) === metersFilter)
    }

    // Sorting
    const rankOrder: StaffRank[] = ["Chief", "Captain", "Lieutenant", "Sergeant", "Corporal", "Detective", "Officer", "Civilian", "Other"]
    
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
          aValue = a.meters_expiration_date ? new Date(a.meters_expiration_date).getTime() : 0
          bValue = b.meters_expiration_date ? new Date(b.meters_expiration_date).getTime() : 0
          break
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }
      return sortOrder === "asc" ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number)
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
    if (sortBy !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
    return sortOrder === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />
  }

  // CRUD Operations
  const handleSaveStaff = async (data: StaffFormData) => {
    if (!db) {
      toast.error("Database not initialized")
      return
    }

    const actionId = editingStaff ? `update-${editingStaff.id}` : "create"
    setLoadingActions(prev => new Set(prev).add(actionId))

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
        toast.error("Permission denied. Please check Firestore rules are deployed.")
      } else {
        toast.error(`Failed to save: ${firebaseError?.message || "Unknown error"}`)
      }
      throw error
    } finally {
      setLoadingActions(prev => {
        const next = new Set(prev)
        next.delete(actionId)
        return next
      })
    }
  }

  const handleDeleteStaff = async () => {
    if (!db || !staffToDelete) return

    setLoadingActions(prev => new Set(prev).add(`delete-${staffToDelete.id}`))

    try {
      await deleteDoc(doc(db, "staff", staffToDelete.id))
      toast.success("Staff record deleted")
      setDeleteConfirmOpen(false)
      setStaffToDelete(null)
    } catch (error) {
      secureLog("error", "Error deleting staff", { error })
      toast.error("Failed to delete staff record")
    } finally {
      setLoadingActions(prev => {
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
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-[100px]" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground mt-1">METERS certification tracking</p>
        </div>
        <Button onClick={() => { setEditingStaff(null); setIsStaffModalOpen(true) }}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Staff</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Shield className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.metersCertified}</p>
                <p className="text-xs text-muted-foreground">METERS Valid</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.metersExpiringSoon}</p>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.metersExpired}</p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.metersNotCertified}</p>
                <p className="text-xs text-muted-foreground">Not Certified</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, badge, employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={metersFilter} onValueChange={setMetersFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Award className="h-4 w-4 mr-2" />
                <SelectValue placeholder="METERS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All METERS Status</SelectItem>
                <SelectItem value="Valid">Valid</SelectItem>
                <SelectItem value="Expiring Soon">Expiring Soon</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Not Certified">Not Certified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-semibold hover:bg-transparent"
                      onClick={() => toggleSort("last_name")}
                    >
                      Name {getSortIcon("last_name")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-semibold hover:bg-transparent"
                      onClick={() => toggleSort("badge_number")}
                    >
                      Badge {getSortIcon("badge_number")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-semibold hover:bg-transparent"
                      onClick={() => toggleSort("rank")}
                    >
                      Rank {getSortIcon("rank")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-semibold hover:bg-transparent"
                      onClick={() => toggleSort("status")}
                    >
                      Status {getSortIcon("status")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">METERS Status</TableHead>
                  <TableHead>Certified</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto font-semibold hover:bg-transparent"
                      onClick={() => toggleSort("meters_expiration_date")}
                    >
                      Expires {getSortIcon("meters_expiration_date")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-[200px] text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Users className="h-10 w-10" />
                        <p className="text-lg font-medium">No staff members found</p>
                        <p className="text-sm">Add your first staff member to get started</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((member) => {
                    const metersStatus = getMetersCertStatus(member)
                    
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div>
                            {member.last_name}, {member.first_name}
                            {member.department && (
                              <p className="text-xs text-muted-foreground">{member.department}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{member.badge_number}</TableCell>
                        <TableCell>{member.rank}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariants[member.status]}>
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={metersStatusVariants[metersStatus]}>
                            {metersStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(member.meters_certification_date)}</TableCell>
                        <TableCell>
                          <span className={
                            metersStatus === "Expired" ? "text-red-500 font-medium" : 
                            metersStatus === "Expiring Soon" ? "text-amber-500 font-medium" : ""
                          }>
                            {formatDate(member.meters_expiration_date)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setEditingStaff(member)
                                    setIsStaffModalOpen(true)
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Staff</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-red-500 hover:text-red-600"
                                  onClick={() => {
                                    setStaffToDelete(member)
                                    setDeleteConfirmOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Staff</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
              Are you sure you want to delete {staffToDelete?.first_name} {staffToDelete?.last_name}&apos;s record? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
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
