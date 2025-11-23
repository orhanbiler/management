import { jsPDF } from 'jspdf'

interface PDFContent {
  subject: string
  body: string
  warning?: string
}

export async function generatePDF({ subject, body, warning }: PDFContent, filename: string = 'document.pdf') {
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
  } catch (error) {
    console.error('Error loading banner image:', error)
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

