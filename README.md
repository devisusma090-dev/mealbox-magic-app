# Meal box 91 

Build a responsive food-ordering web app for "mealbox91.in" (React + Tailwind + Firebase/Supabase).

1. AUTH & DB: Google Sign-in for users. Secret Admin Auth via footer text ("Mealbox91 © 2026") with passcode "Mealbox91@9310914628".

2. MENU & CART:
- Dynamic menu (Single portion, +/- quantity, custom instruction box per item).
- Cold drink add-ons with fixed prices.
- Catering banner in menu: "Mealbox91 Catering Service" with Call/WhatsApp buttons.

3. DELIVERY & CHECKOUT:
- Modes: Table QR Code (auto-detect table no.), Direct Delivery (Flat ₹30), Eden Court Doorstep Delivery (₹0, requires Tower/Flat/Phone).
- UPI QR Scanner payment modal (admin uploaded image) & Coupon Code system.
- Anti-fraud 4-digit Delivery OTP generated on checkout.

4. REFERRAL SYSTEM: ₹50 OFF coupon for referrers after referred friend's 1st order.

5. ADMIN PANEL & 2-DAY ANALYTICS:
- Full Menu CRUD + Category management.
- Dynamic settings: Delivery fee, Referral amount, Promo codes, Contact numbers, UPI QR image, Zomato external link.
- Restaurant ON/OFF toggle with offline reason text.
- Simple Analytics tab: Today's Total Sales, Completed Orders (via OTP entry), Cancelled Orders. Automatically purge data older than 48 hours.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/154fabf9-fa9b-4ae1-b96a-12a84b6806fc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
