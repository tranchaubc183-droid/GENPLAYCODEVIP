const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "orders.json");

function getOrders() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(orders, null, 2)
  );
}

function makeOrderId() {
  const orders = getOrders();

  return "TH36-" +
    String(orders.length + 1).padStart(4, "0");
}

/* =========================
   DISCORD
========================= */

async function sendDiscord(message) {

  const webhook = process.env.DISCORD_WEBHOOK;

  if (!webhook) {
    console.log("Chưa cấu hình DISCORD_WEBHOOK");
    return;
  }

  try {

    const response = await fetch(webhook, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
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
   TRANG KIỂM TRA
========================= */

app.get("/", (req, res) => {

  res.send(
    "THANG36 SHOP BACKEND OK"
  );

});


/* =========================
   TEST API
========================= */

app.get("/api/test", (req, res) => {

  res.json({
    success: true,
    message:
      "THANG36 backend đang hoạt động!"
  });

});


/* =========================
   TẠO ĐƠN
========================= */

app.post("/api/orders", async (req, res) => {

  const {
    product,
    price
  } = req.body;

  if (!product || !price) {

    return res.status(400).json({

      success: false,

      message:
        "Thiếu sản phẩm hoặc giá"

    });

  }

  const orders = getOrders();

  const order = {

    id: makeOrderId(),

    product: product,

    price: Number(price),

    status: "pending",

    createdAt:
      new Date().toISOString()

  };

  orders.push(order);

  saveOrders(orders);


  /* Discord thông báo đơn mới */

  await sendDiscord(

`🛒 **ĐƠN HÀNG MỚI**

📌 Mã đơn: **${order.id}**

📦 Sản phẩm: **${order.product}**

💰 Giá: **${order.price.toLocaleString("vi-VN")}đ**

⏳ Trạng thái: **CHỜ DUYỆT**`

  );


  res.json({

    success: true,

    order: order

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

app.post(
  "/api/orders/:id/approve",
  async (req, res) => {

    const orders = getOrders();

    const order = orders.find(
      item =>
        item.id === req.params.id
    );

    if (!order) {

      return res.status(404).json({

        success: false,

        message:
          "Không tìm thấy đơn"

      });

    }


    order.status = "approved";

    order.approvedAt =
      new Date().toISOString();

    saveOrders(orders);


    /* Discord báo đã duyệt */

    await sendDiscord(

`✅ **ĐƠN ${order.id} ĐÃ DUYỆT**

📦 Sản phẩm: **${order.product}**

💰 Giá: **${order.price.toLocaleString("vi-VN")}đ**

🟢 Trạng thái: **ĐÃ DUYỆT**`

    );


    res.json({

      success: true,

      order: order

    });

  }
);


/* =========================
   TỪ CHỐI ĐƠN
========================= */

app.post(
  "/api/orders/:id/reject",
  async (req, res) => {

    const orders = getOrders();

    const order = orders.find(
      item =>
        item.id === req.params.id
    );

    if (!order) {

      return res.status(404).json({

        success: false,

        message:
          "Không tìm thấy đơn"

      });

    }


    order.status = "rejected";

    order.rejectedAt =
      new Date().toISOString();

    saveOrders(orders);


    await sendDiscord(

`❌ **ĐƠN ${order.id} ĐÃ TỪ CHỐI**

📦 Sản phẩm: **${order.product}**

🔴 Trạng thái: **TỪ CHỐI**`

    );


    res.json({

      success: true,

      order: order

    });

  }
);


/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {

  console.log(
    `THANG36 server running on port ${PORT}`
  );

});
