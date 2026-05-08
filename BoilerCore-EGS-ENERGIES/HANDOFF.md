# BoilerCore handoff

This is a vanilla web app for managing boiler models and parts.

## Main files

- `index.html` - app structure
- `styles.css` - visual design and responsive layout
- `app.js` - application logic, local accounts, roles, inventory, scan/search
- `assets/boiler-room-bg.png` - background image
- `manifest.webmanifest` - installable PWA metadata
- `service-worker.js` - offline cache
- `icon.svg` - app icon

## How to open

Open `index.html` directly in a browser, or run a local server from this folder:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

To test from a phone on the same Wi-Fi, use the Mac/PC local IP address:

```text
http://YOUR_LOCAL_IP:8080
```

## Accounts and roles

Accounts are stored locally in browser `localStorage`.

- First account created becomes `admin`
- Later accounts become `operator`
- Admin can add/edit/delete boiler records
- Admin can import JSON
- Admin can view account settings
- Admin can change roles and delete accounts
- Operator has read-only access

Important: this is local-only auth. For shared accounts across devices, add a real backend such as Supabase, Firebase, or a custom API.

## Data storage

Boiler records are stored in browser `localStorage` under:

```text
boiler-parts-library-v1
```

Use the app's JSON export/import buttons to move data between devices.

## Current app features

- French UI
- Login/create account
- Admin/operator role permissions
- Admin account settings
- Boiler model and parts database
- Search by model, manufacturer, barcode, part number
- Supplier specification link per model
- Barcode scanner UI with manual fallback
- JSON/CSV export
- JSON import for admins
- PWA metadata and offline cache
