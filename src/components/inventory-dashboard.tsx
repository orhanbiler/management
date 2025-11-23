"use client"

import { useEffect, useState } from "react"
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy
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
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
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
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { generatePDF } from "@/lib/pdf-generator"

export function InventoryDashboard() {
  const [inventory, setInventory] = useState<Device[]>([])
  const [filteredInventory, setFilteredInventory] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  
  // Sorting State
  const [sortBy, setSortBy] = useState<"asset_id" | "serial_number" | "pid_number" | "officer" | "status">("asset_id")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Modal State
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [emailData, setEmailData] = useState({ subject: "", body: "", warning: "", recipient: "" })
  
  // Bulk Selection State
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  
  // Loading States
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set())

  // Data Fetching
  useEffect(() => {
    if (!db) {
      // Mock Data Mode
      console.warn("No Firestore connection. Using mock data.")
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
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Device[]
      setInventory(data)
      setIsLoading(false)
    }, (error) => {
      console.error("Error fetching data:", error)
      toast.error("Failed to sync data from Firestore")
      setIsLoading(false)
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
  }, [inventory, searchQuery, statusFilter, sortBy, sortOrder])

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
      const payload = {
        ...data,
        updated_at: new Date().toISOString()
      }

      if (editingDevice) {
        if (db) {
          await updateDoc(doc(db, "toughbooks", editingDevice.id), payload)
        } else {
          // Mock Update
          setInventory(prev => prev.map(i => i.id === editingDevice.id ? { ...i, ...payload } : i))
        }
        toast.success("Device updated successfully")
      } else {
        if (db) {
          await addDoc(collection(db, "toughbooks"), payload)
        } else {
          // Mock Add
          setInventory(prev => [...prev, { id: Date.now().toString(), ...payload }])
        }
        toast.success("Device added successfully")
      }
      setEditingDevice(null)
    } catch (error) {
      console.error("Save error:", error)
      toast.error("Failed to save record")
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

  // Email Logic
  const handleCapwinEmail = (device: Device) => {
    setLoadingActions(prev => new Set(prev).add(`capwin-${device.id}`))
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const subject = `New Device PID Registration: ${device.pid_number} / ${device.serial_number}`
    
    const body = `${today}\n\n` +
      `CSO Dean Rohan, CSO Diana Riley\n` +
      `Maryland State Police\n` +
      `1201 Reisterstown Road\n` +
      `Pikesville, MD 21208\n\n` +
      `Subject: Request PID registration\n\n` +
      `To Whom It May Concern,\n\n` +
      `Could you please register the below PID for Cap Win connection. It will be utilized by authorized personnel.\n\n` +
      `Server: CAPWIN1\n` +
      `Domain: Z100\n` +
      `Serial Number: ${device.serial_number}\n` +
      `MDT ORI: MD0170501\n\n` +
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
  }

  const handleOfficerEmail = (device: Device) => {
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
    if (selectedDevices.size === 0) {
      toast.error("Please select at least one device")
      return
    }
    setLoadingActions(prev => new Set(prev).add('bulk-capwin'))

    const selectedDeviceList = filteredInventory.filter(d => selectedDevices.has(d.id))
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
      `${deviceList}\n` +
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
  }

  const handleBulkOfficerEmail = () => {
    if (selectedDevices.size === 0) {
      toast.error("Please select at least one device")
      return
    }
    setLoadingActions(prev => new Set(prev).add('bulk-officer'))

    const selectedDeviceList = filteredInventory.filter(d => selectedDevices.has(d.id))
    const assignedDevices = selectedDeviceList.filter(d => d.status === "Assigned" && d.officer)
    
    if (assignedDevices.length === 0) {
      toast.error("No assigned devices selected. Please select devices that are assigned to officers.")
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

      const filename = `pid_deactivation_${device.pid_number}_${device.serial_number}.pdf`
      await generatePDF({ subject, body, warning: "" }, filename)
      toast.success("Deactivation PDF downloaded successfully")
    } catch (error) {
      console.error("Error generating deactivation PDF:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete(`deactivate-${device.id}`)
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
        `${deviceList}\n` +
        `If you should have any questions or concerns pertaining to this request, please contact me at 301-341-1055.\n\n` +
        `Sincerely,\n\n` +
        `Orhan Biler\n` +
        `Sergeant\n` +
        `Cheverly Police Department\n` +
        `6401 Forest Road |Cheverly, MD 20785\n` +
        `Office 301-341-1055 / Fax 301-341-0176`

      const filename = `bulk_pid_deactivation_${selectedDeviceList.length}_devices.pdf`
      await generatePDF({ subject, body, warning: "" }, filename)
      toast.success(`Deactivation PDF downloaded for ${selectedDeviceList.length} device(s)`)
    } catch (error) {
      console.error("Error generating bulk deactivation PDF:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev)
        newSet.delete('bulk-deactivate')
        return newSet
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-1/3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search SN, PID, or Officer..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="Unassigned">Unassigned</SelectItem>
                  <SelectItem value="Retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedDevices.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-md border border-primary/20">
                <span className="text-sm font-medium text-primary">{selectedDevices.size} selected</span>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleBulkCapwinEmail}
                        disabled={loadingActions.has('bulk-capwin')}
                      >
                        {loadingActions.has('bulk-capwin') ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <FileSignature className="h-3 w-3 mr-1" />
                        )}
                        Bulk CAPWIN
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate CAPWIN email for selected devices</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleBulkOfficerEmail}
                        disabled={loadingActions.has('bulk-officer')}
                      >
                        {loadingActions.has('bulk-officer') ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        Bulk Notify
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate notification emails for selected devices</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleBulkDeactivationPDF}
                        disabled={loadingActions.has('bulk-deactivate')}
                      >
                        {loadingActions.has('bulk-deactivate') ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <FileX className="h-3 w-3 mr-1" />
                        )}
                        Bulk Deactivate PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate deactivation PDF for selected devices</TooltipContent>
                  </Tooltip>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDevices(new Set())}>
                    Clear
                  </Button>
                </div>
              </div>
            )}
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" /> Add Device
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden shadow-sm border-t-0">
        <Table>
          <TableHeader className="bg-muted/50">
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
          </TableHeader>
          <TableBody>
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
                  <TableRow key={device.id} className={mismatch ? "bg-red-50/50 hover:bg-red-100/60" : "hover:bg-muted/50"}>
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
                      {(device.device_type === "Desktop" || device.device_type === "Other") && device.ori_number ? (
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
                        device.pid_number
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
                        device.status === "Unassigned" ? "info" : "outline"
                      }>
                        {device.status}
                      </Badge>
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
          </TableBody>
        </Table>
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
      />

      <EmailModal 
        open={isEmailModalOpen}
        onOpenChange={setIsEmailModalOpen}
        subject={emailData.subject}
        body={emailData.body}
        warning={emailData.warning}
        recipientEmail={emailData.recipient}
      />
    </div>
  )
}
