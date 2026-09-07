"use client"

import { useEffect, useState } from "react"
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  writeBatch,
  FirestoreError
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Device, DeviceFormData } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { DeviceModal } from "@/components/device-modal"
import { EmailModal } from "@/components/email-modal"
import { PidComparisonModal } from "@/components/pid-comparison-modal"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { calculateExpectedPid, isPidMismatch } from "@/lib/utils"
import {
  Plus,
  Search,
  Filter,
  Edit,
  FileSignature,
  Send,
  AlertTriangle,
  Inbox,
  FileX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  FileSearch,
  FileDown,
  Laptop,
  CheckCircle2,
  Clock,
  Building2,
  ShieldCheck,
  Users,
  MoreHorizontal,
  Monitor,
  Boxes,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { generatePDF, generateDeviceListPDF } from "@/lib/pdf-generator"
import {
  getFirebaseErrorMessage,
  secureLog,
  sanitizeAlphanumeric
} from "@/lib/security"

export function InventoryDashboard() {
  const [inventory, setInventory] = useState<Device[]>([])
  const [filteredInventory, setFilteredInventory] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [pidRegisteredFilter, setPidRegisteredFilter] = useState<string>("All")
  const [showRetired, setShowRetired] = useState(false)

  // Sorting State
  const [sortBy, setSortBy] = useState<
    "asset_id" | "serial_number" | "pid_number" | "officer" | "status"
  >("asset_id")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Modal State
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [emailData, setEmailData] = useState({
    subject: "",
    body: "",
    warning: "",
    recipient: ""
  })

  const [isPidComparisonModalOpen, setIsPidComparisonModalOpen] =
    useState(false)

  // Bulk ORI Edit State
  const [isBulkOriEditOpen, setIsBulkOriEditOpen] = useState(false)
  const [bulkOriValue, setBulkOriValue] = useState("")

  // Bulk Selection State
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())

  // Loading States
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set())

  // Data Fetching
  useEffect(() => {
    if (!db) {
      // Mock Data Mode - for development/testing only
      secureLog("warn", "No Firestore connection. Using mock data.")
      const mockData: Device[] = [
        {
          id: "1",
          serial_number: "3ITTA13927",
          pid_number: "Z100A13927",
          asset_id: "TB-1",
          device_type: "Toughbook",
          status: "Assigned",
          officer: "SGT. BILER",
          assignment_date: "2024-07-31",
          notes: "Test unit"
        },
        {
          id: "2",
          serial_number: "4GTTA99999",
          pid_number: "OLD_PID_123",
          asset_id: "TB-2",
          device_type: "Toughbook",
          status: "Unassigned",
          officer: "",
          assignment_date: "",
          notes: "Legacy PID mismatch example"
        }
      ]
      setInventory(mockData)
      setIsLoading(false)
      return
    }

    const q = query(collection(db, "toughbooks"), orderBy("serial_number"))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as Device[]
        setInventory(data)
        setLoadError("")
        setIsLoading(false)
      },
      (error: FirestoreError) => {
        secureLog("error", "Error fetching inventory data", {
          code: error.code
        })
        setIsLoading(false)

        // Use secure error messaging
        const errorMessage = getFirebaseErrorMessage(error)
        setLoadError(errorMessage)
        toast.error(errorMessage)
      }
    )

    return () => unsubscribe()
  }, [])

  // Helper function to extract numeric value from Asset ID (TB-1 -> 1, TB-2 -> 2, etc.)
  const getAssetIdNumber = (assetId: string): number => {
    if (!assetId) return 0
    const match = assetId.match(/(\d+)$/)
    return match ? parseInt(match[1], 10) : 0
  }

  // Filtering & Sorting
  useEffect(() => {
    let result = inventory

    // Hide retired devices by default unless showRetired is checked
    // This includes both status "Retired" AND devices marked "to_be_retired"
    if (!showRetired && statusFilter !== "Retired") {
      result = result.filter(
        (item) => item.status !== "Retired" && !item.to_be_retired
      )
    }

    if (searchQuery) {
      const q = searchQuery.toUpperCase()
      result = result.filter(
        (item) =>
          (item.serial_number || "").toUpperCase().includes(q) ||
          (item.pid_number || "").toUpperCase().includes(q) ||
          (item.asset_id && item.asset_id.toUpperCase().includes(q)) ||
          (item.ori_number && item.ori_number.toUpperCase().includes(q)) ||
          (item.officer && item.officer.toUpperCase().includes(q))
      )
    }

    if (statusFilter !== "All") {
      result = result.filter((item) => item.status === statusFilter)
    }

    if (pidRegisteredFilter !== "All") {
      if (pidRegisteredFilter === "Registered") {
        result = result.filter((item) => item.pid_registered === true)
      } else if (pidRegisteredFilter === "Not Registered") {
        result = result.filter((item) => item.pid_registered !== true)
      }
    }

    // Sorting
    result = [...result].sort((a, b) => {
      let aValue: string | number = ""
      let bValue: string | number = ""

      if (sortBy === "asset_id") {
        // Special handling for Asset ID: extract numeric value for proper sorting
        aValue = getAssetIdNumber(a.asset_id || "")
        bValue = getAssetIdNumber(b.asset_id || "")
      } else if (sortBy === "serial_number") {
        aValue = a.serial_number || ""
        bValue = b.serial_number || ""
      } else if (sortBy === "pid_number") {
        aValue = a.pid_number || ""
        bValue = b.pid_number || ""
      } else if (sortBy === "officer") {
        aValue = a.officer || ""
        bValue = b.officer || ""
      } else if (sortBy === "status") {
        aValue = a.status || ""
        bValue = b.status || ""
      }

      // Handle empty values - put them at the end
      if (!aValue && bValue) return 1
      if (aValue && !bValue) return -1
      if (!aValue && !bValue) return 0

      // Compare values
      let comparison = 0
      if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue
      } else {
        comparison = String(aValue).localeCompare(String(bValue))
      }

      return sortOrder === "asc" ? comparison : -comparison
    })

    setFilteredInventory(result)

    // Clear selections if filtered devices don't include selected ones
    setSelectedDevices((prev) => {
      const resultIds = new Set(result.map((d) => d.id))
      const newSet = new Set<string>()
      prev.forEach((id) => {
        if (resultIds.has(id)) {
          newSet.add(id)
        }
      })
      return newSet
    })
  }, [
    inventory,
    searchQuery,
    statusFilter,
    pidRegisteredFilter,
    showRetired,
    sortBy,
    sortOrder
  ])

  // Handle column header click for sorting
  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortOrder("desc")
    }
  }

  // Actions
  const handleSaveDevice = async (data: DeviceFormData) => {
    try {
      // Check for duplicate serial number when adding new device
      if (!editingDevice) {
        // Only check serial number duplicate if serial number is provided
        if (data.serial_number && data.serial_number.trim()) {
          const normalizedSerial = data.serial_number.toUpperCase().trim()
          const duplicate = inventory.find(
            (device) =>
              device.serial_number &&
              device.serial_number.toUpperCase().trim() === normalizedSerial
          )

          if (duplicate) {
            const error = new Error(
              `Device with serial number "${normalizedSerial}" already exists`
            )
            throw error
          }
        }

        // Only check PID number duplicate if PID number is provided
        if (data.pid_number && data.pid_number.trim()) {
          const normalizedPid = data.pid_number.toUpperCase().trim()
          const duplicate = inventory.find(
            (device) =>
              device.pid_number &&
              device.pid_number.toUpperCase().trim() === normalizedPid
          )

          if (duplicate) {
            const error = new Error(
              `Device with PID number "${normalizedPid}" already exists`
            )
            throw error
          }
        }
      } else {
        // When editing, check if serial number conflicts with another device
        if (data.serial_number && data.serial_number.trim()) {
          const normalizedSerial = data.serial_number.toUpperCase().trim()
          const duplicate = inventory.find(
            (device) =>
              device.id !== editingDevice.id &&
              device.serial_number &&
              device.serial_number.toUpperCase().trim() === normalizedSerial
          )

          if (duplicate) {
            const error = new Error(
              `Another device with serial number "${normalizedSerial}" already exists`
            )
            throw error
          }
        }

        // When editing, check if PID number conflicts with another device
        if (data.pid_number && data.pid_number.trim()) {
          const normalizedPid = data.pid_number.toUpperCase().trim()
          const duplicate = inventory.find(
            (device) =>
              device.id !== editingDevice.id &&
              device.pid_number &&
              device.pid_number.toUpperCase().trim() === normalizedPid
          )

          if (duplicate) {
            const error = new Error(
              `Another device with PID number "${normalizedPid}" already exists`
            )
            throw error
          }
        }
      }

      const payload = {
        ...data,
        updated_at: new Date().toISOString()
      }

      if (editingDevice) {
        if (db) {
          await updateDoc(doc(db, "toughbooks", editingDevice.id), payload)
          toast.success("Device updated successfully")
        } else {
          // Mock Update
          setInventory((prev) =>
            prev.map((i) =>
              i.id === editingDevice.id ? { ...i, ...payload } : i
            )
          )
          toast.success("Device updated successfully")
        }
      } else {
        if (db) {
          await addDoc(collection(db, "toughbooks"), payload)
          toast.success("Device added successfully")
        } else {
          // Mock Add
          setInventory((prev) => [
            ...prev,
            { id: Date.now().toString(), ...payload }
          ])
          toast.success("Device added successfully")
        }
      }
      setIsDeviceModalOpen(false)
      setEditingDevice(null)
    } catch (error: unknown) {
      // Log error details for debugging
      const firebaseError = error as { code?: string; message?: string }
      secureLog("error", "Save device error", {
        isEdit: !!editingDevice,
        errorCode: firebaseError?.code || "unknown",
        errorMessage: firebaseError?.message || String(error)
      })

      // Use secure error messaging
      if (firebaseError?.message && !firebaseError?.code) {
        // Custom validation error
        toast.error(firebaseError.message)
      } else {
        const errorMessage = getFirebaseErrorMessage(firebaseError)
        toast.error(errorMessage)
      }
    }
  }

  const handleEdit = (device: Device) => {
    setEditingDevice(device)
    setIsDeviceModalOpen(true)
  }

  const handleAddNew = () => {
    setEditingDevice(null)
    setIsDeviceModalOpen(true)
  }

  const handleBulkAddDevices = async (devices: DeviceFormData[]) => {
    if (devices.length === 0) {
      toast.error("No devices to add")
      return
    }

    try {
      if (db) {
        // Use Firestore Batch for atomic and faster writes
        const collectionRef = collection(db, "toughbooks")

        // Firestore batches are limited to 500 operations
        const CHUNK_SIZE = 450
        const chunks = []

        for (let i = 0; i < devices.length; i += CHUNK_SIZE) {
          chunks.push(devices.slice(i, i + CHUNK_SIZE))
        }

        let successCount = 0

        for (const chunk of chunks) {
          const chunkBatch = writeBatch(db)

          chunk.forEach((deviceData) => {
            const docRef = doc(collectionRef) // Generate new ID
            const payload = {
              ...deviceData,
              updated_at: new Date().toISOString()
            }
            chunkBatch.set(docRef, payload)
            successCount++
          })

          await chunkBatch.commit()
        }

        toast.success(`Successfully added ${successCount} device(s)`)
      } else {
        // Mock Add
        const newDevices = devices.map((d) => ({
          id: Date.now().toString() + Math.random(),
          ...d,
          updated_at: new Date().toISOString()
        }))
        setInventory((prev) => [...prev, ...newDevices])
        toast.success(`Successfully added ${newDevices.length} device(s)`)
      }
    } catch (error: unknown) {
      secureLog("error", "Bulk add error")
      const firebaseError = error as { code?: string; message?: string }
      const errorMessage = getFirebaseErrorMessage(firebaseError)
      toast.error(`Failed to add devices: ${errorMessage}`)
      throw error
    }
  }

  // Email Logic
  const handleCapwinEmail = (device: Device) => {
    try {
      if (!device.serial_number || !device.pid_number) {
        toast.error("Device information is incomplete")
        return
      }

      setLoadingActions((prev) => new Set(prev).add(`capwin-${device.id}`))
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
      const subject = `New Device PID Registration: ${device.pid_number} / ${device.serial_number}`

      const expectedPid = `Z100A${device.serial_number.slice(-5)}`
      const body =
        `${today}\n\n` +
        `CSO Dean Rohan, CSO Diana Riley\n` +
        `Maryland State Police\n` +
        `1201 Reisterstown Road\n` +
        `Pikesville, MD 21208\n\n` +
        `Subject: Request PID registration\n\n` +
        `To Whom It May Concern,\n\n` +
        `Could you please register the below PID for Cap Win connection. It will be utilized by authorized personnel.\n\n` +
        `Agency ORI: MD0170500\n` +
        `Server: CAPWIN1\n` +
        `Domain: Z100\n` +
        `Serial Number: ${device.serial_number}\n` +
        `MDT ORI: MD0170501\n\n` +
        `Note: PID Format: The PID is derived from the serial number by replacing the first 4 characters with the Domain "Z100" followed by the remaining serial numbers. (e.g., ${device.serial_number} becomes ${expectedPid})\n\n` +
        `If you should have any questions or concerns pertaining to this request, please contact me at 301-341-1055.\n\n` +
        `Sincerely,\n\n` +
        `Orhan Biler\n` +
        `Sergeant\n` +
        `Cheverly Police Department\n` +
        `6401 Forest Road |Cheverly, MD 20785\n` +
        `Office 301-341-1055 / Fax 301-341-0176`

      setEmailData({ subject, body, warning: "", recipient: "" })
      setIsEmailModalOpen(true)
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete(`capwin-${device.id}`)
        return newSet
      })
    } catch {
      secureLog("error", "Error generating CAPWIN email")
      toast.error("Failed to generate email. Please try again.")
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete(`capwin-${device.id}`)
        return newSet
      })
    }
  }

  const handleOfficerEmail = (device: Device) => {
    try {
      if (!device.serial_number || !device.pid_number) {
        toast.error("Device information is incomplete")
        return
      }

      setLoadingActions((prev) => new Set(prev).add(`officer-${device.id}`))
      const last4 = device.serial_number.slice(-4)
      const deviceType = device.device_type || "Toughbook"
      const subject = `${deviceType} Assignment Notification: Unit ${last4}`

      let warning = ""
      if (device.status !== "Assigned") {
        warning = "WARNING: This device is currently NOT marked as 'Assigned'."
      }

      const body =
        `${warning ? warning + "\n\n" : ""}Your new ${deviceType} has been provisioned. Your system PID is: ${device.pid_number}.\n` +
        `Please ensure the CAPWIN software launches correctly using this ID.\n` +
        `If you encounter any issues, please contact the IT help desk at 301-341-1055.`

      // Email Guessing Logic
      let emailTo = ""
      if (device.officer) {
        let cleanName = device.officer
          .replace(/^(SGT|OFF|CPT|LT|CHIEF|DET)\.?\s*/i, "")
          .trim()
        cleanName = cleanName.replace(/\s+/g, ".").toLowerCase()
        emailTo = `${cleanName}@cpd.md.gov`
      }

      setEmailData({ subject, body, warning, recipient: emailTo })
      setIsEmailModalOpen(true)
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete(`officer-${device.id}`)
        return newSet
      })
    } catch {
      secureLog("error", "Error generating officer email")
      toast.error("Failed to generate email. Please try again.")
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete(`officer-${device.id}`)
        return newSet
      })
    }
  }

  // Bulk Selection Handlers
  const handleSelectDevice = (deviceId: string) => {
    setSelectedDevices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId)
      } else {
        newSet.add(deviceId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedDevices.size === filteredInventory.length) {
      setSelectedDevices(new Set())
    } else {
      setSelectedDevices(new Set(filteredInventory.map((d) => d.id)))
    }
  }

  // Bulk Email Generation
  const handleBulkCapwinEmail = () => {
    try {
      if (selectedDevices.size === 0) {
        toast.error("Please select at least one device")
        return
      }
      setLoadingActions((prev) => new Set(prev).add("bulk-capwin"))

      const selectedDeviceList = filteredInventory.filter((d) =>
        selectedDevices.has(d.id)
      )

      if (selectedDeviceList.length === 0) {
        toast.error("No valid devices selected")
        setLoadingActions((prev) => {
          const newSet = new Set(prev)
          newSet.delete("bulk-capwin")
          return newSet
        })
        return
      }

      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
      const subject = `Bulk Device PID Registration Request`

      let deviceList = ""
      selectedDeviceList.forEach((device, index) => {
        deviceList += `${index + 1}. Server: CAPWIN1 | Domain: Z100 | Serial Number: ${device.serial_number} | MDT ORI: MD0170501\n`
      })

      const body =
        `${today}\n\n` +
        `CSO Dean Rohan, CSO Diana Riley\n` +
        `Maryland State Police\n` +
        `1201 Reisterstown Road\n` +
        `Pikesville, MD 21208\n\n` +
        `Subject: Request PID registration\n\n` +
        `To Whom It May Concern,\n\n` +
        `Could you please register the below PIDs for Cap Win connection. They will be utilized by authorized personnel.\n\n` +
        `Agency ORI: MD0170500\n\n` +
        `${deviceList}\n` +
        `Note: PID Format: Each PID is derived from the serial number by replacing the first 4 characters with the Domain "Z100" followed by the remaining serial numbers. For example, serial number 3ITTA14787 becomes Z100A14787.\n\n` +
        `If you should have any questions or concerns pertaining to this request, please contact me at 301-341-1055.\n\n` +
        `Sincerely,\n\n` +
        `Orhan Biler\n` +
        `Sergeant\n` +
        `Cheverly Police Department\n` +
        `6401 Forest Road |Cheverly, MD 20785\n` +
        `Office 301-341-1055 / Fax 301-341-0176`

      setEmailData({ subject, body, warning: "", recipient: "" })
      setIsEmailModalOpen(true)
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete("bulk-capwin")
        return newSet
      })
    } catch {
      secureLog("error", "Error generating bulk CAPWIN email")
      toast.error("Failed to generate email. Please try again.")
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete("bulk-capwin")
        return newSet
      })
    }
  }

  const handleBulkOfficerEmail = () => {
    try {
      if (selectedDevices.size === 0) {
        toast.error("Please select at least one device")
        return
      }
      setLoadingActions((prev) => new Set(prev).add("bulk-officer"))

      const selectedDeviceList = filteredInventory.filter((d) =>
        selectedDevices.has(d.id)
      )

      if (selectedDeviceList.length === 0) {
        toast.error("No valid devices selected")
        setLoadingActions((prev) => {
          const newSet = new Set(prev)
          newSet.delete("bulk-officer")
          return newSet
        })
        return
      }

      const assignedDevices = selectedDeviceList.filter(
        (d) => d.status === "Assigned" && d.officer
      )

      if (assignedDevices.length === 0) {
        toast.error(
          "No assigned devices selected. Please select devices that are assigned to officers."
        )
        setLoadingActions((prev) => {
          const newSet = new Set(prev)
          newSet.delete("bulk-officer")
          return newSet
        })
        return
      }

      // Group by officer email
      const devicesByOfficer = new Map<string, Device[]>()
      assignedDevices.forEach((device) => {
        let cleanName = device.officer
          .replace(/^(SGT|OFF|CPT|LT|CHIEF|DET)\.?\s*/i, "")
          .trim()
        cleanName = cleanName.replace(/\s+/g, ".").toLowerCase()
        const emailTo = `${cleanName}@cpd.md.gov`

        if (!devicesByOfficer.has(emailTo)) {
          devicesByOfficer.set(emailTo, [])
        }
        devicesByOfficer.get(emailTo)!.push(device)
      })

      // Generate email for first officer (for bulk, we'll show one example)
      // In a real scenario, you might want to generate separate emails for each officer
      const firstOfficer = Array.from(devicesByOfficer.keys())[0]
      const devices = devicesByOfficer.get(firstOfficer)!
      const device = devices[0]

      const deviceType = device.device_type || "Toughbook"
      const subject = `Bulk ${deviceType} Assignment Notification`

      let deviceList = ""
      devices.forEach((d, index) => {
        const last4 = d.serial_number.slice(-4)
        deviceList += `${index + 1}. Unit ${last4} - PID: ${d.pid_number}\n`
      })

      const body =
        `Your new ${deviceType}(s) have been provisioned. Details below:\n\n` +
        `${deviceList}\n` +
        `Please ensure the CAPWIN software launches correctly using these IDs.\n` +
        `If you encounter any issues, please contact the IT help desk at 301-341-1055.`

      setEmailData({
        subject,
        body,
        warning:
          devices.length !== selectedDeviceList.length
            ? `Note: Only ${devices.length} of ${selectedDeviceList.length} selected devices are assigned to officers.`
            : "",
        recipient: firstOfficer
      })
      setIsEmailModalOpen(true)
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete("bulk-officer")
        return newSet
      })
    } catch {
      secureLog("error", "Error generating bulk officer email")
      toast.error("Failed to generate email. Please try again.")
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete("bulk-officer")
        return newSet
      })
    }
  }

  // Individual PID Deactivation PDF
  const handleDeactivationPDF = async (device: Device) => {
    setLoadingActions((prev) => new Set(prev).add(`deactivate-${device.id}`))
    try {
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
      const subject = `PID Deactivation Request: ${device.pid_number} / ${device.serial_number}`

      const body =
        `${today}\n\n` +
        `CSO Dean Rohan, CSO Diana Riley\n` +
        `Maryland State Police\n` +
        `1201 Reisterstown Road\n` +
        `Pikesville, MD 21208\n\n` +
        `Subject: Request PID deactivation\n\n` +
        `To Whom It May Concern,\n\n` +
        `Could you please deactivate the below PID for Cap Win connection.\n\n` +
        `Agency ORI: MD0170500\n` +
        `Server: CAPWIN1\n` +
        `Serial Number: ${device.serial_number}\n` +
        `PID: ${device.pid_number}\n` +
        `MDT ORI: MD0170501\n\n` +
        `If you should have any questions or concerns pertaining to this request, please contact me at 301-341-1055.\n\n` +
        `Sincerely,\n\n` +
        `Orhan Biler\n` +
        `Sergeant\n` +
        `Cheverly Police Department\n` +
        `6401 Forest Road |Cheverly, MD 20785\n` +
        `Office 301-341-1055 / Fax 301-341-0176`

      if (!device.serial_number || !device.pid_number) {
        throw new Error("Device information is incomplete")
      }

      const filename = `pid_deactivation_${device.pid_number}_${device.serial_number}.pdf`
      await generatePDF({ subject, body, warning: "" }, filename)
      toast.success("Deactivation PDF downloaded successfully")
    } catch (error: unknown) {
      secureLog("error", "Error generating deactivation PDF")
      const errorObj = error as { message?: string }
      toast.error(
        errorObj?.message
          ? `Failed to generate PDF: ${errorObj.message}`
          : "Failed to generate PDF. Please try again."
      )
    } finally {
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete(`deactivate-${device.id}`)
        return newSet
      })
    }
  }

  // Bulk ORI Number Edit
  const handleBulkOriEdit = async () => {
    if (selectedDevices.size === 0) {
      toast.error("Please select at least one device")
      return
    }

    setIsBulkOriEditOpen(true)
  }

  const handleBulkOriSave = async () => {
    if (selectedDevices.size === 0) {
      toast.error("Please select at least one device")
      return
    }

    if (!db) {
      toast.error("Database not initialized")
      return
    }

    setLoadingActions((prev) => new Set(prev).add("bulk-ori"))

    try {
      const selectedDeviceList = filteredInventory.filter((d) =>
        selectedDevices.has(d.id)
      )

      if (selectedDeviceList.length === 0) {
        toast.error("No valid devices selected")
        setLoadingActions((prev) => {
          const newSet = new Set(prev)
          newSet.delete("bulk-ori")
          return newSet
        })
        return
      }

      // Sanitize ORI number - allow alphanumeric and keep it uppercase
      const trimmedValue = bulkOriValue.trim()
      const sanitizedOri = trimmedValue
        ? sanitizeAlphanumeric(trimmedValue.toUpperCase())
        : ""

      // Use batch write for efficiency
      const batch = writeBatch(db)
      let updateCount = 0

      selectedDeviceList.forEach((device) => {
        const deviceRef = doc(db, "toughbooks", device.id)
        batch.update(deviceRef, {
          ori_number: sanitizedOri || "",
          updated_at: new Date().toISOString()
        })
        updateCount++
      })

      await batch.commit()

      toast.success(
        `Successfully updated ORI number "${sanitizedOri}" for ${updateCount} device(s)`
      )
      setIsBulkOriEditOpen(false)
      setBulkOriValue("")
      setSelectedDevices(new Set())

      secureLog(
        "info",
        `Bulk ORI update: ${updateCount} devices updated with ORI: ${sanitizedOri}`
      )
    } catch (error: unknown) {
      secureLog("error", "Error updating bulk ORI", { error: String(error) })
      const errorObj = error as { message?: string; code?: string }
      const errorMessage = getFirebaseErrorMessage(errorObj)
      toast.error(
        errorMessage ||
          `Failed to update ORI numbers: ${errorObj?.message || "Unknown error"}`
      )
    } finally {
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete("bulk-ori")
        return newSet
      })
    }
  }

  // Bulk PID Deactivation PDF
  const handleBulkDeactivationPDF = async () => {
    if (selectedDevices.size === 0) {
      toast.error("Please select at least one device")
      return
    }
    setLoadingActions((prev) => new Set(prev).add("bulk-deactivate"))

    try {
      const selectedDeviceList = filteredInventory.filter((d) =>
        selectedDevices.has(d.id)
      )
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
      const subject = `Bulk PID Deactivation Request`

      let deviceList = ""
      selectedDeviceList.forEach((device, index) => {
        deviceList += `${index + 1}. Server: CAPWIN1 | Serial Number: ${device.serial_number} | PID: ${device.pid_number} | MDT ORI: MD0170501\n`
      })

      const body =
        `${today}\n\n` +
        `CSO Dean Rohan, CSO Diana Riley\n` +
        `Maryland State Police\n` +
        `1201 Reisterstown Road\n` +
        `Pikesville, MD 21208\n\n` +
        `Subject: Request PID deactivation\n\n` +
        `To Whom It May Concern,\n\n` +
        `Could you please deactivate the below PIDs for Cap Win connection.\n\n` +
        `Agency ORI: MD0170500\n\n` +
        `${deviceList}\n` +
        `If you should have any questions or concerns pertaining to this request, please contact me at 301-341-1055.\n\n` +
        `Sincerely,\n\n` +
        `Orhan Biler\n` +
        `Sergeant\n` +
        `Cheverly Police Department\n` +
        `6401 Forest Road |Cheverly, MD 20785\n` +
        `Office 301-341-1055 / Fax 301-341-0176`

      if (selectedDeviceList.length === 0) {
        throw new Error("No devices selected")
      }

      const filename = `bulk_pid_deactivation_${selectedDeviceList.length}_devices.pdf`
      await generatePDF({ subject, body, warning: "" }, filename)
      toast.success(
        `Deactivation PDF downloaded for ${selectedDeviceList.length} device(s)`
      )
    } catch (error: unknown) {
      secureLog("error", "Error generating bulk deactivation PDF")
      const errorObj = error as { message?: string }
      toast.error(
        errorObj?.message
          ? `Failed to generate PDF: ${errorObj.message}`
          : "Failed to generate PDF. Please try again."
      )
    } finally {
      setLoadingActions((prev) => {
        const newSet = new Set(prev)
        newSet.delete("bulk-deactivate")
        return newSet
      })
    }
  }

  const handleExportList = async () => {
    try {
      const devicesToExport = filteredInventory
      if (devicesToExport.length === 0) {
        toast.error("No devices to export")
        return
      }

      toast.info("Generating PDF...")
      await generateDeviceListPDF(devicesToExport)
      toast.success("Inventory list exported successfully")
    } catch {
      secureLog("error", "Export error")
      toast.error("Failed to export inventory list")
    }
  }

  // Calculate comprehensive statistics
  const stats = (() => {
    const total = inventory.length
    const byStatus = {
      Assigned: inventory.filter((d) => d.status === "Assigned").length,
      Unassigned: inventory.filter((d) => d.status === "Unassigned").length,
      Retired: inventory.filter((d) => d.status === "Retired").length,
      Unknown: inventory.filter((d) => d.status === "Unknown").length
    }
    const byType = {
      Toughbook: inventory.filter((d) => d.device_type === "Toughbook").length,
      Laptop: inventory.filter((d) => d.device_type === "Laptop").length,
      Desktop: inventory.filter((d) => d.device_type === "Desktop").length,
      Other: inventory.filter((d) => d.device_type === "Other").length
    }
    const byOS = {
      "Windows 11": inventory.filter((d) => d.operating_system === "Windows 11")
        .length,
      "Windows 10": inventory.filter((d) => d.operating_system === "Windows 10")
        .length,
      "Windows 8": inventory.filter((d) => d.operating_system === "Windows 8")
        .length,
      "Windows 7": inventory.filter((d) => d.operating_system === "Windows 7")
        .length,
      "Not recorded": inventory.filter((d) => !d.operating_system).length
    }
    const toBeRetired = inventory.filter((d) => d.to_be_retired === true).length
    const pidRegistered = inventory.filter(
      (d) => d.pid_registered === true
    ).length
    const pidNotRegistered = inventory.filter(
      (d) => d.pid_registered !== true
    ).length
    const pidMismatches = inventory.filter((d) => {
      if (!d.serial_number || !d.pid_number) return false
      return isPidMismatch(d.serial_number, d.pid_number)
    }).length
    const withoutSerial = inventory.filter(
      (d) => !d.serial_number || d.serial_number.trim() === ""
    ).length
    const withoutPid = inventory.filter(
      (d) => !d.pid_number || d.pid_number.trim() === ""
    ).length
    const withoutAssetId = inventory.filter(
      (d) => !d.asset_id || d.asset_id.trim() === ""
    ).length

    // Recently assigned (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentlyAssigned = inventory.filter((d) => {
      if (!d.assignment_date) return false
      const assignmentDate = new Date(d.assignment_date)
      return assignmentDate >= thirtyDaysAgo
    }).length

    // Assignment rate (percentage)
    const assignmentRate =
      total > 0 ? Math.round((byStatus.Assigned / total) * 100) : 0

    // Count unique officers with assigned devices
    const uniqueOfficers = new Set(
      inventory
        .filter(
          (d) => d.status === "Assigned" && d.officer && d.officer.trim() !== ""
        )
        .map((d) => d.officer.toUpperCase().trim())
    ).size

    return {
      total,
      byStatus,
      byType,
      byOS,
      toBeRetired,
      pidRegistered,
      pidNotRegistered,
      pidMismatches,
      withoutSerial,
      withoutPid,
      withoutAssetId,
      recentlyAssigned,
      assignmentRate,
      uniqueOfficers
    }
  })()

  const pageCount = Math.max(1, Math.ceil(filteredInventory.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleDevices = filteredInventory.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  const resetFilters = () => {
    setSearchQuery("")
    setStatusFilter("All")
    setPidRegisteredFilter("All")
    setShowRetired(false)
    setPage(1)
  }
  const selectStatus = (status: string) => {
    setStatusFilter(status)
    if (status === "Retired") setShowRetired(true)
    setPage(1)
  }
  const sortHeading = (label: string, field: typeof sortBy) => (
    <button className="sort-button" onClick={() => handleSort(field)}>
      {label}
      {sortBy === field ? (
        sortOrder === "asc" ? (
          <ArrowUp />
        ) : (
          <ArrowDown />
        )
      ) : (
        <ArrowUpDown className="opacity-50" />
      )}
    </button>
  )
  const rowActions = (device: Device) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${device.asset_id || device.serial_number}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Device actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleEdit(device)}>
          <Edit />
          Edit device
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleCapwinEmail(device)}
          disabled={loadingActions.has(`capwin-${device.id}`)}
        >
          <FileSignature />
          CAPWIN registration
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleOfficerEmail(device)}
          disabled={
            device.status !== "Assigned" ||
            loadingActions.has(`officer-${device.id}`)
          }
        >
          <Send />
          Notify officer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleDeactivationPDF(device)}
          disabled={loadingActions.has(`deactivate-${device.id}`)}
        >
          <FileX />
          Download deactivation PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Assets & operations</p>
          <h1 className="page-title">Device inventory</h1>
          <p className="page-description">
            Every device. Every assignment. All in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportList}
            disabled={isLoading || filteredInventory.length === 0}
          >
            <FileDown />
            Export PDF
          </Button>
          <Button onClick={handleAddNew}>
            <Plus />
            Add device
          </Button>
        </div>
      </div>

      <div className="metric-grid" aria-label="Inventory summary">
        {[
          {
            label: "Total devices",
            value: stats.total,
            note: "Across your entire inventory",
            icon: Laptop
          },
          {
            label: "Assigned",
            value: stats.byStatus.Assigned,
            note: `${stats.assignmentRate}% of the fleet in use`,
            icon: Users
          },
          {
            label: "Available",
            value: stats.byStatus.Unassigned,
            note: "Unassigned devices",
            icon: Inbox
          },
          {
            label: "PID registered",
            value: stats.pidRegistered,
            note: `${stats.pidNotRegistered} awaiting registration`,
            icon: ShieldCheck
          }
        ].map(({ label, value, note, icon: Icon }) => (
          <div key={label} className="metric-card">
            <div className="metric-top">
              <span>{label}</span>
              <span className="metric-icon">
                <Icon />
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="mt-4 h-9 w-16" />
            ) : (
              <div className="metric-value">
                {value.toString().padStart(2, "0")}
              </div>
            )}
            <div className="metric-note">
              <span
                className={`size-1.5 rounded-full ${label === "Assigned" || label === "PID registered" ? "bg-emerald-600" : "bg-muted-foreground/50"}`}
              />
              {note}
            </div>
          </div>
        ))}
      </div>

      <section className="surface" aria-label="Device records">
        <div className="flex flex-wrap items-center justify-between gap-x-3 px-5 pt-5">
          <div className="flex items-center gap-2">
            <h2 className="section-title">Your devices</h2>
            <span className="tab-count">{inventory.length}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setIsPidComparisonModalOpen(true)}
          >
            <FileSearch />
            Compare PIDs
          </Button>
        </div>
        <div className="filter-tabs" aria-label="Filter devices by status">
          {[
            { value: "All", label: "All devices", count: stats.total },
            {
              value: "Assigned",
              label: "Assigned",
              count: stats.byStatus.Assigned
            },
            {
              value: "Unassigned",
              label: "Unassigned",
              count: stats.byStatus.Unassigned
            },
            {
              value: "Retired",
              label: "Retired",
              count: stats.byStatus.Retired
            },
            {
              value: "Unknown",
              label: "Unknown",
              count: stats.byStatus.Unknown
            }
          ].map((tab) => (
            <button
              key={tab.value}
              className="filter-tab"
              aria-pressed={statusFilter === tab.value}
              onClick={() => selectStatus(tab.value)}
            >
              {tab.label}
              <span className="tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <div className="search-field">
            <Search />
            <Input
              className="h-10 pl-9 text-sm"
              aria-label="Search devices"
              placeholder="Search devices, officers, or PIDs…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={pidRegisteredFilter}
              onValueChange={(value) => {
                setPidRegisteredFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger
                aria-label="Filter by PID registration"
                className="h-10! w-[156px] text-xs"
              >
                <Filter className="size-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All PID statuses</SelectItem>
                <SelectItem value="Registered">Registered</SelectItem>
                <SelectItem value="Not Registered">Not registered</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Checkbox
                checked={showRetired}
                onCheckedChange={(checked) => {
                  setShowRetired(checked === true)
                  if (!checked && statusFilter === "Retired")
                    setStatusFilter("All")
                  setPage(1)
                }}
              />
              Include retiring / retired
            </label>
            {(searchQuery ||
              statusFilter !== "All" ||
              pidRegisteredFilter !== "All" ||
              showRetired) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={resetFilters}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              aria-label="Select all filtered devices"
              checked={
                filteredInventory.length > 0 &&
                selectedDevices.size === filteredInventory.length
                  ? true
                  : selectedDevices.size > 0
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={handleSelectAll}
            />
            Select all results
          </label>
          <Select
            value={`${sortBy}:${sortOrder}`}
            onValueChange={(value) => {
              const [field, direction] = value.split(":")
              setSortBy(field as typeof sortBy)
              setSortOrder(direction as typeof sortOrder)
            }}
          >
            <SelectTrigger
              aria-label="Sort devices"
              className="w-[156px] text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  ["asset_id", "Asset ID"],
                  ["serial_number", "Serial number"],
                  ["pid_number", "PID"],
                  ["officer", "Officer"],
                  ["status", "Status"]
                ] as const
              ).flatMap(([field, label]) =>
                ["asc", "desc"].map((direction) => (
                  <SelectItem
                    key={`${field}:${direction}`}
                    value={`${field}:${direction}`}
                  >
                    {label} {direction === "asc" ? "↑" : "↓"}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        {selectedDevices.size > 0 && (
          <div className="bulk-toolbar">
            <span className="mr-2 text-xs font-medium">
              {selectedDevices.size} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkCapwinEmail}
              disabled={loadingActions.has("bulk-capwin")}
            >
              <FileSignature />
              CAPWIN email
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkOfficerEmail}
              disabled={loadingActions.has("bulk-officer")}
            >
              <Send />
              Notify officers
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDeactivationPDF}
              disabled={loadingActions.has("bulk-deactivate")}
            >
              <FileX />
              Deactivation PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkOriEdit}
              disabled={loadingActions.has("bulk-ori")}
            >
              <Building2 />
              Edit ORI
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDevices(new Set())}
            >
              Clear selection
            </Button>
          </div>
        )}
        {loadError && (
          <div
            role="alert"
            className="flex items-center gap-2 border-b bg-destructive/5 p-4 text-sm text-destructive"
          >
            <AlertTriangle className="size-4 shrink-0" />
            {loadError}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="inventory-table">
            <caption className="sr-only">
              Device inventory with assignment, PID registration, and record
              actions
            </caption>
            <thead>
              <tr>
                <th className="w-10">
                  <Checkbox
                    aria-label="Select all filtered devices"
                    checked={
                      filteredInventory.length > 0 &&
                      selectedDevices.size === filteredInventory.length
                        ? true
                        : selectedDevices.size > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th
                  aria-sort={
                    sortBy === "asset_id"
                      ? sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {sortHeading("Device / Asset ID", "asset_id")}
                </th>
                <th
                  aria-sort={
                    sortBy === "serial_number"
                      ? sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {sortHeading("Serial number", "serial_number")}
                </th>
                <th
                  aria-sort={
                    sortBy === "pid_number"
                      ? sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {sortHeading("PID number", "pid_number")}
                </th>
                <th
                  aria-sort={
                    sortBy === "officer"
                      ? sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {sortHeading("Assigned to", "officer")}
                </th>
                <th
                  aria-sort={
                    sortBy === "status"
                      ? sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {sortHeading("Status", "status")}
                </th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }, (_, j) => (
                      <td key={j}>
                        <Skeleton className="h-6 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : visibleDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="cell-empty">
                    <div className="empty-state">
                      <span className="device-symbol size-12!">
                        <Search />
                      </span>
                      <h3 className="text-sm font-semibold">
                        {loadError
                          ? "Inventory unavailable"
                          : "No devices to show"}
                      </h3>
                      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                        {loadError
                          ? "Your records could not be loaded. Refresh the page to try again."
                          : searchQuery ||
                              statusFilter !== "All" ||
                              pidRegisteredFilter !== "All"
                            ? "Try a different search or clear your filters to find what you need."
                            : "Add your first device to start tracking your department’s equipment."}
                      </p>
                      {!loadError && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={
                            searchQuery ||
                            statusFilter !== "All" ||
                            pidRegisteredFilter !== "All"
                              ? resetFilters
                              : handleAddNew
                          }
                        >
                          {searchQuery ||
                          statusFilter !== "All" ||
                          pidRegisteredFilter !== "All"
                            ? "Clear filters"
                            : "Add device"}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                visibleDevices.map((device) => {
                  const mismatch = isPidMismatch(
                    device.serial_number,
                    device.pid_number
                  )
                  const Icon =
                    device.device_type === "Desktop"
                      ? Monitor
                      : device.device_type === "Other"
                        ? Boxes
                        : Laptop
                  return (
                    <tr
                      key={device.id}
                      data-selected={selectedDevices.has(device.id)}
                    >
                      <td className="cell-select">
                        <Checkbox
                          aria-label={`Select ${device.asset_id || device.serial_number}`}
                          checked={selectedDevices.has(device.id)}
                          onCheckedChange={() => handleSelectDevice(device.id)}
                        />
                      </td>
                      <td className="cell-device">
                        <button
                          onClick={() => handleEdit(device)}
                          className="flex items-center gap-3 text-left"
                        >
                          <span className="device-symbol">
                            <Icon />
                          </span>
                          <span>
                            <span className="font-semibold hover:text-primary">
                              {device.asset_id || "No asset ID"}
                            </span>
                            <span className="mt-1 block text-[10px] text-muted-foreground">
                              {device.device_type || "Toughbook"}
                              {device.to_be_retired ? " · Retiring" : ""}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="cell-detail" data-label="Serial number">
                        <span className="font-mono text-[11px]">
                          {device.serial_number || "—"}
                        </span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {device.operating_system || "OS not recorded"}
                        </span>
                      </td>
                      <td className="cell-status" data-label="PID number">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px]">
                            {device.pid_number || "—"}
                          </span>
                          {mismatch && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  aria-label={`PID mismatch. Expected ${calculateExpectedPid(device.serial_number)}`}
                                  className="text-amber-700 dark:text-amber-300"
                                >
                                  <AlertTriangle className="size-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                PID mismatch · Expected{" "}
                                {calculateExpectedPid(device.serial_number)}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <span
                          className={`mt-1 inline-flex items-center gap-1 text-[10px] ${device.pid_registered ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}
                        >
                          {device.pid_registered ? (
                            <CheckCircle2 className="size-3" />
                          ) : (
                            <Clock className="size-3" />
                          )}
                          {device.pid_registered
                            ? "Registered"
                            : "Not registered"}
                        </span>
                      </td>
                      <td className="cell-detail" data-label="Assigned to">
                        {device.officer ? (
                          <div className="flex items-center gap-2">
                            <span className="avatar hidden xl:flex">
                              {device.officer
                                .replace(/^(SGT\.|OFC\.|CPL\.|LT\.)\s*/i, "")
                                .slice(0, 2)}
                            </span>
                            <span className="text-[11px]">
                              {device.officer}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="cell-status" data-label="Status">
                        <span
                          className={`status-pill status-${device.status.toLowerCase()}`}
                        >
                          {device.status}
                        </span>
                        {device.ori_number && (
                          <span className="mt-1.5 block font-mono text-[10px] text-muted-foreground">
                            ORI {device.ori_number}
                          </span>
                        )}
                      </td>
                      <td className="cell-actions">{rowActions(device)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span aria-live="polite">
            {filteredInventory.length
              ? `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredInventory.length)} of ${filteredInventory.length} devices`
              : "0 devices"}
            <span className="hidden sm:inline">
              {!showRetired ? " · Retiring and retired hidden" : ""}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }}
            >
              <SelectTrigger
                aria-label="Devices per page"
                className="h-8! w-[94px] text-[11px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-10 text-center">
              {currentPage} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === pageCount}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="section-title">Fleet at a glance</h2>
        <span className="text-[10px] text-muted-foreground">
          Based on your full inventory
        </span>
      </div>
      <div className="insight-grid">
        <div className="insight-panel">
          <h3 className="mb-5 text-xs font-medium">Device mix</h3>
          <div className="mb-5 flex h-2 overflow-hidden rounded-full bg-muted">
            {Object.entries(stats.byType).map(([type, count], i) => (
              <div
                key={type}
                style={{
                  width: `${stats.total ? (count / stats.total) * 100 : 0}%`,
                  background: `var(--chart-${i + 1})`
                }}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {Object.entries(stats.byType).map(([type, count], i) => (
              <div key={type} className="insight-line">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: `var(--chart-${i + 1})` }}
                  />
                  {type}
                </span>
                <span className="font-medium tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="insight-panel">
          <h3 className="mb-5 text-xs font-medium">Operating systems</h3>
          <div className="space-y-3">
            {Object.entries(stats.byOS).map(([os, count]) => (
              <div key={os} className="insight-line">
                <span className="w-20 shrink-0 text-muted-foreground">
                  {os}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-chart-1"
                    style={{
                      width: `${stats.total ? (count / stats.total) * 100 : 0}%`
                    }}
                  />
                </div>
                <span className="w-5 text-right font-medium tabular-nums">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="insight-panel">
          <h3 className="mb-5 text-xs font-medium">Needs attention</h3>
          <div className="space-y-3">
            <div className="insight-line">
              <span className="text-muted-foreground">PID mismatches</span>
              <span
                className={
                  stats.pidMismatches
                    ? "font-medium text-amber-700 dark:text-amber-300"
                    : "font-medium"
                }
              >
                {stats.pidMismatches}
              </span>
            </div>
            <div className="insight-line">
              <span className="text-muted-foreground">
                Scheduled for retirement
              </span>
              <span className="font-medium">{stats.toBeRetired}</span>
            </div>
            <div className="insight-line">
              <span className="text-muted-foreground">
                Missing serial / PID / asset ID
              </span>
              <span className="font-medium">
                {stats.withoutSerial} / {stats.withoutPid} /{" "}
                {stats.withoutAssetId}
              </span>
            </div>
            <div className="insight-line border-t pt-3 text-[10px]">
              <span className="text-muted-foreground">
                {stats.uniqueOfficers} officers equipped
              </span>
              <span className="text-muted-foreground">
                {stats.recentlyAssigned} assigned in 30 days
              </span>
            </div>
          </div>
        </div>
      </div>

      <DeviceModal
        open={isDeviceModalOpen}
        onOpenChange={setIsDeviceModalOpen}
        device={editingDevice}
        onSave={handleSaveDevice}
        existingDevices={inventory}
      />

      <EmailModal
        open={isEmailModalOpen}
        onOpenChange={setIsEmailModalOpen}
        subject={emailData.subject}
        body={emailData.body}
        warning={emailData.warning}
        recipientEmail={emailData.recipient}
      />

      <PidComparisonModal
        open={isPidComparisonModalOpen}
        onOpenChange={setIsPidComparisonModalOpen}
        inventory={inventory}
        onAddDevices={handleBulkAddDevices}
      />

      {/* Bulk ORI Edit Dialog */}
      <Dialog open={isBulkOriEditOpen} onOpenChange={setIsBulkOriEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Bulk Edit ORI Number</DialogTitle>
            <DialogDescription>
              Update ORI number for {selectedDevices.size} selected device
              {selectedDevices.size !== 1 ? "s" : ""}. Leave empty to clear ORI
              number.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bulk-ori">ORI Number</Label>
              <Input
                id="bulk-ori"
                placeholder="e.g., MD0170501"
                value={bulkOriValue}
                onChange={(e) => setBulkOriValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleBulkOriSave()
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This will update the ORI number for all selected devices.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkOriEditOpen(false)
                setBulkOriValue("")
              }}
              disabled={loadingActions.has("bulk-ori")}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkOriSave}
              disabled={loadingActions.has("bulk-ori")}
            >
              {loadingActions.has("bulk-ori") ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Update {selectedDevices.size} Device
                  {selectedDevices.size !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
