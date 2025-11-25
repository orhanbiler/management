"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Copy, Mail, FileDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { generatePDF } from "@/lib/pdf-generator"
import { secureLog } from "@/lib/security"

interface EmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject: string
  body: string
  warning?: string
  recipientEmail?: string // Optional, for mailto link
}

export function EmailModal({ open, onOpenChange, subject, body, warning, recipientEmail }: EmailModalProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isOpeningMail, setIsOpeningMail] = useState(false)
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const handleOpenMailClient = () => {
    setIsOpeningMail(true)
    try {
      const encodedSubject = encodeURIComponent(subject)
      const encodedBody = encodeURIComponent(body)
      const mailtoLink = `mailto:${recipientEmail || ""}?subject=${encodedSubject}&body=${encodedBody}`
      window.location.href = mailtoLink
      toast.info("Opening email client...")
    } finally {
      setTimeout(() => setIsOpeningMail(false), 1000)
    }
  }

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true)
    try {
      if (!subject || !body) {
        throw new Error("Email content is missing")
      }
      
      const filename = subject.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf'
      await generatePDF({ subject, body, warning }, filename)
      toast.success("PDF downloaded successfully")
    } catch (error: unknown) {
      secureLog("error", "Error generating PDF")
      const errorObj = error as { message?: string }
      toast.error(errorObj?.message ? `Failed to generate PDF: ${errorObj.message}` : "Failed to generate PDF. Please try again.")
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Generated Email Draft
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {warning && (
            <Alert variant="destructive" className="bg-amber-50 text-amber-800 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Subject</Label>
            <div className="flex gap-2">
              <Input value={subject} readOnly />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(subject, "Subject")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Body Content</Label>
            <div className="relative">
              <Textarea value={body} readOnly className="min-h-[300px] font-mono text-sm p-4" />
              <Button 
                variant="secondary" 
                size="sm" 
                className="absolute top-2 right-2 h-7 text-xs"
                onClick={() => copyToClipboard(body, "Body")}
              >
                <Copy className="h-3 w-3 mr-1" /> Copy Body
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
           <div className="text-xs text-muted-foreground self-center hidden sm:block">
             {recipientEmail ? `Recipient: ${recipientEmail}` : "No recipient email detected"}
           </div>
           <div className="flex gap-2">
             <Button variant="outline" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
               {isGeneratingPDF ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Generating...
                 </>
               ) : (
                 <>
                   <FileDown className="mr-2 h-4 w-4" /> Download PDF
                 </>
               )}
             </Button>
             <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGeneratingPDF || isOpeningMail}>Close</Button>
             <Button onClick={handleOpenMailClient} disabled={isGeneratingPDF || isOpeningMail}>
               {isOpeningMail ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Opening...
                 </>
               ) : (
                 "Open Mail Client"
               )}
             </Button>
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

