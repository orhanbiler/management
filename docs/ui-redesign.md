# Device Manager interface redesign

The workspace uses a shared shell, an evergreen navigation sidebar, muted neutral surfaces, terracotta primary actions, and Geist typography. The same styling extends through inventory, staff, account settings, authentication, dialogs, and recovery screens. Light, dark, and system themes remain available.

## Workflow changes

- Inventory appears directly beneath four summary metrics. Device mix, operating systems, and data-quality information sit below the records.
- Status tabs, search, PID filters, sorting, and 10/25/50-row pagination make large inventories easier to scan. Selecting all applies to **all filtered results**, including other pages.
- The Retired tab includes retired records immediately. The separate checkbox includes both retired devices and devices scheduled for retirement.
- Device action menus contain edit, CAPWIN registration, officer notification, and deactivation PDF actions. Selecting records exposes all existing bulk actions.
- Staff retains search, rank/status/badge/name/expiry sorting, certification filters, creation, editing, and confirmed deletion.
- Phones and narrow tablets use device/staff cards and a navigation drawer; desktop uses tables and a collapsible sidebar.
- Account settings now have a working navigation link. The nonfunctional Settings and Reports placeholders have been removed.
- Missing operating-system values appear as “Not recorded” rather than contributing to Windows 11 totals. Load failures show an inline error instead of a misleading synced indicator.

Firebase collection names, persistence payloads, authentication/session rules, registration settings, form validation, retirement checklist, PID matching logic, and PDF generation remain in place. The shared shell uses the existing session-aware sign-out function on every protected page.

## Verification

- Production Next.js build and TypeScript checks passed.
- ESLint completed with no errors. Existing unused-variable warnings remain in legacy utilities and modal code.
- Browser checks used the actual components, with Firebase and authentication replaced only in an isolated `/tmp/management-ui-qa` fixture harness. No fixture code or credentials are included in the application.
- Inventory, staff, account, and sign-in layouts were checked at 320, 390, 768, 1024, and 1440 pixels.
- Verified mixed-case search, pagination, retired and PID filters, selection, bulk ORI saves, CAPWIN previews, device creation, staff creation with automatic certification expiry, canceled deletion, admin/user settings visibility, password visibility, mobile form sizing, dark mode, empty/error states, and closing the mobile menu with one Escape.
- Inventory and individual deactivation PDF downloads produced valid PDF files using the unchanged generation code.

This checkout does not contain `.env.local` or Firebase credentials. The production build used temporary placeholder environment values; it did not connect to department data. Real sign-in and Firestore integration need the existing Firebase environment configuration. Run the app with the environment variables documented in the README before testing against a live deployment.
