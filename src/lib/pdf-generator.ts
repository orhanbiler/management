import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Device } from '@/types'
import { secureLog } from '@/lib/security'

interface PDFContent {
  subject: string
  body: string
  warning?: string
  recipient?: string
}

export async function generatePDF({ subject, body, warning, recipient }: PDFContent, filename: string = 'document.pdf') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10 // Reduced top margin to move banner up
  const leftMargin = 25
  const bannerMargin = 15 // Increased side margin to shorten banner width
  const contentWidth = pageWidth - (leftMargin * 2)
  const bannerWidth = pageWidth - (bannerMargin * 2) // Banner with more side margin
  let yPosition = margin

  // Load and add banner image
  try {
    const bannerDataUrl = await loadImageAsDataUrl('/banner.png')
    const bannerImg = new Image()
    await new Promise((resolve, reject) => {
      bannerImg.onload = resolve
      bannerImg.onerror = reject
      bannerImg.src = bannerDataUrl
    })
    
    const bannerAspectRatio = bannerImg.width / bannerImg.height
    const bannerHeight = bannerWidth / bannerAspectRatio
    
    doc.addImage(bannerDataUrl, 'PNG', bannerMargin, yPosition, bannerWidth, bannerHeight)
    yPosition += bannerHeight + 12 // Reduced spacing from 15 to 12
  } catch (error: unknown) {
    secureLog('warn', 'Error loading banner image for PDF')
    // Continue without banner if image fails to load
    yPosition += 10
  }

  // MEMO TITLE
  doc.setFontSize(24) // Increased from 18 to 24
  doc.setFont('times', 'bold')
  doc.text('Memo', leftMargin, yPosition)
  yPosition += 10 // Reduced from 12 to 10

  // Parse body to extract memo fields
  const memoFields = parseMemoBody(body)
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // MEMO HEADER SECTION
  doc.setFontSize(11)
  
  // TO field
  doc.setFont('times', 'bold')
  doc.text('To:', leftMargin, yPosition)
  doc.setFont('times', 'normal')
  // Use extracted TO or default to Chief of Police
  let toText = 'Chief of Police'
  
  // If recipient is explicitly provided (e.g. for officer email), use that
  if (recipient) {
    // Clean up recipient email address to just show name if possible, or leave as is
    // For now, let's assume recipient passed here is what we want to show if it's not an email
    // But actually, the recipient field in PDFContent seems to be email address in the calling code.
    // Let's stick to memoFields.to if available, otherwise logic below.
  }
  
  if (memoFields.to) {
    // Clean up the TO field - remove extra address lines
    const toLines = memoFields.to.split('\n').filter(line => {
      const trimmed = line.trim()
      return trimmed && !trimmed.match(/^(Maryland State Police|1201 Reisterstown|Pikesville, MD)/i)
    })
    if (toLines.length > 0) {
      toText = toLines.join('\n')
    }
  }
  const toLines = doc.splitTextToSize(toText, contentWidth - 25)
  doc.text(toLines, leftMargin + 25, yPosition)
  yPosition += Math.max(toLines.length * 5, 5) // Reduced spacing from 6/8 to 5

  // FROM field
  doc.setFont('times', 'bold')
  doc.text('From:', leftMargin, yPosition)
  doc.setFont('times', 'normal')
  const fromText = 'Sgt. Biler #1717'
  doc.text(fromText, leftMargin + 25, yPosition)
  yPosition += 5 // Reduced from 8 to 5

  // DATE field
  doc.setFont('times', 'bold')
  doc.text('Date:', leftMargin, yPosition)
  doc.setFont('times', 'normal')
  const dateText = memoFields.date || today
  doc.text(dateText, leftMargin + 25, yPosition)
  yPosition += 5 // Reduced from 8 to 5

  // RE field
  doc.setFont('times', 'bold')
  doc.text('Re:', leftMargin, yPosition)
  doc.setFont('times', 'normal')
  const reText = memoFields.subject || subject.replace('Subject: ', '')
  const reLines = doc.splitTextToSize(reText, contentWidth - 25)
  doc.text(reLines, leftMargin + 25, yPosition)
  yPosition += Math.max(reLines.length * 5, 5) + 15 // Added more spacing before body content

  // Add warning if present
  if (warning) {
    doc.setFontSize(10)
    doc.setTextColor(200, 0, 0)
    doc.setFont('times', 'bold')
    doc.text('⚠ WARNING:', leftMargin, yPosition)
    yPosition += 6
    doc.setTextColor(0, 0, 0)
    doc.setFont('times', 'normal')
    const warningLines = doc.splitTextToSize(warning, contentWidth)
    doc.text(warningLines, leftMargin, yPosition)
    yPosition += warningLines.length * 6 + 8
  }

  // BODY CONTENT SECTION
  doc.setFontSize(11)
  doc.setFont('times', 'normal')
  doc.setTextColor(0, 0, 0)
  
  // Format body content - handle line breaks and formatting
  const formattedBody = formatBodyContent(memoFields.body || body)
  const bodyLines = formattedBody.split('\n')
  
  // Process body lines with better formatting
  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i].trim()
    
    // Check for page break
    if (yPosition > pageHeight - margin - 15) {
      doc.addPage()
      yPosition = margin
    }
    
    // Skip empty lines at start
    if (!line && i === 0) continue
    
    // Handle device list items (Server, Domain, Serial Number, MDT ORI)
    if (line.match(/^(Server|Domain|Serial Number|MDT ORI):/i)) {
      const [label, value] = line.split(':').map(s => s.trim())
      doc.setFont('times', 'bold')
      doc.text(`${label}:`, leftMargin + 5, yPosition)
      doc.setFont('times', 'normal')
      const valueX = leftMargin + 45
      const valueLines = doc.splitTextToSize(value, contentWidth - 50)
      doc.text(valueLines, valueX, yPosition)
      yPosition += Math.max(valueLines.length * 6, 6)
      continue
    }
    
    // Handle list items with dashes or numbers
    if (line.match(/^[-•]\s/) || line.match(/^\d+\.\s/)) {
      doc.text(line, leftMargin + 5, yPosition)
      yPosition += 6
      continue
    }
    
    // Handle regular paragraphs
    if (line) {
      const paragraphLines = doc.splitTextToSize(line, contentWidth)
      paragraphLines.forEach((paraLine: string) => {
        if (yPosition > pageHeight - margin - 15) {
          doc.addPage()
          yPosition = margin
        }
        doc.text(paraLine, leftMargin, yPosition)
        yPosition += 6
      })
    } else {
      // Empty line for spacing
      yPosition += 4
    }
  }

  // Add signature section - positioned after content, aligned with content margin
  // Position it higher up on the page
  const signatureY = Math.max(yPosition + 10, pageHeight - 80) // Moved up more (80mm from bottom)
  const rightMargin = 5 // Additional margin on the right side
  const rightAlignX = pageWidth - leftMargin - rightMargin // Use content margin (25mm) plus extra right margin
    
  // Format signature in a more compact style
  doc.setFontSize(10)
  doc.setFont('times', 'normal')
  doc.setTextColor(0, 0, 0)
  
  // Name and title on same line or close together
  const nameText = 'Orhan Biler #1717'
  const nameWidth = doc.getTextWidth(nameText)
  doc.text(nameText, rightAlignX - nameWidth, signatureY)
  
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  const titleText = 'Sergeant, Cheverly Police Department'
  const titleWidth = doc.getTextWidth(titleText)
  doc.text(titleText, rightAlignX - titleWidth, signatureY + 4)
  
  // Email with mailto link
  doc.setFontSize(8)
  doc.setTextColor(0, 0, 255) // Blue color for link
  const emailText = 'obiler@cheverlypolice.org'
  const emailWidth = doc.getTextWidth(emailText)
  const emailX = rightAlignX - emailWidth
  doc.textWithLink(emailText, emailX, signatureY + 8, { url: 'mailto:obiler@cheverlypolice.org' })
  
  // Contact info on one line, more compact
  doc.setTextColor(100, 100, 100)
  const contactText = 'Office: 301-341-1055  |  Fax: 301-341-0176'
  const contactWidth = doc.getTextWidth(contactText)
  doc.text(contactText, rightAlignX - contactWidth, signatureY + 12)

  // Save the PDF
  doc.save(filename)
}

export async function generateDeviceListPDF(devices: Device[], filename: string = 'device_inventory.pdf') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10
  const contentWidth = pageWidth - (margin * 2) // Banner width = table width
  let yPosition = margin

  // Load and add banner image
  try {
    const bannerDataUrl = await loadImageAsDataUrl('/banner.png')
    const bannerImg = new Image()
    await new Promise((resolve, reject) => {
      bannerImg.onload = resolve
      bannerImg.onerror = reject
      bannerImg.src = bannerDataUrl
    })
    
    // Calculate banner dimensions to fit width while maintaining aspect ratio
    const bannerAspectRatio = bannerImg.width / bannerImg.height
    const bannerHeight = contentWidth / bannerAspectRatio
    
    doc.addImage(bannerDataUrl, 'PNG', margin, yPosition, contentWidth, bannerHeight)
    yPosition += bannerHeight + 10
  } catch (error: unknown) {
    secureLog('warn', 'Error loading banner image for device list PDF')
    yPosition += 10
  }

  // Title and Date
  doc.setFontSize(14)
  doc.setFont('times', 'bold')
  doc.text('Device Inventory List', margin, yPosition)
  
  doc.setFontSize(8)
  doc.setFont('times', 'normal')
  const dateStr = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  doc.text(`Generated: ${dateStr}`, pageWidth - margin - doc.getTextWidth(`Generated: ${dateStr}`), yPosition)
  
  yPosition += 8

  // Calculate statistics for pie charts
  const stats = {
    byOS: {
      'Windows 11': devices.filter(d => d.operating_system === 'Windows 11' || !d.operating_system).length,
      'Windows 10': devices.filter(d => d.operating_system === 'Windows 10').length,
      'Windows 8': devices.filter(d => d.operating_system === 'Windows 8').length,
      'Windows 7': devices.filter(d => d.operating_system === 'Windows 7').length,
    },
    pidRegistered: devices.filter(d => d.pid_registered === true).length,
    pidNotRegistered: devices.filter(d => d.pid_registered !== true).length,
    byStatus: {
      Assigned: devices.filter(d => d.status === 'Assigned').length,
      Unassigned: devices.filter(d => d.status === 'Unassigned').length,
      Retired: devices.filter(d => d.status === 'Retired').length,
      Unknown: devices.filter(d => d.status === 'Unknown').length,
    },
    total: devices.length
  }

  // Draw Pie Charts Section
  const chartRadius = 18
  const chartY = yPosition + chartRadius + 5
  const chartSpacing = contentWidth / 3
  
  // Chart 1: OS Distribution (left)
  const osChart1X = margin + chartSpacing / 2
  drawPieChart(doc, osChart1X, chartY, chartRadius, [
    { value: stats.byOS['Windows 11'], color: [14, 165, 233], label: 'Win 11' },
    { value: stats.byOS['Windows 10'], color: [139, 92, 246], label: 'Win 10' },
    { value: stats.byOS['Windows 8'], color: [245, 158, 11], label: 'Win 8' },
    { value: stats.byOS['Windows 7'], color: [239, 68, 68], label: 'Win 7' },
  ], 'OS Distribution')

  // Chart 2: PID Registration (center)
  const pidChartX = margin + chartSpacing * 1.5
  drawPieChart(doc, pidChartX, chartY, chartRadius, [
    { value: stats.pidRegistered, color: [16, 185, 129], label: 'Registered' },
    { value: stats.pidNotRegistered, color: [239, 68, 68], label: 'Not Reg.' },
  ], 'PID Status')

  // Chart 3: Assignment Status (right)
  const statusChartX = margin + chartSpacing * 2.5
  drawPieChart(doc, statusChartX, chartY, chartRadius, [
    { value: stats.byStatus.Assigned, color: [34, 197, 94], label: 'Assigned' },
    { value: stats.byStatus.Unassigned, color: [59, 130, 246], label: 'Unassigned' },
    { value: stats.byStatus.Retired, color: [107, 114, 128], label: 'Retired' },
    { value: stats.byStatus.Unknown, color: [245, 158, 11], label: 'Unknown' },
  ], 'Status')

  yPosition = chartY + chartRadius + 20

  // Prepare table data
  const tableHead = [['S/N', 'PID', 'Asset', 'Type', 'OS', 'Status', 'Officer', 'Assigned']]
  const tableBody = devices.map(device => [
    device.serial_number || '-',
    device.pid_number || '-',
    device.asset_id || '-',
    device.device_type || '-',
    formatOS(device.operating_system),
    device.status || '-',
    device.officer || '-',
    formatDateForPDF(device.assignment_date)
  ])

  // Generate table - width matches banner width
  autoTable(doc, {
    startY: yPosition,
    head: tableHead,
    body: tableBody,
    theme: 'striped',
    tableWidth: contentWidth,
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 24 }, // S/N
      1: { cellWidth: 24 }, // PID
      2: { cellWidth: 18 }, // Asset
      3: { cellWidth: 20 }, // Type
      4: { cellWidth: 16 }, // OS
      5: { cellWidth: 22 }, // Status
      6: { cellWidth: 42 }, // Officer (wider)
      7: { cellWidth: 24 }  // Date
    },
    margin: { top: margin, right: margin, bottom: margin, left: margin },
    didDrawPage: (data) => {
      // Add page number at the bottom
      const str = 'Page ' + doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.text(str, pageWidth - margin - 10, pageHeight - 5)
    }
  })

  doc.save(filename)
}

// Helper function to draw a pie chart
function drawPieChart(
  doc: jsPDF, 
  centerX: number, 
  centerY: number, 
  radius: number, 
  data: { value: number; color: [number, number, number]; label: string }[],
  title: string
) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return

  // Draw title
  doc.setFontSize(8)
  doc.setFont('times', 'bold')
  doc.setTextColor(0, 0, 0)
  const titleWidth = doc.getTextWidth(title)
  doc.text(title, centerX - titleWidth / 2, centerY - radius - 5)

  // Draw pie slices
  let startAngle = -Math.PI / 2 // Start from top
  
  data.forEach((slice) => {
    if (slice.value === 0) return
    
    const sliceAngle = (slice.value / total) * 2 * Math.PI
    const endAngle = startAngle + sliceAngle
    
    // Draw slice using path
    doc.setFillColor(slice.color[0], slice.color[1], slice.color[2])
    
    // Create pie slice path
    const steps = 50
    const points: [number, number][] = [[centerX, centerY]]
    
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (sliceAngle * i / steps)
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      points.push([x, y])
    }
    
    // Draw the slice
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.5)
    
    // Move to center, then draw arc
    let pathStr = `${points[0][0]} ${points[0][1]} m `
    for (let i = 1; i < points.length; i++) {
      pathStr += `${points[i][0]} ${points[i][1]} l `
    }
    pathStr += 'h f'
    
    // Use triangle fan approach for filled pie
    for (let i = 1; i < points.length - 1; i++) {
      doc.triangle(
        points[0][0], points[0][1],
        points[i][0], points[i][1],
        points[i + 1][0], points[i + 1][1],
        'F'
      )
    }
    
    startAngle = endAngle
  })

  // Draw legend below chart
  doc.setFontSize(6)
  doc.setFont('times', 'normal')
  let legendY = centerY + radius + 4
  const legendItemWidth = (radius * 2) / Math.min(data.filter(d => d.value > 0).length, 2)
  let legendX = centerX - radius
  let itemCount = 0
  
  data.forEach((slice) => {
    if (slice.value === 0) return
    
    const percent = Math.round((slice.value / total) * 100)
    
    // Color box
    doc.setFillColor(slice.color[0], slice.color[1], slice.color[2])
    doc.rect(legendX, legendY - 2, 3, 3, 'F')
    
    // Label
    doc.setTextColor(60, 60, 60)
    doc.text(`${slice.label} ${percent}%`, legendX + 4, legendY)
    
    itemCount++
    if (itemCount % 2 === 0) {
      legendY += 4
      legendX = centerX - radius
    } else {
      legendX += legendItemWidth + 2
    }
  })
}

function parseMemoBody(body: string): { to?: string; from?: string; date?: string; subject?: string; body: string } {
  const lines = body.split('\n')
  const result: { to?: string; from?: string; date?: string; subject?: string; body: string } = { body: '' }
  
  let toLines: string[] = []
  let bodyLines: string[] = []
  let inToSection = false
  let foundSubject = false
  let foundGreeting = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // Skip empty lines at the start
    if (!trimmedLine && i === 0) continue
    
    // Extract date at the beginning
    if (i === 0 && trimmedLine.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)/i)) {
      continue
    }
    
    // Extract TO section - starts with CSO
    if (trimmedLine.match(/^CSO/i)) {
      inToSection = true
      toLines.push(trimmedLine)
      continue
    }
    
    // Continue TO section - collect address lines until Subject
    if (inToSection) {
      if (trimmedLine.match(/^(Subject|SUBJECT):/i)) {
        // Subject found, end TO section
        result.subject = trimmedLine.replace(/^(Subject|SUBJECT):\s*/i, '')
        foundSubject = true
        inToSection = false
        continue
      }
      // Collect TO address lines
      if (trimmedLine) {
        toLines.push(trimmedLine)
      }
      continue
    }
    
    // Extract SUBJECT if not already found
    if (trimmedLine.match(/^(Subject|SUBJECT):/i) && !foundSubject) {
      result.subject = trimmedLine.replace(/^(Subject|SUBJECT):\s*/i, '')
      foundSubject = true
      continue
    }
    
    // Skip greeting line
    if (trimmedLine.match(/^(To Whom It May Concern,?)$/i)) {
      foundGreeting = true
      continue
    }
    
    // Skip signature and contact info lines
    if (trimmedLine.match(/^(Sincerely|Orhan Biler|Sergeant|Cheverly Police Department|6401 Forest Road|Office|Fax)/i)) {
      continue
    }
    
    // Skip duplicate date lines
    if (trimmedLine.match(/^(January|February|March|April|May|June|July|August|September|October|November|December).*\d{4}/i)) {
      continue
    }
    
    // Skip duplicate subject line if standalone
    if (trimmedLine.match(/^Request PID registration$/i) && foundSubject) {
      continue
    }
    
    // After greeting is found, or if no greeting but we have subject, capture body content
    if (foundGreeting || (foundSubject && !inToSection)) {
      bodyLines.push(line)
    }
  }
  
  // Format TO field - extract names only, remove address
  if (toLines.length > 0) {
    const cleanedTo = toLines
      .map(line => line.trim())
      .filter(line => {
        // Keep CSO names, remove address lines
        return line && 
               !line.match(/^(Maryland State Police|1201 Reisterstown|Pikesville, MD)/i) &&
               !line.match(/^To Whom It May Concern/i)
      })
      .join('\n')
      .trim()
    
    if (cleanedTo) {
      result.to = cleanedTo
    }
  }
  
  // Clean up body - remove redundant headers but keep content
  let cleanedBody = bodyLines.join('\n')
  
  // Remove date at start if it's standalone
  cleanedBody = cleanedBody.replace(/^(January|February|March|April|May|June|July|August|September|October|November|December).*\d{4}\s*$/gmi, '')
  
  // Remove TO section if it appears in body (but keep if it's part of content)
  cleanedBody = cleanedBody.replace(/^(CSO Dean Rohan[\s\S]*?Pikesville, MD 21208)\s*\n\n/gmi, '')
  
  // Remove Subject line if it appears as standalone
  cleanedBody = cleanedBody.replace(/^(Subject|SUBJECT):\s*.*\s*$/gmi, '')
  
  // Remove greeting if standalone
  cleanedBody = cleanedBody.replace(/^(To Whom It May Concern,?)\s*$/gmi, '')
  
  // Remove signature block - be more specific
  cleanedBody = cleanedBody.replace(/Sincerely,\s*\n\n[\s\S]*?Office.*$/gmi, '')
  
  // Remove duplicate subject/request lines if standalone
  cleanedBody = cleanedBody.replace(/^Request PID registration\s*$/gmi, '')
  
  // Clean up multiple blank lines but preserve content
  cleanedBody = cleanedBody.replace(/\n{3,}/g, '\n\n')
  
  result.body = cleanedBody.trim()
  
  return result
}

function formatBodyContent(body: string): string {
  // Clean up the body content - remove headers but preserve actual content
  let formatted = body
  
  // Remove date at start if standalone
  formatted = formatted.replace(/^(January|February|March|April|May|June|July|August|September|October|November|December).*\d{4}\s*$/gmi, '')
  
  // Remove TO section completely (address block)
  formatted = formatted.replace(/^(CSO Dean Rohan[\s\S]*?Pikesville, MD 21208)\s*\n\n/gmi, '')
  formatted = formatted.replace(/^(CSO[\s\S]*?Pikesville, MD 21208)\s*\n\n/gmi, '')
  
  // Remove Subject line if standalone
  formatted = formatted.replace(/^(Subject|SUBJECT):\s*.*\s*$/gmi, '')
  
  // Remove greeting if standalone
  formatted = formatted.replace(/^(To Whom It May Concern,?)\s*$/gmi, '')
  
  // Remove signature block - be careful not to remove content
  formatted = formatted.replace(/Sincerely,\s*\n\n[\s\S]*?Office.*$/gmi, '')
  formatted = formatted.replace(/Orhan Biler\s*\n[\s\S]*?Fax.*$/gmi, '')
  
  // Remove duplicate subject/request lines if standalone
  formatted = formatted.replace(/^Request PID registration\s*$/gmi, '')
  
  // Format device information better
  formatted = formatted.replace(/^Server:\s*/gmi, 'Server: ')
  formatted = formatted.replace(/^Domain:\s*/gmi, 'Domain: ')
  formatted = formatted.replace(/^Serial Number:\s*/gmi, 'Serial Number: ')
  formatted = formatted.replace(/^MDT ORI:\s*/gmi, 'MDT ORI: ')
  
  // Format numbered lists better
  formatted = formatted.replace(/^(\d+)\.\s*/gm, '$1. ')
  
  // Clean up multiple blank lines but preserve content
  formatted = formatted.replace(/\n{3,}/g, '\n\n')
  
  return formatted.trim()
}

function formatOS(os: string | undefined): string {
  if (!os) return 'Win 11'
  // Shorten "Windows X" to "Win X" for PDF
  return os.replace('Windows ', 'Win ')
}

function formatDateForPDF(dateStr: string | undefined): string {
  if (!dateStr || dateStr === '-') return '-'
  
  try {
    // Handle ISO date format (YYYY-MM-DD) or other common formats
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr // Return original if invalid
    
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = date.getFullYear()
    
    return `${month}/${day}/${year}`
  } catch {
    return dateStr // Return original on error
  }
}

function loadImageAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0)
      try {
        const dataUrl = canvas.toDataURL('image/png')
        resolve(dataUrl)
      } catch (error) {
        reject(error)
      }
    }
    img.onerror = reject
    img.src = src
  })
}
