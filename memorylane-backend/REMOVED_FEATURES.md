# MemoryLane - Removed Features (Digital Pivot)

As part of the shift to a 100% digital product delivery model, the following physical logistics, vendor, and shipping features have been disabled or removed:

---

## 1. Shipping Address Collection
* **Backend**: Bypassed columns in `/orders` POST route (kept columns in database schema for backward compatibility/future toggle).
* **Frontend**: Removed shipping address collection forms (Name, Address, City, Pincode, Phone) in checkout. Replaced with simple email verification.

---

## 2. Order Tracking Timeline
* **Frontend**: Removed the tracking timeline component that shows shipping states like waybill generation, printing, qc, packed, shipped, and delivered.
* **Backend**: Updated status constraint. Valid statuses are now restricted to: `draft`, `paid`, `processing`, `ready`, `failed`, `refunded`.

---

## 3. Shipping Integrations & Waybills
* **Shiprocket**: No Shiprocket integrations (waybill creation, status hooks, courier assignment) are present.
* **Print Vendors**: Disabled print-ready PDF vendor API hook triggers.

---

## 4. Physical Dimensions and Add-ons
* **Tiers & Cover Types**: Removed lay-flat hardcover, leather lay-flat, library binding, 170 GSM, 220 GSM options.
* **Rush Delivery**: Replaced with "Priority AI Curation Processing" (15 minutes vs 60 minutes) on the Pro tier.
