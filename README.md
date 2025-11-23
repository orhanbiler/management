# Device Management System

A comprehensive inventory management system for tracking and managing devices (Toughbooks, Laptops, Desktops, etc.) with CAPWIN PID registration and PDF generation capabilities.

## Features

### 🔐 Authentication
- Secure login with Firebase Authentication
- Protected routes and user session management

### 📦 Device Management
- **Add/Edit Devices**: Full CRUD operations for device inventory
- **Device Types**: Support for Toughbook, Laptop, Desktop, and Other device types
- **Asset Tracking**: Asset ID tracking with automatic sorting
- **ORI Numbers**: Conditional ORI number field for Desktop and Other device types
- **Status Management**: Track device status (Assigned, Unassigned, Retired)
- **Officer Assignment**: Assign devices to officers with assignment dates

### 📊 Inventory Dashboard
- **Real-time Sync**: Live updates from Firebase Firestore
- **Advanced Search**: Search by serial number, PID, asset ID, or ORI number
- **Status Filtering**: Filter devices by status
- **Sortable Columns**: Sort by Asset ID (default descending), Serial Number, PID, Officer, or Status
- **PID Validation**: Automatic PID mismatch detection and warnings
- **Bulk Selection**: Select multiple devices for bulk operations

### 📧 Email Generation
- **CAPWIN Registration**: Generate email templates for PID registration requests
- **Officer Notifications**: Send assignment notifications to officers
- **Bulk Operations**: Generate emails for multiple devices at once
- **Email Modal**: Preview, copy, and open email client with pre-filled content

### 📄 PDF Generation
- **Professional Memo Format**: Generate PDFs with department banner and memo structure
- **CAPWIN Registration PDFs**: Individual and bulk PDF generation for PID registration
- **PID Deactivation PDFs**: Generate deactivation requests for individual or multiple devices
- **Email to PDF**: Convert any generated email to a professional PDF document
- **Custom Formatting**: Includes memo headers (To, From, Date, Re) with proper formatting

### 🎨 UI/UX
- **Modern Design**: Built with Shadcn UI components and Tailwind CSS
- **Responsive Layout**: Works on desktop and mobile devices
- **Collapsible Sidebar**: Icon-only collapsed state with tooltips
- **Loading States**: Spinner indicators on all action buttons
- **Toast Notifications**: User-friendly feedback for all operations
- **Dark Mode Support**: Theme switching capability

## Tech Stack

- **Framework**: Next.js 16 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn UI
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **PDF Generation**: jsPDF
- **Form Management**: React Hook Form + Zod
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (package manager)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/orhanbiler/management.git
cd management
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up Firebase:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Copy your Firebase configuration to `src/lib/firebase.ts`

4. Add your banner image:
   - Place `banner.png` in the `public/` folder

5. Run the development server:
```bash
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
management/
├── public/
│   └── banner.png          # Department banner for PDFs
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout with sidebar
│   │   ├── page.tsx        # Main dashboard page
│   │   ├── not-found.tsx   # 404 error page
│   │   └── globals.css     # Global styles
│   ├── components/
│   │   ├── app-sidebar.tsx         # Main navigation sidebar
│   │   ├── device-modal.tsx        # Add/Edit device form
│   │   ├── email-modal.tsx          # Email preview and PDF download
│   │   ├── inventory-dashboard.tsx # Main inventory table
│   │   ├── login-form.tsx           # Authentication form
│   │   └── ui/                      # Shadcn UI components
│   ├── lib/
│   │   ├── firebase.ts      # Firebase configuration
│   │   ├── pdf-generator.ts # PDF generation utilities
│   │   └── utils.ts         # Helper functions
│   └── types/
│       └── index.ts         # TypeScript type definitions
└── README.md
```

## Usage

### Adding a Device

1. Click the "Add New Device" button
2. Fill in the required fields:
   - Serial Number (auto-uppercased)
   - PID Number (auto-uppercased)
   - Asset ID
   - Device Type
   - ORI Number (if Desktop or Other)
   - Status
   - Officer (if Assigned)
3. Click "Save Record"

### Generating CAPWIN Registration

**Individual:**
- Click the purple file icon next to any device
- Review the generated email in the modal
- Download PDF or open email client

**Bulk:**
- Select multiple devices using checkboxes
- Click "Bulk CAPWIN" in the action bar
- Generate PDF or email for all selected devices

### Generating Deactivation PDFs

**Individual:**
- Click the red X icon next to any device
- PDF downloads automatically

**Bulk:**
- Select multiple devices
- Click "Bulk Deactivate PDF" in the action bar
- PDF downloads with all selected devices

### Notifying Officers

**Individual:**
- Click the green send icon next to an assigned device
- Email modal opens with notification template

**Bulk:**
- Select multiple assigned devices
- Click "Bulk Notify" in the action bar

## PDF Format

All PDFs follow a professional memo format:
- Department banner at the top
- Memo header (To, From, Date, Re)
- Formatted body content
- Signature block at bottom right

## Environment Variables

Create a `.env.local` file with your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Contact

For questions or support, please contact the development team.
