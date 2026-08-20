const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const USERS_FILE = path.join(__dirname, "users.json");
const ORDERS_FILE = path.join(__dirname, "orders.json");

function readJSON(file, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getUsers() {
  return readJSON(USERS_FILE);
}

function saveUsers(users) {
  writeJSON(USERS_FILE, users);
}

function getOrders() {
  return readJSON(ORDERS_FILE);
}

function saveOrders(orders) {
  writeJSON(ORDERS_FILE, orders);
}

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

function makeId(prefix) {
  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    crypto.randomBytes(3).toString("hex")
  ).toUpperCase();
}

/* =========================
   TRANG CHỦ
========================= */

app.get("/", (req, res) => {
  res.send("THANG36 SHOP BACKEND OK");
});

/* =========================
   TEST
========================= */

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "THANG36 backend đang hoạt động!"
  });
});

/* =========================
   ĐĂNG KÝ
========================= */

app.post("/api/register", (req, res) => {

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng nhập tài khoản và mật khẩu"
    });
  }

  if (username.length < 3) {
    return res.status(400).json({
      success: false,
      message: "Tài khoản phải có ít nhất 3 ký tự"
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Mật khẩu phải có ít nhất 6 ký tự"
    });
  }

  const users = getUsers();

  const exists = users.find(
    user =>
      user.username.toLowerCase() ===
      username.toLowerCase()
  );

  if (exists) {
    return res.status(409).json({
      success: false,
      message: "Tài khoản đã tồn tại"
    });
  }

  const user = {
    id: makeId("USER"),
    username,
    password: hashPassword(password),
    balance: 0,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  saveUsers(users);

  res.json({
    success: true,
    message: "Đăng ký thành công",
    user: {
      id: user.id,
      username: user.username,
      balance: user.balance
    }
  });
});

/* =========================
   ĐĂNG NHẬP
========================= */

app.post("/api/login", (req, res) => {

  const { username, password } = req.body;

  const users = getUsers();

  const user = users.find(
    item =>
      item.username.toLowerCase() ===
      String(username || "").toLowerCase()
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Tài khoản hoặc mật khẩu không đúng"
    });
  }

  if (user.password !== hashPassword(password || "")) {
    return res.status(401).json({
      success: false,
      message: "Tài khoản hoặc mật khẩu không đúng"
    });
  }

  res.json({
    success: true,
    message: "Đăng nhập thành công",
    user: {
      id: user.id,
      username: user.username,
      balance: user.balance
    }
  });
});

/* =========================
   XEM SỐ DƯ
========================= */

app.get("/api/users/:id", (req, res) => {

  const users = getUsers();

  const user = users.find(
    item => item.id === req.params.id
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy tài khoản"
    });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      balance: user.balance
    }
  });
});

/* =========================
   TẠO ĐƠN HÀNG
========================= */

app.post("/api/orders", (req, res) => {

  const {
    userId,
    product,
    price
  } = req.body;

  if (!userId || !product || price === undefined) {
    return res.status(400).json({
      success: false,
      message: "Thiếu thông tin đơn hàng"
    });
  }

  const amount = Number(price);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Giá không hợp lệ"
    });
  }

  const users = getUsers();

  const user = users.find(
    item => item.id === userId
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Tài khoản không tồn tại"
    });
  }

  /* QUAN TRỌNG:
     Không đủ tiền thì KHÔNG tạo đơn */

  if (user.balance < amount) {
    return res.status(400).json({
      success: false,
      message:
        `Số dư không đủ. Bạn còn ${user.balance.toLocaleString("vi-VN")}đ`
    });
  }

  /* Trừ tiền */

  user.balance -= amount;

  saveUsers(users);

  const orders = getOrders();

  const order = {
    id: makeId("TH36"),
    userId: user.id,
    username: user.username,
    product,
    price: amount,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  orders.push(order);

  saveOrders(orders);

  res.json({
    success: true,
    message: "Tạo đơn thành công",
    order,
    balance: user.balance
  });
});

/* =========================
   XEM ĐƠN
========================= */

app.get("/api/orders", (req, res) => {
  res.json(getOrders());
});

/* =========================
   DUYỆT ĐƠN
========================= */

app.post("/api/orders/:id/approve", (req, res) => {

  const orders = getOrders();

  const order = orders.find(
    item => item.id === req.params.id
  );

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy đơn"
    });
  }

  if (order.status !== "pending") {
    return res.status(400).json({
      success: false,
      message: "Đơn này đã được xử lý"
    });
  }

  order.status = "approved";
  order.approvedAt = new Date().toISOString();

  saveOrders(orders);

  res.json({
    success: true,
    order
  });
});

/* =========================
   TỪ CHỐI ĐƠN
========================= */

app.post("/api/orders/:id/reject", (req, res) => {

  const orders = getOrders();

  const order = orders.find(
    item => item.id === req.params.id
  );

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy đơn"
    });
  }

  if (order.status !== "pending") {
    return res.status(400).json({
      success: false,
      message: "Đơn này đã được xử lý"
    });
  }

  order.status = "rejected";
  order.rejectedAt = new Date().toISOString();

  saveOrders(orders);

  res.json({
    success: true,
    order
  });
});

/* =========================
   SERVER
========================= */

app.listen(PORT, () => {
  console.log(
    `THANG36 server running on port ${PORT}`
  );
});
