"use client"

import { useEffect, useState, useCallback } from "react"
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
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
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
  BarChart3,
  Laptop,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Building2,
  ShieldCheck,
  ShieldX
} from "lucide-react"
import { toast } from "sonner"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts"
import { generatePDF, generateDeviceListPDF } from "@/lib/pdf-generator"
import { 
  getFirebaseErrorMessage, 
  secureLog, 
  sanitizeInput,
  sanitizeAlphanumeric 
} from "@/lib/security"

export function InventoryDashboard() {
  const [inventory, setInventory] = useState<Device[]>([])
  const [filteredInventory, setFilteredInventory] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [pidRegisteredFilter, setPidRegisteredFilter] = useState<string>("All")
  const [showRetired, setShowRetired] = useState(false)
  
  // Sorting State
  const [sortBy, setSortBy] = useState<"asset_id" | "serial_number" | "pid_number" | "officer" | "status">("asset_id")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Modal State
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [emailData, setEmailData] = useState({ subject: "", body: "", warning: "", recipient: "" })
  
  const [isPidComparisonModalOpen, setIsPidComparisonModalOpen] = useState(false)
  
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
        { id: '1', serial_number: '3ITTA13927', pid_number: 'Z100A13927', asset_id: 'TB-1', device_type: 'Toughbook', status: 'Assigned', officer: 'SGT. BILER', assignment_date: '2024-07-31', notes: 'Test unit' },
        { id: '2', serial_number: '4GTTA99999', pid_number: 'OLD_PID_123', asset_id: 'TB-2', device_type: 'Toughbook', status: 'Unassigned', officer: '', assignment_date: '', notes: 'Legacy PID mismatch example' },
      ]
      setInventory(mockData)
      setIsLoading(false)
      return
    }

    const q = query(collection(db, "toughbooks"), orderBy("serial_number"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as Device[]
      setInventory(data)
      setIsLoading(false)
    }, (error: FirestoreError) => {
      secureLog("error", "Error fetching inventory data", { code: error.code })
      setIsLoading(false)
      
      // Use secure error messaging
      const errorMessage = getFirebaseErrorMessage(error)
      toast.error(errorMessage)
    })

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
    if (!showRetired) {
      result = result.filter(item => item.status !== "Retired" && !item.to_be_retired)
    }

    if (searchQuery) {
      const q = searchQuery.toUpperCase()
      result = result.filter(item => 
        item.serial_number.includes(q) || 
        item.pid_number.includes(q) || 
        (item.asset_id && item.asset_id.includes(q)) ||
        (item.ori_number && item.ori_number.includes(q)) ||
        (item.officer && item.officer.includes(q))
      )
    }

    if (statusFilter !== "All") {
      result = result.filter(item => item.status === statusFilter)
    }

    if (pidRegisteredFilter !== "All") {
      if (pidRegisteredFilter === "Registered") {
        result = result.filter(item => item.pid_registered === true)
      } else if (pidRegisteredFilter === "Not Registered") {
        result = result.filter(item => item.pid_registered !== true)
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
    setSelectedDevices(prev => {
      const resultIds = new Set(result.map(d => d.id))
      const newSet = new Set<string>()
      prev.forEach(id => {
        if (resultIds.has(id)) {
          newSet.add(id)
        }
      })
      return newSet
    })
  }, [inventory, searchQuery, statusFilter, pidRegisteredFilter, showRetired, sortBy, sortOrder])

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
            device => device.serial_number && device.serial_number.toUpperCase().trim() === normalizedSerial
          )
          
          if (duplicate) {
            const error = new Error(`Device with serial number "${normalizedSerial}" already exists`)
            throw error
          }
        }

        // Only check PID number duplicate if PID number is provided
        if (data.pid_number && data.pid_number.trim()) {
          const normalizedPid = data.pid_number.toUpperCase().trim()
          const duplicate = inventory.find(
            device => device.pid_number && device.pid_number.toUpperCase().trim() === normalizedPid
          )
          
          if (duplicate) {
            const error = new Error(`Device with PID number "${normalizedPid}" already exists`)
            throw error
          }
        }
      } else {
        // When editing, check if serial number conflicts with another device
        if (data.serial_number && data.serial_number.trim()) {
          const normalizedSerial = data.serial_number.toUpperCase().trim()
          const duplicate = inventory.find(
            device => 
              device.id !== editingDevice.id && 
              device.serial_number && 
              device.serial_number.toUpperCase().trim() === normalizedSerial
          )
          
          if (duplicate) {
            const error = new Error(`Another device with serial number "${normalizedSerial}" already exists`)
            throw error
          }
        }

        // When editing, check if PID number conflicts with another device
        if (data.pid_number && data.pid_number.trim()) {
          const normalizedPid = data.pid_number.toUpperCase().trim()
          const duplicate = inventory.find(
            device => 
              device.id !== editingDevice.id && 
              device.pid_number && 
              device.pid_number.toUpperCase().trim() === normalizedPid
          )
          
          if (duplicate) {
            const error = new Error(`Another device with PID number "${normalizedPid}" already exists`)
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
          setInventory(prev => prev.map(i => i.id === editingDevice.id ? { ...i, ...payload } : i))
          toast.success("Device updated successfully")
        }
      } else {
        if (db) {
          await addDoc(collection(db, "toughbooks"), payload)
          toast.success("Device added successfully")
        } else {
          // Mock Add
          setInventory(prev => [...prev, { id: Date.now().toString(), ...payload }])
          toast.success("Device added successfully")
        }
      }
      setIsDeviceModalOpen(false)
      setEditingDevice(null)
    } catch (error: unknown) {
      secureLog("error", "Save device error", { 
        isEdit: !!editingDevice 
      })
      
      // Use secure error messaging
      const firebaseError = error as { code?: string; message?: string }
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
        const batch = writeBatch(db)
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
          
          chunk.forEach(deviceData => {
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
        const newDevices = devices.map(d => ({
          id: Date.now().toString() + Math.random(),
          ...d,
          updated_at: new Date().toISOString()
        }))
        setInventory(prev => [...prev, ...newDevices])
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

      setLoadingActions(prev => new Set(prev).add(`capwin-${device.id}`))
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const subject = `New Device PID Registration: ${device.pid_number} / ${device.serial_number}`
      
      const expectedPid = `Z100A${device.serial_number.slice(-5)}`
      const body = `${today}\n\n` +
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
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(`capwin-${device.id}`)
        return newSet
      })
    } catch (error: unknown) {
      secureLog("error", "Error generating CAPWIN email")
      toast.error("Failed to generate email. Please try again.")
      setLoadingActions(prev => {
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

      setLoadingActions(prev => new Set(prev).add(`officer-${device.id}`))
      const last4 = device.serial_number.slice(-4)
      const deviceType = device.device_type || "Toughbook"
      const subject = `${deviceType} Assignment Notification: Unit ${last4}`
      
      let warning = ""
      if (device.status !== "Assigned") {
        warning = "WARNING: This device is currently NOT marked as 'Assigned'."
      }

      const body = `${warning ? warning + "\n\n" : ""}Your new ${deviceType} has been provisioned. Your system PID is: ${device.pid_number}.\n` +
                   `Please ensure the CAPWIN software launches correctly using this ID.\n` +
                   `If you encounter any issues, please contact the IT help desk at 301-341-1055.`

      // Email Guessing Logic
      let emailTo = ""
      if (device.officer) {
        let cleanName = device.officer.replace(/^(SGT|OFF|CPT|LT|CHIEF|DET)\.?\s*/i, '').trim()
        cleanName = cleanName.replace(/\s+/g, '.').toLowerCase()
        emailTo = `${cleanName}@cpd.md.gov`
      }

      setEmailData({ subject, body, warning, recipient: emailTo })
      setIsEmailModalOpen(true)
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(`officer-${device.id}`)
        return newSet
      })
    } catch (error: unknown) {
      secureLog("error", "Error generating officer email")
      toast.error("Failed to generate email. Please try again.")
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(`officer-${device.id}`)
        return newSet
      })
    }
  }

  // Bulk Selection Handlers
  const handleSelectDevice = (deviceId: string) => {
    setSelectedDevices(prev => {
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
      setSelectedDevices(new Set(filteredInventory.map(d => d.id)))
    }
  }

  // Bulk Email Generation
  const handleBulkCapwinEmail = () => {
    try {
      if (selectedDevices.size === 0) {
        toast.error("Please select at least one device")
        return
      }
      setLoadingActions(prev => new Set(prev).add('bulk-capwin'))

      const selectedDeviceList = filteredInventory.filter(d => selectedDevices.has(d.id))
      
      if (selectedDeviceList.length === 0) {
        toast.error("No valid devices selected")
        setLoadingActions(prev => {
          const newSet = new Set(prev)
          newSet.delete('bulk-capwin')
          return newSet
        })
        return
      }

      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const subject = `Bulk Device PID Registration Request`
      
      let deviceList = ""
      selectedDeviceList.forEach((device, index) => {
        deviceList += `${index + 1}. Server: CAPWIN1 | Domain: Z100 | Serial Number: ${device.serial_number} | MDT ORI: MD0170501\n`
      })

      const body = `${today}\n\n` +
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
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete('bulk-capwin')
        return newSet
      })
    } catch (error: unknown) {
      secureLog("error", "Error generating bulk CAPWIN email")
      toast.error("Failed to generate email. Please try again.")
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete('bulk-capwin')
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
      setLoadingActions(prev => new Set(prev).add('bulk-officer'))

      const selectedDeviceList = filteredInventory.filter(d => selectedDevices.has(d.id))
      
      if (selectedDeviceList.length === 0) {
        toast.error("No valid devices selected")
        setLoadingActions(prev => {
          const newSet = new Set(prev)
          newSet.delete('bulk-officer')
          return newSet
        })
        return
      }

      const assignedDevices = selectedDeviceList.filter(d => d.status === "Assigned" && d.officer)
      
      if (assignedDevices.length === 0) {
        toast.error("No assigned devices selected. Please select devices that are assigned to officers.")
        setLoadingActions(prev => {
          const newSet = new Set(prev)
          newSet.delete('bulk-officer')
          return newSet
        })
        return
      }

    // Group by officer email
    const devicesByOfficer = new Map<string, Device[]>()
    assignedDevices.forEach(device => {
      let cleanName = device.officer.replace(/^(SGT|OFF|CPT|LT|CHIEF|DET)\.?\s*/i, '').trim()
      cleanName = cleanName.replace(/\s+/g, '.').toLowerCase()
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

    const body = `Your new ${deviceType}(s) have been provisioned. Details below:\n\n` +
                 `${deviceList}\n` +
                 `Please ensure the CAPWIN software launches correctly using these IDs.\n` +
                 `If you encounter any issues, please contact the IT help desk at 301-341-1055.`

      setEmailData({ 
        subject, 
        body, 
        warning: devices.length !== selectedDeviceList.length ? `Note: Only ${devices.length} of ${selectedDeviceList.length} selected devices are assigned to officers.` : "", 
        recipient: firstOfficer 
      })
      setIsEmailModalOpen(true)
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete('bulk-officer')
        return newSet
      })
    } catch (error: unknown) {
      secureLog("error", "Error generating bulk officer email")
      toast.error("Failed to generate email. Please try again.")
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete('bulk-officer')
        return newSet
      })
    }
  }

  // Individual PID Deactivation PDF
  const handleDeactivationPDF = async (device: Device) => {
    setLoadingActions(prev => new Set(prev).add(`deactivate-${device.id}`))
    try {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const subject = `PID Deactivation Request: ${device.pid_number} / ${device.serial_number}`
      
      const body = `${today}\n\n` +
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
      toast.error(errorObj?.message ? `Failed to generate PDF: ${errorObj.message}` : "Failed to generate PDF. Please try again.")
    } finally {
      setLoadingActions(prev => {
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

    setLoadingActions(prev => new Set(prev).add('bulk-ori'))

    try {
      const selectedDeviceList = filteredInventory.filter(d => selectedDevices.has(d.id))
      
      if (selectedDeviceList.length === 0) {
        toast.error("No valid devices selected")
        setLoadingActions(prev => {
          const newSet = new Set(prev)
          newSet.delete('bulk-ori')
          return newSet
        })
        return
      }

      // Sanitize ORI number - allow alphanumeric and keep it uppercase
      const trimmedValue = bulkOriValue.trim()
      const sanitizedOri = trimmedValue ? sanitizeAlphanumeric(trimmedValue.toUpperCase()) : ""

      console.log("Bulk ORI Update:", {
        input: bulkOriValue,
        sanitized: sanitizedOri,
        deviceCount: selectedDeviceList.length,
        deviceIds: selectedDeviceList.map(d => d.id)
      })

      // Use batch write for efficiency
      const batch = writeBatch(db)
      let updateCount = 0

      selectedDeviceList.forEach(device => {
        const deviceRef = doc(db, "toughbooks", device.id)
        batch.update(deviceRef, {
          ori_number: sanitizedOri || "",
          updated_at: new Date().toISOString()
        })
        updateCount++
      })

      await batch.commit()
      
      toast.success(`Successfully updated ORI number "${sanitizedOri}" for ${updateCount} device(s)`)
      setIsBulkOriEditOpen(false)
      setBulkOriValue("")
      setSelectedDevices(new Set())
      
      secureLog("info", `Bulk ORI update: ${updateCount} devices updated with ORI: ${sanitizedOri}`)
    } catch (error: unknown) {
      console.error("Bulk ORI update error:", error)
      secureLog("error", "Error updating bulk ORI", { error: String(error) })
      const errorObj = error as { message?: string; code?: string }
      const errorMessage = getFirebaseErrorMessage(errorObj)
      toast.error(errorMessage || `Failed to update ORI numbers: ${errorObj?.message || "Unknown error"}`)
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete('bulk-ori')
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
    setLoadingActions(prev => new Set(prev).add('bulk-deactivate'))

    try {
      const selectedDeviceList = filteredInventory.filter(d => selectedDevices.has(d.id))
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const subject = `Bulk PID Deactivation Request`
      
      let deviceList = ""
      selectedDeviceList.forEach((device, index) => {
        deviceList += `${index + 1}. Server: CAPWIN1 | Serial Number: ${device.serial_number} | PID: ${device.pid_number} | MDT ORI: MD0170501\n`
      })

      const body = `${today}\n\n` +
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
      toast.success(`Deactivation PDF downloaded for ${selectedDeviceList.length} device(s)`)
    } catch (error: unknown) {
      secureLog("error", "Error generating bulk deactivation PDF")
      const errorObj = error as { message?: string }
      toast.error(errorObj?.message ? `Failed to generate PDF: ${errorObj.message}` : "Failed to generate PDF. Please try again.")
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete('bulk-deactivate')
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
    } catch (error: unknown) {
      secureLog("error", "Export error")
      toast.error("Failed to export inventory list")
    }
  }

  // Calculate comprehensive statistics
  const stats = (() => {
    const total = inventory.length
    const byStatus = {
      Assigned: inventory.filter(d => d.status === "Assigned").length,
      Unassigned: inventory.filter(d => d.status === "Unassigned").length,
      Retired: inventory.filter(d => d.status === "Retired").length,
      Unknown: inventory.filter(d => d.status === "Unknown").length,
    }
    const byType = {
      Toughbook: inventory.filter(d => d.device_type === "Toughbook").length,
      Laptop: inventory.filter(d => d.device_type === "Laptop").length,
      Desktop: inventory.filter(d => d.device_type === "Desktop").length,
      Other: inventory.filter(d => d.device_type === "Other").length,
    }
    const byOS = {
      "Windows 11": inventory.filter(d => d.operating_system === "Windows 11" || !d.operating_system).length,
      "Windows 10": inventory.filter(d => d.operating_system === "Windows 10").length,
      "Windows 8": inventory.filter(d => d.operating_system === "Windows 8").length,
      "Windows 7": inventory.filter(d => d.operating_system === "Windows 7").length,
    }
    const toBeRetired = inventory.filter(d => d.to_be_retired === true).length
    const pidRegistered = inventory.filter(d => d.pid_registered === true).length
    const pidNotRegistered = inventory.filter(d => d.pid_registered !== true).length
    const pidMismatches = inventory.filter(d => {
      if (!d.serial_number || !d.pid_number) return false
      return isPidMismatch(d.serial_number, d.pid_number)
    }).length
    const withoutSerial = inventory.filter(d => !d.serial_number || d.serial_number.trim() === "").length
    const withoutPid = inventory.filter(d => !d.pid_number || d.pid_number.trim() === "").length
    const withoutAssetId = inventory.filter(d => !d.asset_id || d.asset_id.trim() === "").length
    
    // Recently assigned (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentlyAssigned = inventory.filter(d => {
      if (!d.assignment_date) return false
      const assignmentDate = new Date(d.assignment_date)
      return assignmentDate >= thirtyDaysAgo
    }).length

    // Assignment rate (percentage)
    const assignmentRate = total > 0 ? Math.round((byStatus.Assigned / total) * 100) : 0

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
      assignmentRate
    }
  })()

  return (
    <div className="space-y-6">
      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Devices */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Devices</p>
                <p className="text-3xl font-bold mt-2">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Devices */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Assigned</p>
                <p className="text-3xl font-bold mt-2">{stats.byStatus.Assigned}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.assignmentRate}% of total</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unassigned Devices */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unassigned</p>
                <p className="text-3xl font-bold mt-2">{stats.byStatus.Unassigned}</p>
                <p className="text-xs text-muted-foreground mt-1">Available for assignment</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* To Be Retired */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">To Be Retired</p>
                <p className="text-3xl font-bold mt-2">{stats.toBeRetired}</p>
                <p className="text-xs text-muted-foreground mt-1">Scheduled for retirement</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PID Registered */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">PID Registered</p>
                <p className="text-3xl font-bold mt-2">{stats.pidRegistered}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.total > 0 ? Math.round((stats.pidRegistered / stats.total) * 100) : 0}% registered
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PID Not Registered */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">PID Not Registered</p>
                <p className="text-3xl font-bold mt-2">{stats.pidNotRegistered}</p>
                <p className="text-xs text-muted-foreground mt-1">Pending registration</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <ShieldX className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Status Breakdown */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Status Breakdown</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Assigned</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-600 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.byStatus.Assigned / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{stats.byStatus.Assigned}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Unassigned</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.byStatus.Unassigned / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{stats.byStatus.Unassigned}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-gray-600" />
                  <span className="text-sm">Retired</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gray-600 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.byStatus.Retired / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{stats.byStatus.Retired}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">Unknown</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-600 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.byStatus.Unknown / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{stats.byStatus.Unknown}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Device Type Breakdown */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Laptop className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Device Type Breakdown</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Toughbook</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.byType.Toughbook / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{stats.byType.Toughbook}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Laptop</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.byType.Laptop / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{stats.byType.Laptop}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Desktop</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.byType.Desktop / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{stats.byType.Desktop}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Other</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.byType.Other / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{stats.byType.Other}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PID Registration Status */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">PID Registration Status</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">Registered</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.pidRegistered / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{stats.pidRegistered}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldX className="h-4 w-4 text-red-600" />
                  <span className="text-sm">Not Registered</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-red-600 rounded-full" 
                      style={{ width: `${stats.total > 0 ? (stats.pidNotRegistered / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{stats.pidNotRegistered}</span>
                </div>
              </div>
            </div>
            {/* Registration Progress */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Registration Progress</span>
                <span className="font-semibold text-emerald-600">
                  {stats.total > 0 ? Math.round((stats.pidRegistered / stats.total) * 100) : 0}%
                </span>
              </div>
              <div className="mt-2 h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500" 
                  style={{ width: `${stats.total > 0 ? (stats.pidRegistered / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PID Mismatches */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">PID Mismatches</span>
            </div>
            <p className="text-2xl font-bold">{stats.pidMismatches}</p>
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>

        {/* Missing Data */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">Missing Serial</span>
            </div>
            <p className="text-2xl font-bold">{stats.withoutSerial}</p>
            <p className="text-xs text-muted-foreground mt-1">Incomplete records</p>
          </CardContent>
        </Card>

        {/* Missing PID */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium">Missing PID</span>
            </div>
            <p className="text-2xl font-bold">{stats.withoutPid}</p>
            <p className="text-xs text-muted-foreground mt-1">Incomplete records</p>
          </CardContent>
        </Card>

        {/* Recently Assigned */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Recent Assignments</span>
            </div>
            <p className="text-2xl font-bold">{stats.recentlyAssigned}</p>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Pie Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* OS Distribution Pie Chart */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Laptop className="h-5 w-5 text-primary" />
              Operating System Distribution
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Win 11', value: stats.byOS["Windows 11"], color: '#0ea5e9' },
                      { name: 'Win 10', value: stats.byOS["Windows 10"], color: '#8b5cf6' },
                      { name: 'Win 8', value: stats.byOS["Windows 8"], color: '#f59e0b' },
                      { name: 'Win 7', value: stats.byOS["Windows 7"], color: '#ef4444' },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {[
                      { name: 'Win 11', value: stats.byOS["Windows 11"], color: '#0ea5e9' },
                      { name: 'Win 10', value: stats.byOS["Windows 10"], color: '#8b5cf6' },
                      { name: 'Win 8', value: stats.byOS["Windows 8"], color: '#f59e0b' },
                      { name: 'Win 7', value: stats.byOS["Windows 7"], color: '#ef4444' },
                    ].filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    formatter={(value: number) => [`${value} devices`, '']}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* PID Registration Pie Chart */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              PID Registration Status
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Registered', value: stats.pidRegistered, color: '#10b981' },
                      { name: 'Not Registered', value: stats.pidNotRegistered, color: '#ef4444' },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {[
                      { name: 'Registered', value: stats.pidRegistered, color: '#10b981' },
                      { name: 'Not Registered', value: stats.pidNotRegistered, color: '#ef4444' },
                    ].filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    formatter={(value: number) => [`${value} devices`, '']}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Search and Filters Row */}
          <div className="p-4 space-y-4">
            {/* Top Row: Search + Action Buttons */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by Serial Number, PID, Officer, or Asset ID..." 
                  className="pl-10 h-11 bg-muted/30 border-muted-foreground/20 focus:bg-background transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                />
              </div>
              
              {/* Action Buttons - Always visible */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button 
                  variant="outline" 
                  size="default"
                  className="h-11"
                  onClick={() => setIsPidComparisonModalOpen(true)}
                >
                  <FileSearch className="mr-2 h-4 w-4" /> 
                  <span className="hidden sm:inline">Compare PIDs</span>
                  <span className="sm:hidden">Compare</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="default"
                  className="h-11"
                  onClick={handleExportList}
                >
                  <FileDown className="mr-2 h-4 w-4" /> 
                  <span className="hidden sm:inline">Export PDF</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                <Button 
                  size="default"
                  className="h-11"
                  onClick={handleAddNew}
                >
                  <Plus className="mr-2 h-4 w-4" /> 
                  <span className="hidden sm:inline">Add Device</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="font-medium">Filters:</span>
              </div>
              
              <div className="flex flex-wrap gap-3 flex-1">
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] sm:w-[160px] h-9 bg-muted/30 border-muted-foreground/20">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Statuses</SelectItem>
                      <SelectItem value="Assigned">Assigned</SelectItem>
                      <SelectItem value="Unassigned">Unassigned</SelectItem>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* PID Registered Filter */}
                <div className="flex items-center gap-2">
                  <Select value={pidRegisteredFilter} onValueChange={setPidRegisteredFilter}>
                    <SelectTrigger className="w-[140px] sm:w-[160px] h-9 bg-muted/30 border-muted-foreground/20">
                      <SelectValue placeholder="PID Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All PID Status</SelectItem>
                      <SelectItem value="Registered">Registered</SelectItem>
                      <SelectItem value="Not Registered">Not Registered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Show Retired Checkbox */}
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-muted-foreground/20 bg-muted/30">
                  <Checkbox 
                    id="show-retired"
                    checked={showRetired}
                    onCheckedChange={(checked) => setShowRetired(checked === true)}
                    className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <label 
                    htmlFor="show-retired" 
                    className="text-sm cursor-pointer select-none text-muted-foreground"
                  >
                    Show Retired
                  </label>
                </div>

                {/* Active filters indicator */}
                {(statusFilter !== "All" || pidRegisteredFilter !== "All" || showRetired) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setStatusFilter("All")
                      setPidRegisteredFilter("All")
                      setShowRetired(false)
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Selection Actions - Slide in when items selected */}
          {selectedDevices.size > 0 && (
            <div className="px-4 py-3 bg-primary/5 border-t border-primary/10 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{selectedDevices.size}</span>
                  </div>
                  <span className="text-sm font-medium">device{selectedDevices.size !== 1 ? 's' : ''} selected</span>
                </div>
                
                <div className="flex flex-wrap gap-2 flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8"
                        onClick={handleBulkCapwinEmail}
                        disabled={loadingActions.has('bulk-capwin')}
                      >
                        {loadingActions.has('bulk-capwin') ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        CAPWIN Email
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate CAPWIN registration email</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8"
                        onClick={handleBulkOfficerEmail}
                        disabled={loadingActions.has('bulk-officer')}
                      >
                        {loadingActions.has('bulk-officer') ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Notify Officers
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send notification to assigned officers</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8"
                        onClick={handleBulkDeactivationPDF}
                        disabled={loadingActions.has('bulk-deactivate')}
                      >
                        {loadingActions.has('bulk-deactivate') ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <FileX className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Deactivation PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate PID deactivation request</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8"
                        onClick={handleBulkOriEdit}
                        disabled={loadingActions.has('bulk-ori')}
                      >
                        {loadingActions.has('bulk-ori') ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Edit ORI Number
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Bulk edit ORI number for selected devices</TooltipContent>
                  </Tooltip>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-muted-foreground"
                  onClick={() => setSelectedDevices(new Set())}
                >
                  Clear selection
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden shadow-sm border-t-0">
        <div className="max-h-[calc(100vh-300px)] overflow-x-auto overflow-y-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="bg-muted sticky top-0 z-10 shadow-sm [&_tr]:border-b">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedDevices.size === filteredInventory.length && filteredInventory.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("serial_number")}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  Serial Number
                  {sortBy === "serial_number" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("asset_id")}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  Asset ID
                  {sortBy === "asset_id" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              <TableHead>Device Type</TableHead>
              <TableHead>ORI Number</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("pid_number")}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  PID (Actual)
                  {sortBy === "pid_number" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              <TableHead>Expected PID</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("officer")}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  Officer / User
                  {sortBy === "officer" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort("status")}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  Status
                  {sortBy === "status" ? (
                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  )}
                </button>
              </TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><div className="flex justify-center gap-2"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></div></TableCell>
                </TableRow>
              ))
            ) : filteredInventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Inbox className="h-12 w-12 opacity-20" />
                    <p className="text-lg font-medium">No devices found</p>
                    <p className="text-sm">Try adjusting your search or add a new device.</p>
                    <Button variant="outline" size="sm" onClick={handleAddNew} className="mt-2">
                      <Plus className="mr-2 h-4 w-4" /> Add New Device
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredInventory.map((device) => {
                const mismatch = isPidMismatch(device.serial_number, device.pid_number)
                const expected = calculateExpectedPid(device.serial_number)
                
                return (
                  <TableRow 
                    key={device.id} 
                    className={`
                      ${mismatch ? "bg-red-50/50 hover:bg-red-100/60" : "hover:bg-muted/50"}
                      ${device.to_be_retired ? "opacity-70 bg-gray-50/50 dark:bg-gray-900/20" : ""}
                    `}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedDevices.has(device.id)}
                        onCheckedChange={() => handleSelectDevice(device.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium">{device.serial_number}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {device.asset_id || <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{device.device_type || "Toughbook"}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {device.ori_number ? (
                        device.ori_number
                      ) : (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">
                      {mismatch ? (
                        <div className="flex flex-col">
                          <span className="text-red-600 font-bold flex items-center gap-1">
                             {device.pid_number}
                             <AlertTriangle className="h-3 w-3" />
                          </span>
                          <span className="text-[10px] text-red-500 font-semibold">MISMATCH</span>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1">
                          {device.pid_number}
                          {device.pid_registered && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                PID Registered
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{expected}</TableCell>
                    <TableCell>
                      {device.officer ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">
                            {device.officer.charAt(0)}
                          </div>
                          <span className="font-medium text-sm">{device.officer}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-sm">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        device.status === "Assigned" ? "success" : 
                        device.status === "Unassigned" ? "info" : 
                        device.status === "Unknown" ? "warning" : "outline"
                      }>
                        {device.status}
                      </Badge>
                      {device.to_be_retired && (
                        <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0 h-4">
                          RETIRE
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(device)}>
                              <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit Device</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleCapwinEmail(device)}
                              disabled={loadingActions.has(`capwin-${device.id}`)}
                            >
                              {loadingActions.has(`capwin-${device.id}`) ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <FileSignature className="h-4 w-4 text-muted-foreground hover:text-purple-600" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Request CAPWIN PID</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOfficerEmail(device)}
                              disabled={loadingActions.has(`officer-${device.id}`)}
                            >
                              {loadingActions.has(`officer-${device.id}`) ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <Send className="h-4 w-4 text-muted-foreground hover:text-green-600" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Notify Officer</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeactivationPDF(device)}
                              disabled={loadingActions.has(`deactivate-${device.id}`)}
                            >
                              {loadingActions.has(`deactivate-${device.id}`) ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <FileX className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Generate Deactivation PDF</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
              </tbody>
            </table>
        </div>
        <div className="p-4 border-t bg-muted/20 text-xs text-muted-foreground flex justify-between items-center">
           <span>Total Devices: <span className="font-medium text-foreground">{filteredInventory.length}</span></span>
           <div className="flex items-center gap-2">
             <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
             <span>Synced</span>
           </div>
        </div>
      </Card>

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
              Update ORI number for {selectedDevices.size} selected device{selectedDevices.size !== 1 ? 's' : ''}. 
              Leave empty to clear ORI number.
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
                  if (e.key === 'Enter' && !e.shiftKey) {
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
              disabled={loadingActions.has('bulk-ori')}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkOriSave}
              disabled={loadingActions.has('bulk-ori')}
            >
              {loadingActions.has('bulk-ori') ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Update {selectedDevices.size} Device{selectedDevices.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
