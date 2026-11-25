import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET || "foodexpress-development-secret";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.DATA_FILE || (process.env.VERCEL ? "/tmp/foodexpress-data.json" : path.join(__dirname, "data.json"));

const menu = [
  { id: 1, name: "Chicken Biryani", price: 220, category: "Indian", img: "https://images.unsplash.com/photo-1547592180-85f173990554?w=700", rating: 4.8, deliveryTime: "25-30 min" },
  { id: 2, name: "Veg Biryani", price: 160, category: "Indian", img: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=700", rating: 4.7, deliveryTime: "20-25 min" },
  { id: 3, name: "Pizza", price: 250, category: "Italian", img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=700", rating: 4.9, deliveryTime: "25-35 min" },
  { id: 4, name: "Burger", price: 140, category: "Fast Food", img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700", rating: 4.6, deliveryTime: "15-20 min" },
  { id: 5, name: "Masala Dosa", price: 90, category: "South Indian", img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=700", rating: 4.8, deliveryTime: "20-25 min" }
];

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

async function readData() {
  try {
    return JSON.parse(await fs.readFile(dataFile, "utf8"));
  } catch {
    const adminPassword = await bcrypt.hash("Admin@123", 10);
    const initial = { users: [{ id: 1, name: "Demo Admin", email: "admin@foodexpress.com", password: adminPassword, role: "admin" }], carts: {}, orders: [], nextUserId: 2, nextOrderId: 1001 };
    await fs.writeFile(dataFile, JSON.stringify(initial, null, 2));
    return initial;
  }
}

async function writeData(data) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Please log in first." });
  try {
    req.user = jwt.verify(header.slice(7), jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: "Your session has expired." });
  }
}

async function adminRequired(req, res, next) {
  const data = await readData();
  const user = data.users.find((item) => item.id === req.user.id);
  if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  req.dbUser = user;
  next();
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: "7d" });
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "FoodExpress API" }));
app.get("/api/menu", (_req, res) => res.json(menu));

app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!name || !email || password.length < 6) return res.status(400).json({ message: "Name is required and password must be at least 6 characters." });

  const data = await readData();
  if (data.users.some((user) => user.email === email)) return res.status(409).json({ message: "An account with this email already exists." });

  const user = { id: data.nextUserId++, name, email, password: await bcrypt.hash(password, 10), role: "user" };
  data.users.push(user);
  data.carts[user.id] = [];
  await writeData(data);
  res.status(201).json({ token: createToken(user), user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const data = await readData();
  const user = data.users.find((item) => item.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: "Invalid email or password." });
  res.json({ token: createToken(user), user: publicUser(user) });
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  const data = await readData();
  const user = data.users.find((item) => item.id === req.user.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json(publicUser(user));
});

app.get("/api/cart", authRequired, async (req, res) => {
  const data = await readData();
  res.json(data.carts[req.user.id] || []);
});

app.put("/api/cart/:itemId", authRequired, async (req, res) => {
  const itemId = Number(req.params.itemId);
  const delta = Number(req.body.delta);
  const food = menu.find((item) => item.id === itemId);
  if (!food || ![-1, 1].includes(delta)) return res.status(400).json({ message: "Invalid cart item or quantity change." });

  const data = await readData();
  const cart = data.carts[req.user.id] || [];
  const existing = cart.find((item) => item.id === itemId);
  let updated;
  if (existing) {
    updated = cart.map((item) => item.id === itemId ? { ...item, qty: item.qty + delta } : item).filter((item) => item.qty > 0);
  } else if (delta === 1) {
    updated = [...cart, { ...food, qty: 1 }];
  } else {
    updated = cart;
  }
  data.carts[req.user.id] = updated;
  await writeData(data);
  res.json(updated);
});

app.delete("/api/cart", authRequired, async (req, res) => {
  const data = await readData();
  data.carts[req.user.id] = [];
  await writeData(data);
  res.json([]);
});

app.post("/api/coupon", authRequired, async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  const data = await readData();
  const cart = data.carts[req.user.id] || [];
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (!subtotal) return res.status(400).json({ message: "Add food to your cart before applying a coupon." });
  if (code !== "FOOD10") return res.status(400).json({ message: "Invalid coupon code. Try FOOD10." });
  const discount = Math.min(subtotal * 0.1, 100);
  res.json({ code, subtotal, discount, total: subtotal - discount });
});

app.post("/api/orders", authRequired, async (req, res) => {
  const customer = String(req.body.customer || "").trim();
  const phone = String(req.body.phone || "").trim();
  const address = String(req.body.address || "").trim();
  const payment = String(req.body.payment || "Cash on Delivery");
  if (!customer || !/^\d{10}$/.test(phone) || address.length < 5) return res.status(400).json({ message: "Enter a valid name, 10-digit phone number, and delivery address." });

  const data = await readData();
  const cart = data.carts[req.user.id] || [];
  if (!cart.length) return res.status(400).json({ message: "Your cart is empty." });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = req.body.coupon === "FOOD10" ? Math.min(subtotal * 0.1, 100) : 0;
  const order = { id: data.nextOrderId++, userId: req.user.id, email: req.user.email, name: customer, phone, address, payment, items: cart, subtotal, discount, total: subtotal - discount, status: "Order Placed", date: new Date().toISOString() };
  data.orders.push(order);
  data.carts[req.user.id] = [];
  await writeData(data);
  res.status(201).json(order);
});

app.get("/api/orders", authRequired, async (req, res) => {
  const data = await readData();
  res.json(data.orders.filter((order) => order.userId === req.user.id).sort((a, b) => b.id - a.id));
});

app.get("/api/admin/orders", authRequired, adminRequired, async (req, res) => {
  const data = await readData();
  res.json(data.orders.sort((a, b) => b.id - a.id));
});

app.patch("/api/admin/orders/:orderId", authRequired, adminRequired, async (req, res) => {
  const status = String(req.body.status || "");
  const allowed = ["Order Placed", "Preparing", "Out for Delivery", "Delivered"];
  if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid order status." });
  const data = await readData();
  const order = data.orders.find((item) => item.id === Number(req.params.orderId));
  if (!order) return res.status(404).json({ message: "Order not found." });
  order.status = status;
  await writeData(data);
  res.json(order);
});

app.get("/api/admin/stats", authRequired, adminRequired, async (req, res) => {
  const data = await readData();
  res.json({ totalOrders: data.orders.length, totalRevenue: data.orders.reduce((sum, order) => sum + order.total, 0), foodItems: menu.length });
});

const distPath = path.join(__dirname, "..", "dist");
if (await fs.stat(distPath).then(() => true).catch(() => false)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === "GET" && req.accepts("html") && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(distPath, "index.html"));
    }
    next();
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(port, () => console.log(`FoodExpress API running at http://localhost:${port}`));
}

export default app;
