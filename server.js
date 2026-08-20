const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   FILE DỮ LIỆU
========================= */

const USERS_FILE = path.join(__dirname, "users.json");
const ORDERS_FILE = path.join(__dirname, "orders.json");
const VOUCHERS_FILE = path.join(__dirname, "vouchers.json");

/* =========================
   ĐỌC / GHI FILE
========================= */

function readJSON(file, fallback = []) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(
        file,
        JSON.stringify(fallback, null, 2)
      );
      return fallback;
    }

    return JSON.parse(
      fs.readFileSync(file, "utf8")
    );
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2)
  );
}

function getUsers() {
  return readJSON(USERS_FILE, []);
}

function saveUsers(users) {
  writeJSON(USERS_FILE, users);
}

function getOrders() {
  return readJSON(ORDERS_FILE, []);
}

function saveOrders(orders) {
  writeJSON(ORDERS_FILE, orders);
}

function getVouchers() {
  return readJSON(VOUCHERS_FILE, []);
}

function saveVouchers(vouchers) {
  writeJSON(VOUCHERS_FILE, vouchers);
}

/* =========================
   MÃ HÓA MẬT KHẨU
========================= */

function hashPassword(password) {

  const salt =
    crypto.randomBytes(16).toString("hex");

  const hash =
    crypto.scryptSync(
      password,
      salt,
      64
    ).toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {

  try {

    const [salt, originalHash] =
      stored.split(":");

    const hash =
      crypto.scryptSync(
        password,
        salt,
        64
      ).toString("hex");

    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(originalHash, "hex")
    );

  } catch {

    return false;

  }
}

/* =========================
   SESSION
========================= */

const sessions = new Map();

function createToken() {

  return crypto
    .randomBytes(32)
    .toString("hex");

}

function getToken(req) {

  const auth =
    req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  return auth.slice(7);

}

function getCurrentUser(req) {

  const token = getToken(req);

  if (!token) {
    return null;
  }

  const username =
    sessions.get(token);

  if (!username) {
    return null;
  }

  const users = getUsers();

  return users.find(
    user => user.username === username
  ) || null;

}

/* =========================
   BẮT BUỘC ĐĂNG NHẬP
========================= */

function requireLogin(req, res, next) {

  const user =
    getCurrentUser(req);

  if (!user) {

    return res.status(401).json({

      success: false,

      message:
        "Vui lòng đăng nhập"

    });

  }

  req.user = user;

  next();

}

/* =========================
   ADMIN
========================= */

function requireAdmin(req, res, next) {

  const adminKey =
    process.env.ADMIN_KEY;

  const suppliedKey =
    req.headers["x-admin-key"];

  if (
    !adminKey ||
    suppliedKey !== adminKey
  ) {

    return res.status(403).json({

      success: false,

      message:
        "Không có quyền quản trị"

    });

  }

  next();

}

/* =========================
   SẢN PHẨM
========================= */

/*
   Giá được xác định ở SERVER.

   Không tin price do frontend gửi lên.
*/

const PRODUCTS = {

  "GenPlay 1 Ngày": 13000,

  "GenPlay 1 Tuần": 49000,

  "GenPlay 1 Tháng": 120000

};

function getProductPrice(product) {

  return PRODUCTS[product] || null;

}

/* =========================
   ORDER ID
========================= */

function makeOrderId() {

  const orders = getOrders();

  return (
    "TH36-" +
    String(orders.length + 1)
      .padStart(4, "0")
  );

}

/* =========================
   DISCORD
========================= */

async function sendDiscord(message) {

  const webhook =
    process.env.DISCORD_WEBHOOK;

  if (!webhook) {

    console.log(
      "Chưa cấu hình DISCORD_WEBHOOK"
    );

    return;

  }

  try {

    const response =
      await fetch(webhook, {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          content: message
        })

      });

    if (!response.ok) {

      console.log(
        "Discord lỗi:",
        response.status
      );

    }

  } catch (error) {

    console.log(
      "Discord error:",
      error.message
    );

  }

}

/* =========================
   TRANG CHỦ
========================= */

app.get("/", (req, res) => {

  res.send(
    "THANG36 SHOP BACKEND OK"
  );

});

/* =========================
   TEST
========================= */

app.get("/api/test", (req, res) => {

  res.json({

    success: true,

    message:
      "THANG36 backend đang hoạt động!"

  });

});

/* =====================================================
   ĐĂNG KÝ
===================================================== */

app.post("/api/auth/register", (req, res) => {

  const {
    username,
    password
  } = req.body;

  if (
    typeof username !== "string" ||
    typeof password !== "string"
  ) {

    return res.status(400).json({

      success: false,

      message:
        "Thông tin đăng ký không hợp lệ"

    });

  }

  const cleanUsername =
    username.trim();

  if (
    cleanUsername.length < 3 ||
    cleanUsername.length > 20
  ) {

    return res.status(400).json({

      success: false,

      message:
        "Tên tài khoản phải từ 3-20 ký tự"

    });

  }

  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {

    return res.status(400).json({

      success: false,

      message:
        "Tên tài khoản chỉ được dùng chữ, số và _"

    });

  }

  if (password.length < 6) {

    return res.status(400).json({

      success: false,

      message:
        "Mật khẩu phải có ít nhất 6 ký tự"

    });

  }

  const users = getUsers();

  const exists =
    users.some(
      user =>
        user.username.toLowerCase() ===
        cleanUsername.toLowerCase()
    );

  if (exists) {

    return res.status(409).json({

      success: false,

      message:
        "Tài khoản đã tồn tại"

    });

  }

  const user = {

    username: cleanUsername,

    password:
      hashPassword(password),

    balance: 0,

    createdAt:
      new Date().toISOString()

  };

  users.push(user);

  saveUsers(users);

  res.json({

    success: true,

    message:
      "Đăng ký thành công",

    user: {

      username: user.username,

      balance: user.balance

    }

  });

});

/* =====================================================
   ĐĂNG NHẬP
===================================================== */

app.post("/api/auth/login", (req, res) => {

  const {
    username,
    password
  } = req.body;

  const users = getUsers();

  const user =
    users.find(
      item =>
        item.username.toLowerCase() ===
        String(username || "")
          .trim()
          .toLowerCase()
    );

  if (
    !user ||
    !verifyPassword(
      String(password || ""),
      user.password
    )
  ) {

    return res.status(401).json({

      success: false,

      message:
        "Sai tài khoản hoặc mật khẩu"

    });

  }

  const token =
    createToken();

  sessions.set(
    token,
    user.username
  );

  res.json({

    success: true,

    message:
      "Đăng nhập thành công",

    token,

    user: {

      username:
        user.username,

      balance:
        user.balance

    }

  });

});

/* =====================================================
   ĐĂNG XUẤT
===================================================== */

app.post(
  "/api/auth/logout",
  requireLogin,
  (req, res) => {

    const token =
      getToken(req);

    sessions.delete(token);

    res.json({

      success: true,

      message:
        "Đã đăng xuất"

    });

  }
);

/* =====================================================
   THÔNG TIN TÀI KHOẢN
===================================================== */

app.get(
  "/api/me",
  requireLogin,
  (req, res) => {

    res.json({

      success: true,

      user: {

        username:
          req.user.username,

        balance:
          req.user.balance,

        createdAt:
          req.user.createdAt

      }

    });

  }
);

/* =====================================================
   TẠO VOUCHER NẠP TIỀN - ADMIN
===================================================== */

app.post(
  "/api/admin/vouchers",
  requireAdmin,
  (req, res) => {

    const amount =
      Number(req.body.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Mệnh giá không hợp lệ"

      });

    }

    const code =
      crypto
        .randomBytes(8)
        .toString("hex")
        .toUpperCase();

    const vouchers =
      getVouchers();

    vouchers.push({

      code,

      amount,

      used: false,

      createdAt:
        new Date().toISOString()

    });

    saveVouchers(vouchers);

    res.json({

      success: true,

      voucher: {

        code,

        amount

      }

    });

  }
);

/* =====================================================
   NẠP TIỀN BẰNG VOUCHER
===================================================== */

app.post(
  "/api/wallet/topup",
  requireLogin,
  (req, res) => {

    const code =
      String(
        req.body.code || ""
      )
      .trim()
      .toUpperCase();

    if (!code) {

      return res.status(400).json({

        success: false,

        message:
          "Vui lòng nhập mã nạp"

      });

    }

    const vouchers =
      getVouchers();

    const voucher =
      vouchers.find(
        item =>
          item.code === code
      );

    if (!voucher) {

      return res.status(400).json({

        success: false,

        message:
          "Mã nạp không tồn tại"

      });

    }

    if (voucher.used) {

      return res.status(400).json({

        success: false,

        message:
          "Mã nạp đã được sử dụng"

      });

    }

    const users =
      getUsers();

    const user =
      users.find(
        item =>
          item.username ===
          req.user.username
      );

    if (!user) {

      return res.status(404).json({

        success: false,

        message:
          "Không tìm thấy tài khoản"

      });

    }

    user.balance =
      Number(user.balance || 0) +
      Number(voucher.amount);

    voucher.used = true;

    voucher.usedBy =
      user.username;

    voucher.usedAt =
      new Date().toISOString();

    saveUsers(users);

    saveVouchers(vouchers);

    res.json({

      success: true,

      message:
        "Nạp tiền thành công",

      balance:
        user.balance

    });

  }
);

/* =====================================================
   TẠO ĐƠN HÀNG
===================================================== */

app.post(
  "/api/orders",
  requireLogin,
  async (req, res) => {

    const {
      product
    } = req.body;

    if (
      typeof product !== "string" ||
      !product.trim()
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Thiếu sản phẩm"

      });

    }

    /*
       LẤY GIÁ TỪ SERVER.
       Không dùng price từ frontend.
    */

    const price =
      getProductPrice(
        product.trim()
      );

    if (price === null) {

      return res.status(400).json({

        success: false,

        message:
          "Sản phẩm không tồn tại"

      });

    }

    const users =
      getUsers();

    const user =
      users.find(
        item =>
          item.username ===
          req.user.username
      );

    if (!user) {

      return res.status(404).json({

        success: false,

        message:
          "Không tìm thấy tài khoản"

      });

    }

    const balance =
      Number(user.balance || 0);

    /*
       KIỂM TRA SỐ DƯ Ở SERVER
    */

    if (balance < price) {

      return res.status(400).json({

        success: false,

        message:
          `Số dư không đủ. Bạn có ${balance.toLocaleString("vi-VN")}đ, cần ${price.toLocaleString("vi-VN")}đ.`

      });

    }

    /*
       TRỪ TIỀN NGAY KHI TẠO ĐƠN
    */

    user.balance =
      balance - price;

    const orders =
      getOrders();

    const order = {

      id:
        makeOrderId(),

      username:
        user.username,

      product:
        product.trim(),

      price,

      status:
        "pending",

      createdAt:
        new Date().toISOString()

    };

    orders.push(order);

    saveUsers(users);

    saveOrders(orders);

    await sendDiscord(

`🛒 **ĐƠN HÀNG MỚI**

📌 Mã đơn: **${order.id}**

👤 Tài khoản: **${order.username}**

📦 Sản phẩm: **${order.product}**

💰 Giá: **${order.price.toLocaleString("vi-VN")}đ**

💳 Số dư còn lại: **${user.balance.toLocaleString("vi-VN")}đ**

⏳ Trạng thái: **CHỜ DUYỆT**`

    );

    res.json({

      success: true,

      message:
        "Tạo đơn thành công",

      order,

      balance:
        user.balance

    });

  }
);

/* =====================================================
   XEM ĐƠN CỦA TÀI KHOẢN
===================================================== */

app.get(
  "/api/my-orders",
  requireLogin,
  (req, res) => {

    const orders =
      getOrders();

    const myOrders =
      orders.filter(
        order =>
          order.username ===
          req.user.username
      );

    res.json({

      success: true,

      orders:
        myOrders

    });

  }
);

/* =====================================================
   ADMIN XEM TẤT CẢ ĐƠN
===================================================== */

app.get(
  "/api/orders",
  requireAdmin,
  (req, res) => {

    res.json(
      getOrders()
    );

  }
);

/* =====================================================
   ADMIN DUYỆT ĐƠN
===================================================== */

app.post(
  "/api/orders/:id/approve",
  requireAdmin,
  async (req, res) => {

    const orders =
      getOrders();

    const order =
      orders.find(
        item =>
          item.id ===
          req.params.id
      );

    if (!order) {

      return res.status(404).json({

        success: false,

        message:
          "Không tìm thấy đơn"

      });

    }

    if (
      order.status !==
      "pending"
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Đơn này đã được xử lý"

      });

    }

    order.status =
      "approved";

    order.approvedAt =
      new Date().toISOString();

    saveOrders(orders);

    await sendDiscord(

`✅ **ĐƠN ${order.id} ĐÃ DUYỆT**

👤 Tài khoản: **${order.username}**

📦 Sản phẩm: **${order.product}**

💰 Giá: **${order.price.toLocaleString("vi-VN")}đ**

🟢 Trạng thái: **ĐÃ DUYỆT**`

    );

    res.json({

      success: true,

      order

    });

  }
);

/* =====================================================
   ADMIN TỪ CHỐI ĐƠN + HOÀN TIỀN
===================================================== */

app.post(
  "/api/orders/:id/reject",
  requireAdmin,
  async (req, res) => {

    const orders =
      getOrders();

    const order =
      orders.find(
        item =>
          item.id ===
          req.params.id
      );

    if (!order) {

      return res.status(404).json({

        success: false,

        message:
          "Không tìm thấy đơn"

      });

    }

    if (
      order.status !==
      "pending"
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Đơn này đã được xử lý"

      });

    }

    const users =
      getUsers();

    const user =
      users.find(
        item =>
          item.username ===
          order.username
      );

    /*
       Hoàn tiền nếu đơn bị từ chối.
    */

    if (user) {

      user.balance =
        Number(user.balance || 0) +
        Number(order.price);

      order.refunded =
        true;

      order.refundedAt =
        new Date().toISOString();

      saveUsers(users);

    }

    order.status =
      "rejected";

    order.rejectedAt =
      new Date().toISOString();

    saveOrders(orders);

    await sendDiscord(

`❌ **ĐƠN ${order.id} ĐÃ TỪ CHỐI**

👤 Tài khoản: **${order.username}**

📦 Sản phẩm: **${order.product}**

💰 Hoàn tiền: **${order.price.toLocaleString("vi-VN")}đ**

🔴 Trạng thái: **TỪ CHỐI**`

    );

    res.json({

      success: true,

      message:
        "Đã từ chối đơn và hoàn tiền",

      order

    });

  }
);

/* =====================================================
   ADMIN XEM TÀI KHOẢN
===================================================== */

app.get(
  "/api/admin/users",
  requireAdmin,
  (req, res) => {

    const users =
      getUsers();

    res.json(

      users.map(user => ({

        username:
          user.username,

        balance:
          user.balance,

        createdAt:
          user.createdAt

      }))

    );

  }
);

/* =====================================================
   START
===================================================== */

app.listen(PORT, () => {

  console.log(
    `THANG36 server running on port ${PORT}`
  );

});
