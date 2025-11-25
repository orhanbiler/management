"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  FileSearch, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  FileDown,
  Loader2,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { Device, DeviceFormData } from "@/types"
import { secureLog, sanitizeAlphanumeric } from "@/lib/security"

interface PidComparisonModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inventory: Device[]
  onAddDevices?: (devices: DeviceFormData[]) => Promise<void>
}

export function PidComparisonModal({ open, onOpenChange, inventory, onAddDevices }: PidComparisonModalProps) {
  const [pidList, setPidList] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAddingDevices, setIsAddingDevices] = useState(false)

  // Normalize and sanitize PID numbers for comparison
  const normalizePid = (pid: string) => sanitizeAlphanumeric(pid.trim())

  // Parse PID list from textarea (supports newlines, commas, spaces)
  const parsedPids = useMemo(() => {
    if (!pidList.trim()) return []
    
    return pidList
      .split(/[\n,;]+/)
      .map(pid => normalizePid(pid))
      .filter(pid => pid.length > 0)
  }, [pidList])

  // Compare PIDs against inventory
  const comparison = useMemo(() => {
    if (parsedPids.length === 0) {
      return { found: [], missing: [], foundDevices: [] }
    }

    const inventoryPids = new Map<string, Device>()
    inventory.forEach(device => {
      if (device.pid_number && device.pid_number.trim()) {
        inventoryPids.set(normalizePid(device.pid_number), device)
      }
    })

    const found: string[] = []
    const missing: string[] = []
    const foundDevices: Device[] = []

    parsedPids.forEach(pid => {
      if (inventoryPids.has(pid)) {
        found.push(pid)
        foundDevices.push(inventoryPids.get(pid)!)
      } else {
        missing.push(pid)
      }
    })

    return { found, missing, foundDevices }
  }, [parsedPids, inventory])

  const handleProcess = () => {
    if (parsedPids.length === 0) {
      toast.error("Please enter at least one PID number")
      return
    }
    setIsProcessing(true)
    setTimeout(() => setIsProcessing(false), 500)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const exportMissingPids = () => {
    if (comparison.missing.length === 0) {
      toast.info("No missing PIDs to export")
      return
    }

    const content = comparison.missing.join("\n")
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `missing_pids_${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Missing PIDs exported")
  }

  const handleAddMissingPids = async () => {
    if (comparison.missing.length === 0) {
      toast.error("No missing PIDs to add")
      return
    }

    if (!onAddDevices) {
      toast.error("Add devices function not available")
      return
    }

    setIsAddingDevices(true)
    try {
      const devicesToAdd: DeviceFormData[] = comparison.missing.map(pid => ({
        serial_number: "",
        pid_number: pid,
        asset_id: "UNKNOWN",
        device_type: "Toughbook",
        status: "Unknown",
        to_be_retired: false,
        officer: "",
        assignment_date: "",
        notes: ""
      }))

      await onAddDevices(devicesToAdd)
      toast.success(`Successfully added ${comparison.missing.length} device(s) to the system`)
      
      // Clear the PID list and close modal after successful add
      setPidList("")
      setTimeout(() => {
        onOpenChange(false)
      }, 1000)
    } catch (error: unknown) {
      secureLog("error", "Error adding devices")
      const errorObj = error as { message?: string }
      toast.error(errorObj?.message || "Failed to add devices. Please try again.")
    } finally {
      setIsAddingDevices(false)
    }
  }

  const exportFoundPids = () => {
    if (comparison.found.length === 0) {
      toast.info("No found PIDs to export")
      return
    }

    const content = comparison.found.join("\n")
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `found_pids_${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Found PIDs exported")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            PID Comparison Tool
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Paste your list of PID numbers below (one per line, or separated by commas/semicolons). 
              The tool will compare them against your current inventory.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>PID Numbers List</Label>
            <Textarea
              placeholder="Paste PID numbers here...&#10;Example:&#10;Z100A13927&#10;Z100B12345&#10;Z100C67890"
              value={pidList}
              onChange={(e) => setPidList(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {parsedPids.length > 0 
                  ? `${parsedPids.length} PID${parsedPids.length !== 1 ? "s" : ""} detected`
                  : "Enter PID numbers to compare"}
              </span>
              {pidList.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPidList("")
                    toast.info("Cleared PID list")
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {parsedPids.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Total Input</div>
                  <div className="text-2xl font-bold">{parsedPids.length}</div>
                </div>
                <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Found in System
                  </div>
                  <div className="text-2xl font-bold text-green-600">{comparison.found.length}</div>
                </div>
                <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-950/20">
                  <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Missing
                  </div>
                  <div className="text-2xl font-bold text-red-600">{comparison.missing.length}</div>
                </div>
              </div>

              {comparison.found.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-green-700 dark:text-green-400">
                      Found PIDs ({comparison.found.length})
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(comparison.found.join("\n"), "Found PIDs")}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportFoundPids}
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        Export
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[150px] overflow-y-auto p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-900">
                    <div className="flex flex-wrap gap-2">
                      {comparison.found.map((pid, idx) => (
                        <Badge key={idx} variant="outline" className="bg-white dark:bg-gray-900">
                          {pid}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {comparison.missing.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-red-700 dark:text-red-400">
                      Missing PIDs ({comparison.missing.length})
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(comparison.missing.join("\n"), "Missing PIDs")}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportMissingPids}
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        Export
                      </Button>
                      {onAddDevices && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleAddMissingPids}
                          disabled={isAddingDevices}
                        >
                          {isAddingDevices ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Add to System
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[150px] overflow-y-auto p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-900">
                    <div className="flex flex-wrap gap-2">
                      {comparison.missing.map((pid, idx) => (
                        <Badge key={idx} variant="outline" className="bg-white dark:bg-gray-900 text-red-700 dark:text-red-400">
                          {pid}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {comparison.found.length === parsedPids.length && (
                <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    All PIDs are found in your system! ✓
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

