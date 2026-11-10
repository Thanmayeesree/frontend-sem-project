# FoodExpress React + Vite

This is a React conversion of the uploaded FoodExpress HTML project.

## Requirements
- Node.js (LTS)
- npm
- VS Code (recommended)

## Run the project
Open this folder in VS Code, then run these commands in the terminal:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173).

## Create a production build
```bash
npm run build
```

## Included features
- Home page and restaurant cards
- Food menu with search
- Registration and login demo
- Customer dashboard
- Cart with quantity controls
- FOOD10 coupon: 10% off, capped at ₹100
- Checkout with delivery validation
- Customer order history
- Admin dashboard and order-status updates
- Browser localStorage persistence

## Important project notes
- This is a frontend/student demonstration project. User accounts and orders are stored in the current browser using localStorage.
- Passwords are not securely protected. Do not use real personal credentials.
- The demo allows choosing an Admin role during registration. A real application must use server-side authentication and authorization.
- UPI and card options are labels for demonstration only; no real payment is processed.
- Food images load from Unsplash and need an internet connection.
