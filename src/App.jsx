import React, { useEffect, useMemo, useState } from "react";

const API = "";

async function api(path, options = {}) {
  const token = localStorage.getItem("token")?.replace(/^"|"$/g, "") || "";
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

const FALLBACK_FOOD_ITEMS = [
  { id: 1, name: "Chicken Biryani", price: 220, category: "Indian", img: "https://images.unsplash.com/photo-1563379091339-03246963d96c?w=700" },
  { id: 2, name: "Veg Biryani", price: 160, category: "Indian", img: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=700" },
  { id: 3, name: "Pizza", price: 250, category: "Italian", img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=700" },
  { id: 4, name: "Burger", price: 140, category: "Fast Food", img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700" },
  { id: 5, name: "Masala Dosa", price: 90, category: "South Indian", img: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=700" }
];

const readStorage = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  const [page, setPage] = useState("home");
  const [foodItems, setFoodItems] = useState(FALLBACK_FOOD_ITEMS);
  const [cart, setCart] = useState(() => readStorage("cart", []));
  const [orders, setOrders] = useState([]);
  const [current, setCurrent] = useState(null);
  const [token, setToken] = useState(() => readStorage("token", ""));
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [checkout, setCheckout] = useState({ customer: "", phone: "", address: "", payment: "Cash on Delivery" });

  useEffect(() => {
    api("/api/menu").then(setFoodItems).catch(() => setFoodItems(FALLBACK_FOOD_ITEMS));
  }, []);

  useEffect(() => {
    if (!token) {
      setCurrent(null);
      return;
    }
    api("/api/auth/me").then(setCurrent).catch(() => {
      setToken("");
      localStorage.removeItem("token");
      setCurrent(null);
    });
  }, [token]);

  useEffect(() => {
    if (token) api("/api/cart").then(setCart).catch(() => {});
    else localStorage.setItem("cart", JSON.stringify(cart));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (page === "orders") api("/api/orders").then(setOrders).catch(() => setOrders([]));
    if (page === "admin" && current?.role === "admin") api("/api/admin/orders").then(setOrders).catch(() => setOrders([]));
  }, [page, token, current?.role]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );
  const finalTotal = Math.max(0, subtotal - discount);
  const filteredFoods = foodItems.filter((food) =>
    food.name.toLowerCase().includes(search.toLowerCase()) &&
    (category === "All" || food.category === category)
  );

  function navigate(nextPage) {
    setFormMessage("");
    setPage(nextPage);
    if (nextPage !== "cart") setCouponMessage("");
  }

  async function register(event) {
    event.preventDefault();
    try {
      const data = await api("/api/auth/register", { method: "POST", body: JSON.stringify(registerForm) });
      localStorage.setItem("token", JSON.stringify(data.token));
      setToken(data.token);
      setCurrent(data.user);
      setRegisterForm({ name: "", email: "", password: "", role: "user" });
      setFormMessage("");
      setPage("dashboard");
    } catch (error) {
      setFormMessage(error.message);
    }
  }

  async function login(event) {
    event.preventDefault();
    try {
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify(loginForm) });
      localStorage.setItem("token", JSON.stringify(data.token));
      setToken(data.token);
      setCurrent(data.user);
      setLoginForm({ email: "", password: "" });
      setPage(data.user.role === "admin" ? "admin" : "dashboard");
      setFormMessage("");
    } catch (error) {
      setFormMessage(error.message);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setCurrent(null);
    setCart(readStorage("cart", []));
    setOrders([]);
    setPage("home");
    setDiscount(0);
    setCoupon("");
  }

  async function addToCart(food) {
    if (token) {
      try {
        const updated = await api(`/api/cart/${food.id}`, { method: "PUT", body: JSON.stringify({ delta: 1 }) });
        setCart(updated);
      } catch (error) {
        setFormMessage(error.message);
      }
    } else {
      setCart((previous) => {
        const existing = previous.find((item) => item.id === food.id);
        return existing
          ? previous.map((item) => item.id === food.id ? { ...item, qty: item.qty + 1 } : item)
          : [...previous, { ...food, qty: 1 }];
      });
    }
    setDiscount(0);
    setCouponMessage("Item added. Apply your coupon again if needed.");
  }

  async function changeQuantity(id, amount) {
    if (token) {
      try {
        const updated = await api(`/api/cart/${id}`, { method: "PUT", body: JSON.stringify({ delta: amount }) });
        setCart(updated);
      } catch (error) {
        setFormMessage(error.message);
      }
    } else {
      setCart((previous) => previous.map((item) => item.id === id ? { ...item, qty: item.qty + amount } : item).filter((item) => item.qty > 0));
    }
    setDiscount(0);
    setCouponMessage("Cart updated. Apply your coupon again if needed.");
  }

  async function applyCoupon() {
    if (!token) {
      if (coupon.trim().toUpperCase() === "FOOD10" && subtotal > 0) {
        const amount = Math.min(subtotal * 0.10, 100);
        setDiscount(amount);
        setCouponMessage(`10% discount applied! You saved ₹${amount.toFixed(2)}.`);
      } else {
        setDiscount(0);
        setCouponMessage(subtotal === 0 ? "Add food to your cart before applying a coupon." : "Invalid coupon code. Try FOOD10.");
      }
      return;
    }
    try {
      const result = await api("/api/coupon", { method: "POST", body: JSON.stringify({ code: coupon }) });
      setDiscount(result.discount);
      setCouponMessage(`10% discount applied! You saved ₹${result.discount.toFixed(2)}.`);
    } catch (error) {
      setDiscount(0);
      setCouponMessage(error.message);
    }
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (!current) {
      setPage("login");
      setFormMessage("Please log in before placing an order.");
      return;
    }
    if (cart.length === 0) {
      setFormMessage("Your cart is empty. Add some food first.");
      setPage("menu");
      return;
    }
    if (!checkout.customer.trim() || !checkout.phone.trim() || !checkout.address.trim()) {
      setFormMessage("Please complete all delivery details.");
      return;
    }
    if (!/^[0-9]{10}$/.test(checkout.phone.trim())) {
      setFormMessage("Enter a valid 10-digit phone number.");
      return;
    }
    try {
      const order = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ ...checkout, customer: checkout.customer.trim(), phone: checkout.phone.trim(), address: checkout.address.trim(), coupon: discount > 0 ? "FOOD10" : "" })
      });
      setOrders((previous) => [order, ...previous]);
      setCart([]);
      setCoupon("");
      setDiscount(0);
      setCouponMessage("");
      setCheckout({ customer: "", phone: "", address: "", payment: "Cash on Delivery" });
      setFormMessage("Your order has been placed successfully!");
      setPage("orders");
    } catch (error) {
      setFormMessage(error.message);
    }
  }

  async function updateStatus(id, status) {
    try {
      const updated = await api(`/api/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setOrders((previous) => previous.map((order) => order.id === id ? updated : order));
    } catch (error) {
      setFormMessage(error.message);
    }
  }

  const myOrders = orders;
  const isAdmin = current?.role === "admin";

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => navigate("home")} aria-label="FoodExpress home">
          <span className="brand-mark">🍴</span><span>FoodExpress</span>
        </button>
        <nav className="main-nav">
          {[
            ["Home", "home"], ["Restaurants", "restaurants"], ["Menu", "menu"],
            ["Cart", "cart"]
          ].map(([label, target]) => (
            <button key={target} className={page === target ? "nav-link active" : "nav-link"} onClick={() => navigate(target)}>
              {label}{target === "cart" && cart.length > 0 ? ` (${cart.reduce((n, item) => n + item.qty, 0)})` : ""}
            </button>
          ))}
          {current && <button className="nav-link" onClick={() => navigate(isAdmin ? "admin" : "orders")}>{isAdmin ? "Admin" : "My Orders"}</button>}
          {!current ? (
            <>
              <button className="nav-link" onClick={() => navigate("register")}>Register</button>
              <button className="nav-cta" onClick={() => navigate("login")}>Login</button>
            </>
          ) : (
            <button className="nav-cta" onClick={logout}>Logout</button>
          )}
        </nav>
      </header>

      <main>
        {page === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">FRESH • FAST • DELICIOUS</span>
                <h1>Your favourite food,<br /><em>delivered with love.</em></h1>
                <p>Discover delicious meals from nearby restaurants and enjoy them at home.</p>
                <button className="primary-btn" onClick={() => navigate("menu")}>Explore food <span>→</span></button>
                <div className="hero-note">Use coupon <strong>FOOD10</strong> for 10% off your cart.</div>
              </div>
              <div className="hero-art">
                <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1000" alt="Fresh meal bowl" />
                <div className="floating-tag">Made fresh, just for you ✨</div>
              </div>
            </section>
            <section className="section-block">
              <div className="section-heading"><div><span className="eyebrow">CUSTOMER FAVOURITES</span><h2>Popular picks</h2></div><button className="text-btn" onClick={() => navigate("menu")}>View full menu →</button></div>
              <FoodGrid foods={foodItems.slice(0, 3)} onAdd={addToCart} />
            </section>
          </>
        )}

        {page === "restaurants" && (
          <section className="section-block page-section">
            <span className="eyebrow">GOOD FOOD, GOOD MOOD</span><h1 className="page-title">Our restaurants</h1>
            <div className="restaurant-grid">
              {[["Spice Hub", "Indian favourites", "🌶️"], ["Pizza Point", "Italian comfort food", "🍕"], ["Burger House", "Freshly grilled classics", "🍔"]].map(([name, desc, emoji]) => (
                <button className="restaurant-card" key={name} onClick={() => navigate("menu")}><span>{emoji}</span><h3>{name}</h3><p>{desc}</p><b>Explore menu →</b></button>
              ))}
            </div>
          </section>
        )}

        {page === "menu" && (
          <section className="section-block page-section">
            <span className="eyebrow">MADE TO MAKE YOU SMILE</span><h1 className="page-title">Explore our menu</h1>
            <div className="menu-tools"><div className="search-row"><i className="bi bi-search"></i><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search for a dish..." aria-label="Search food" /></div><div className="category-row" aria-label="Filter by category">{["All", ...new Set(foodItems.map((food) => food.category))].map((item) => <button key={item} className={category === item ? "category-chip active" : "category-chip"} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
            <FoodGrid foods={filteredFoods} onAdd={addToCart} />
            {filteredFoods.length === 0 && <p className="empty-state">No dishes found. Try another search.</p>}
          </section>
        )}

        {page === "register" && (
          <section className="form-wrap"><form className="form-card" onSubmit={register}>
            <span className="eyebrow">JOIN FOOD EXPRESS</span><h1>Create an account</h1><p className="muted">Register to save your details and manage orders.</p>
            <label>Full name<input value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} placeholder="Your name" /></label>
            <label>Email address<input type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} placeholder="you@example.com" /></label>
            <label>Password<input type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} placeholder="Create a password" /></label>
            <label>Account type<select value="user" disabled><option value="user">Customer</option></select></label>
            <button className="primary-btn full-btn">Register</button>
            <p className="form-foot">Already registered? <button type="button" className="inline-link" onClick={() => navigate("login")}>Login</button></p>
            {formMessage && <p className="notice">{formMessage}</p>}
          </form></section>
        )}

        {page === "login" && (
          <section className="form-wrap"><form className="form-card" onSubmit={login}>
            <span className="eyebrow">WELCOME BACK</span><h1>Login</h1><p className="muted">Sign in to continue to FoodExpress.</p>
            <label>Email address<input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="you@example.com" /></label>
            <label>Password<input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Your password" /></label>
            <button className="primary-btn full-btn">Login</button>
            <p className="form-foot">New to FoodExpress? <button type="button" className="inline-link" onClick={() => navigate("register")}>Create an account</button></p>
            {formMessage && <p className="notice">{formMessage}</p>}
          </form></section>
        )}

        {page === "dashboard" && (
          <section className="section-block page-section"><span className="eyebrow">YOUR FOOD SPACE</span><h1 className="page-title">Welcome, {current?.name}!</h1><p className="muted">Ready to find something delicious?</p>
            <div className="dashboard-actions"><button className="primary-btn" onClick={() => navigate("menu")}>Browse food</button><button className="secondary-btn" onClick={() => navigate("cart")}>View my cart</button><button className="secondary-btn" onClick={() => navigate("orders")}>My orders</button></div>
          </section>
        )}

        {page === "cart" && (
          <section className="section-block page-section narrow-section"><span className="eyebrow">ALMOST THERE</span><h1 className="page-title">Your cart</h1>
            {cart.length === 0 ? <div className="empty-panel"><span>🛍️</span><h2>Your cart is empty</h2><p>Add your favourite dishes and they will appear here.</p><button className="primary-btn" onClick={() => navigate("menu")}>Browse menu</button></div> : <>
              <div className="cart-list">{cart.map((item) => <div className="cart-row" key={item.id}><img src={item.img} alt={item.name} /><div className="cart-info"><h3>{item.name}</h3><p>₹{item.price} each</p></div><div className="quantity"><button onClick={() => changeQuantity(item.id, -1)} aria-label={`Remove one ${item.name}`}>−</button><b>{item.qty}</b><button onClick={() => changeQuantity(item.id, 1)} aria-label={`Add one ${item.name}`}>+</button></div><strong>₹{item.price * item.qty}</strong></div>)}</div>
              <div className="coupon-box"><div><b>Have a coupon?</b><p>Enter FOOD10 to get 10% off (maximum ₹100).</p></div><div className="coupon-controls"><input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code" /><button className="secondary-btn" onClick={applyCoupon}>Apply</button></div>{couponMessage && <p className="coupon-message">{couponMessage}</p>}</div>
              <div className="bill-card"><div><span>Subtotal</span><b>₹{subtotal.toFixed(2)}</b></div><div><span>Discount</span><b className="discount-value">− ₹{discount.toFixed(2)}</b></div><div className="bill-total"><span>Total</span><strong>₹{finalTotal.toFixed(2)}</strong></div><button className="primary-btn full-btn" onClick={() => { if (!current) { setPage("login"); setFormMessage("Please log in before checkout."); } else { setFormMessage(""); setPage("checkout"); } }}>Proceed to checkout</button></div>
            </>}
          </section>
        )}

        {page === "checkout" && (
          <section className="form-wrap"><form className="form-card" onSubmit={placeOrder}>
            <span className="eyebrow">DELIVERY DETAILS</span><h1>Checkout</h1><p className="muted">Where should we deliver your food?</p>
            <label>Customer name<input value={checkout.customer} onChange={(e) => setCheckout({ ...checkout, customer: e.target.value })} placeholder="Full name" /></label>
            <label>Phone number<input inputMode="numeric" value={checkout.phone} onChange={(e) => setCheckout({ ...checkout, phone: e.target.value })} placeholder="10-digit mobile number" /></label>
            <label>Delivery address<textarea rows="3" value={checkout.address} onChange={(e) => setCheckout({ ...checkout, address: e.target.value })} placeholder="House number, street, area..." /></label>
            <label>Payment method<select value={checkout.payment} onChange={(e) => setCheckout({ ...checkout, payment: e.target.value })}><option>Cash on Delivery</option><option>UPI (Demo)</option><option>Card (Demo)</option></select></label>
            <div className="checkout-total"><span>Amount to pay</span><strong>₹{finalTotal.toFixed(2)}</strong></div>
            <button className="primary-btn full-btn">Place order</button>
            {formMessage && <p className="notice">{formMessage}</p>}
          </form></section>
        )}

        {page === "orders" && (
          <section className="section-block page-section"><span className="eyebrow">YOUR FOOD JOURNEY</span><h1 className="page-title">My orders</h1>
            {!current ? <div className="empty-panel"><p>Please log in to view your orders.</p><button className="primary-btn" onClick={() => navigate("login")}>Login</button></div> : myOrders.length === 0 ? <div className="empty-panel"><span>📦</span><h2>No orders yet</h2><p>Your placed orders will show up here.</p><button className="primary-btn" onClick={() => navigate("menu")}>Order food</button></div> :
              <div className="order-grid">{myOrders.slice().reverse().map((order) => <OrderCard key={order.id} order={order} />)}</div>}
            {formMessage && <p className="notice">{formMessage}</p>}
          </section>
        )}

        {page === "admin" && (
          <section className="section-block page-section"><span className="eyebrow">MANAGE FOOD EXPRESS</span><h1 className="page-title">Admin dashboard</h1>
            {!isAdmin ? <div className="empty-panel"><p>Admin login required.</p><button className="primary-btn" onClick={() => navigate("login")}>Login as admin</button></div> : <>
              <div className="stats-grid"><div className="stat-card"><span>Total orders</span><strong>{orders.length}</strong></div><div className="stat-card"><span>Total revenue</span><strong>₹{orders.reduce((sum, order) => sum + order.total, 0).toFixed(2)}</strong></div><div className="stat-card"><span>Food items</span><strong>{foodItems.length}</strong></div></div>
              <h2 className="subheading">Recent orders</h2>
              {orders.length === 0 ? <p className="empty-state">No orders have been placed yet.</p> : <div className="admin-order-list">{orders.slice().reverse().map((order) => <div className="admin-order" key={order.id}><div><b>Order #{String(order.id).slice(-6)}</b><p>{order.name} · ₹{order.total.toFixed(2)}</p><small>{order.address}</small></div><select value={order.status} onChange={(e) => updateStatus(order.id, e.target.value)}><option>Order Placed</option><option>Preparing</option><option>Out for Delivery</option><option>Delivered</option></select></div>)}</div>}
            </>}
          </section>
        )}
      </main>

      <footer className="site-footer"><div><b>FoodExpress</b><p>Delicious food, delivered with care.</p></div><span>© {new Date().getFullYear()} FoodExpress · Student project demo</span></footer>
    </div>
  );
}

function FoodGrid({ foods, onAdd }) {
  return <div className="food-grid">{foods.map((food, index) => <article className="food-card" key={food.id} style={{ "--card-delay": `${index * 70}ms` }}><div className="food-image"><img src={food.img} alt={food.name} loading="lazy" /><span>{food.category}</span><button className="favorite-btn" aria-label={`Save ${food.name}`}><i className="bi bi-heart"></i></button></div><div className="food-card-body"><div className="food-card-meta"><span><i className="bi bi-star-fill"></i> 4.8</span><span><i className="bi bi-clock"></i> 25–30 min</span></div><h3>{food.name}</h3><div className="food-card-bottom"><strong><small>₹</small>{food.price}</strong><button onClick={() => onAdd(food)}><i className="bi bi-plus-lg"></i> Add</button></div></div></article>)}</div>;
}

function OrderCard({ order }) {
  return <article className="order-card"><div className="order-top"><b>Order #{String(order.id).slice(-6)}</b><span className="status-pill">{order.status}</span></div><p className="muted">{order.date}</p><div className="order-items">{order.items.map((item) => <span key={item.id}>{item.name} × {item.qty}</span>)}</div><div className="order-total"><span>Paid by {order.payment}</span><strong>₹{order.total.toFixed(2)}</strong></div></article>;
}