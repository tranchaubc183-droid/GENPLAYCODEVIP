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

/* Trang kiểm tra server */

app.get("/", (req, res) => {
  res.send("THANG36 SHOP BACKEND OK");
});

/* Kiểm tra API */

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "THANG36 backend đang hoạt động!"
  });
});

/* Tạo đơn hàng */

app.post("/api/orders", (req, res) => {

  const {
    product,
    price
  } = req.body;

  if (!product || !price) {
    return res.status(400).json({
      success: false,
      message: "Thiếu sản phẩm hoặc giá"
    });
  }

  const orders = getOrders();

  const order = {
    id: makeOrderId(),
    product: product,
    price: Number(price),
    status: "pending",
    createdAt: new Date().toISOString()
  };

  orders.push(order);

  saveOrders(orders);

  res.json({
    success: true,
    order: order
  });
});

/* Xem danh sách đơn */

app.get("/api/orders", (req, res) => {

  res.json(getOrders());

});

/* Duyệt đơn */

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

  order.status = "approved";

  order.approvedAt =
    new Date().toISOString();

  saveOrders(orders);

  res.json({
    success: true,
    order: order
  });
});

/* Từ chối đơn */

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

  order.status = "rejected";

  order.rejectedAt =
    new Date().toISOString();

  saveOrders(orders);

  res.json({
    success: true,
    order: order
  });
});

app.listen(PORT, () => {
  console.log(
    `THANG36 server running on port ${PORT}`
  );
});
