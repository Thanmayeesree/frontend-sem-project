# FoodExpress React + Vite

A full-stack food ordering demo built with React, Bootstrap, Express, JWT authentication, and JSON file persistence.

## Requirements

- Node.js LTS
- npm

## Run development servers

```bash
npm install
npm run dev
```

This starts the React app on Vite and the Express API on port `3001`. Open the Vite URL printed in the terminal.

## Run production build

```bash
npm start
```

This builds the React app and serves it together with the API on port `3001`.

## Demo admin

- Email: `admin@foodexpress.com`
- Password: `Admin@123`

Change these credentials and use environment-managed secrets before deploying publicly.

## Backend features

- bcrypt password hashing
- JWT registration, login, and session verification
- Server-side menu API
- Authenticated persistent carts
- Server-calculated coupons and totals
- Delivery validation and order creation
- Customer order history
- Admin order management and statistics
- Protected admin routes
- Persistent JSON data storage in `server/data.json`

## Included frontend features

- Responsive Bootstrap and React UI
- Search and category filtering
- Cart quantities and checkout
- `FOOD10` coupon, 10% off with a ₹100 maximum
- Order history and admin status controls

## Project notes

- This project is a demonstration, not a production payment or authentication platform.
- Set `JWT_SECRET` in the environment before deployment.
- UPI and card selections are demonstration payment labels; no real transaction is processed.
- Food images are loaded from Unsplash and require internet access.
