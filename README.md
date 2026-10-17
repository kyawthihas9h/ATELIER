# Atelier Fashion POS

A React point-of-sale and shop-management app backed by Express and MySQL. It includes one sign-in page for both administrators and cashiers.

## Requirements

- Node.js 20 or later
- MySQL 8 running locally

## Run locally

1. Make sure the MySQL Windows service is running.
2. Run the SQL in [`database/schema.sql`](./database/schema.sql) directly in MySQL Workbench, or from **Command Prompt** in the project folder run `mysql -u root -p < database/schema.sql`.
3. Start the API and React development server with `npm run dev`.
4. Open `http://localhost:5173`.

The MySQL database is named `fashion_pos` and runs on the MySQL server at `localhost:3306`; it is not a SQLite file in the project. The SQL file creates the database, all application tables, and default settings. When the API starts, it completes the staff-ID migration and creates any missing initial staff accounts. To find the physical MySQL data directory, run `SELECT @@datadir;` in MySQL Workbench; do not edit the server's database files directly. The app connection settings are in the ignored `.env` file.

The first run creates these separate accounts if they do not already exist:

| Role | Staff ID | Username | Initial password |
| --- | --- | --- | --- |
| Admin | `ADMIN001` | `admin` | `ChangeMe123!` |
| Cashier | `CASHIER001` | `cashier` | `ShopCashier123!` |

Select **Administrator** or **Cashier** on the shared login page and sign in with the staff ID (or username) and password. Change the initial passwords before using the shop. The bootstrap IDs and passwords can be set with `ADMIN_ID`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CASHIER_ID`, `CASHIER_USERNAME`, and `CASHIER_PASSWORD` in `.env`; they are only used when the corresponding account is first created. Set a long, unique `JWT_SECRET` before using the app outside a trusted local environment.

To run the production frontend, run `npm run build`, then `npm start`; the API listens on port `4000`. Serve the generated `dist` folder with a web server configured to proxy `/api` and `/uploads` to the API.

## Roles and features

- **Cashier:** has access only to the Point of sale page: scan or enter a barcode, add shop-stock items to a sale, change quantities, apply the configured tax, choose Cash, KBZ Pay, Wave Pay, or AYA Pay, and complete the sale. Cashiers cannot open the admin dashboard, sale records, inventory, suppliers, VIP list, cashier management, or settings. Mobile-wallet checkout displays the QR code for the selected wallet.
- **Administrator:** view the sales dashboard (weekly sales chart and top-sellers chart); manage sale history, inventory, purchases, suppliers, VIP customers, cashier accounts, tax, and separate KBZ Pay, Wave Pay, and AYA Pay QR codes; export sale records directly from Sale Record or export all records to Excel.
- **Staff IDs:** administrators and cashiers sign in with their own role and staff ID. New cashier IDs are assigned when the administrator creates their account.
- **Inventory:** track shop and factory quantities separately. A purchase increases stock at its selected destination; completing a sale decreases shop stock.
- **Product photos and payment QR:** upload JPG, PNG, WEBP, or GIF images (maximum 5 MB) to the local `uploads` folder, or use a product image URL.
- **Cashier passwords:** passwords are hashed with bcrypt. Cashiers are created by an administrator and can be paused or re-enabled.

## Excel export

The Inventory page exports its selected inventory or purchase list. **Sale Record → Export Excel** exports all sale records. **Settings → Export all records** downloads a workbook with separate sheets for sales, inventory, purchases, suppliers, VIP customers, and cashiers.

## Main data tables

`users`, `products`, `purchases`, `suppliers`, `sales`, `sale_items`, `vip_customers`, and `settings`. MySQL creates them automatically on the first server start.

## Important configuration

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | MySQL connection |
| `DB_NAME` | Database name (defaults to `fashion_pos`) |
| `JWT_SECRET` | Signing key for login sessions |
| `ADMIN_ID`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Initial administrator created only when no administrator exists |
| `CASHIER_ID`, `CASHIER_USERNAME`, `CASHIER_PASSWORD` | Initial cashier created only when no cashier exists |
| `CLIENT_ORIGIN` | Allowed browser origin for the API |
