```javascript
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   DATABASE FILES
========================= */

const USERS_FILE = path.join(__dirname, "users.json");
const ORDERS_FILE = path.join(__dirname, "orders.json");
const TOPUPS_FILE = path.join(__dirname, "topups.json");

function ensureFile(file) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, "[]", "utf8");
    }
}

ensureFile(USERS_FILE);
ensureFile(ORDERS_FILE);
ensureFile(TOPUPS_FILE);

function readJSON(file) {
    try {
        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch {
        return [];
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

/* =========================
   CONFIG
========================= */

const ADMIN_KEY =
    process.env.ADMIN_KEY || "THANG36_ADMIN_2026";

const DISCOUNT_CODE =
    process.env.DISCOUNT_CODE || "thang36vipvailon";

const DISCORD_WEBHOOK =
    process.env.DISCORD_WEBHOOK || "";

/*
   Giá sản phẩm được kiểm tra
   ở SERVER, không tin giá từ HTML.
*/

const PRODUCTS = {
    "GenPlay 1 Ngày": 13000,
    "GenPlay 1 Tuần": 49000,
    "GenPlay 1 Tháng": 120000
};

/* =========================
   PASSWORD
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
        const parts = stored.split(":");

        if (parts.length !== 2) {
            return false;
        }

        const salt = parts[0];
        const originalHash = parts[1];

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
   TOKEN
========================= */

function createToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

function findUserByToken(token) {
    if (!token) return null;

    const users = readJSON(USERS_FILE);

    return (
        users.find(
            user => user.token === token
        ) || null
    );
}

/* =========================
   AUTH
========================= */

function auth(req, res, next) {
    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Bạn chưa đăng nhập."
        });
    }

    const token =
        header.substring(7).trim();

    const user =
        findUserByToken(token);

    if (!user) {
        return res.status(401).json({
            success: false,
            message:
                "Phiên đăng nhập không hợp lệ."
        });
    }

    req.user = user;
    next();
}

/* =========================
   ADMIN AUTH
========================= */

function adminAuth(req, res, next) {
    const key =
        req.headers["x-admin-key"];

    if (!key || key !== ADMIN_KEY) {
        return res.status(403).json({
            success: false,
            message: "Sai quyền admin."
        });
    }

    next();
}

/* =========================
   DISCORD
========================= */

async function sendDiscord(message) {
    if (!DISCORD_WEBHOOK) {
        return;
    }

    try {
        const response =
            await fetch(
                DISCORD_WEBHOOK,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        content: message
                    })
                }
            );

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
   ORDER ID
========================= */

function makeOrderId() {
    const orders =
        readJSON(ORDERS_FILE);

    return (
        "TH36-" +
        String(orders.length + 1)
            .padStart(4, "0")
    );
}

/* =========================
   HOME
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

/* =========================
   REGISTER
========================= */

app.post("/api/register", (req, res) => {
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
                "Thông tin không hợp lệ."
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
                "Tên tài khoản phải từ 3-20 ký tự."
        });
    }

    if (
        !/^[a-zA-Z0-9_]+$/.test(
            cleanUsername
        )
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Tên tài khoản chỉ được dùng chữ, số và _."
        });
    }

    if (
        password.length < 6 ||
        password.length > 100
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Mật khẩu phải từ 6 ký tự."
        });
    }

    const users =
        readJSON(USERS_FILE);

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
                "Tên tài khoản đã tồn tại."
        });
    }

    const user = {
        id: crypto.randomUUID(),
        username: cleanUsername,
        password: hashPassword(password),
        balance: 0,
        token: null,
        createdAt:
            new Date().toISOString()
    };

    users.push(user);

    writeJSON(
        USERS_FILE,
        users
    );

    res.json({
        success: true,
        message:
            "Đăng ký thành công."
    });
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", (req, res) => {
    const {
        username,
        password
    } = req.body;

    const users =
        readJSON(USERS_FILE);

    const cleanUsername =
        String(username || "")
            .trim()
            .toLowerCase();

    const user =
        users.find(
            item =>
                item.username.toLowerCase() ===
                cleanUsername
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
                "Sai tài khoản hoặc mật khẩu."
        });
    }

    const token =
        createToken();

    user.token = token;

    writeJSON(
        USERS_FILE,
        users
    );

    res.json({
        success: true,
        token,
        user: {
            id: user.id,
            username: user.username,
            balance: user.balance
        }
    });
});

/* =========================
   LOGOUT
========================= */

app.post(
    "/api/logout",
    auth,
    (req, res) => {

        const users =
            readJSON(USERS_FILE);

        const user =
            users.find(
                item =>
                    item.id ===
                    req.user.id
            );

        if (user) {
            user.token = null;
        }

        writeJSON(
            USERS_FILE,
            users
        );

        res.json({
            success: true,
            message:
                "Đã đăng xuất."
        });
    }
);

/* =========================
   ME
========================= */

app.get(
    "/api/me",
    auth,
    (req, res) => {

        res.json({
            success: true,
            user: {
                id: req.user.id,
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

/* =========================
   PRODUCTS
========================= */

app.get(
    "/api/products",
    (req, res) => {

        res.json({
            success: true,
            products:
                Object.entries(
                    PRODUCTS
                ).map(
                    ([name, price]) => ({
                        name,
                        price
                    })
                )
        });
    }
);

/* =========================
   CREATE ORDER
========================= */

app.post(
    "/api/orders",
    auth,
    async (req, res) => {

        const {
            product,
            discountCode
        } = req.body;

        if (
            typeof product !== "string" ||
            !product.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Thiếu sản phẩm."
            });
        }

        const productNames =
            product
                .split(",")
                .map(
                    item => item.trim()
                )
                .filter(Boolean);

        if (
            productNames.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Giỏ hàng trống."
            });
        }

        let subtotal = 0;

        for (
            const name of productNames
        ) {

            if (
                !Object.prototype.hasOwnProperty.call(
                    PRODUCTS,
                    name
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        `Sản phẩm không tồn tại: ${name}`
                });
            }

            subtotal +=
                PRODUCTS[name];
        }

        let discount = 0;

        if (
            typeof discountCode === "string" &&
            discountCode
                .trim()
                .toLowerCase() ===
                DISCOUNT_CODE.toLowerCase()
        ) {
            discount =
                Math.round(
                    subtotal * 0.10
                );
        }

        const total =
            subtotal - discount;

        const users =
            readJSON(USERS_FILE);

        const user =
            users.find(
                item =>
                    item.id ===
                    req.user.id
            );

        if (!user) {
            return res.status(401).json({
                success: false,
                message:
                    "Tài khoản không tồn tại."
            });
        }

        if (user.balance < total) {
            return res.status(400).json({
                success: false,
                message:
                    `Số dư không đủ. Cần ${total.toLocaleString("vi-VN")}đ.`,
                balance:
                    user.balance,
                required:
                    total
            });
        }

        user.balance -= total;

        const orders =
            readJSON(ORDERS_FILE);

        const order = {
            id: makeOrderId(),
            userId: user.id,
            username:
                user.username,
            product:
                productNames.join(", "),
            subtotal,
            discount,
            price: total,
            status: "paid",
            createdAt:
                new Date().toISOString()
        };

        orders.push(order);

        writeJSON(
            USERS_FILE,
            users
        );

        writeJSON(
            ORDERS_FILE,
            orders
        );

        await sendDiscord(
`🛒 **ĐƠN HÀNG MỚI**

👤 Tài khoản: **${user.username}**

📌 Mã đơn: **${order.id}**

📦 Sản phẩm: **${order.product}**

💰 Tổng tiền: **${order.price.toLocaleString("vi-VN")}đ**

💳 Số dư còn lại: **${user.balance.toLocaleString("vi-VN")}đ**

🟢 Trạng thái: **ĐÃ THANH TOÁN**`
        );

        res.json({
            success: true,
            order,
            balance:
                user.balance
        });
    }
);

/* =========================
   MY ORDERS
========================= */

app.get(
    "/api/my-orders",
    auth,
    (req, res) => {

        const orders =
            readJSON(ORDERS_FILE);

        const result =
            orders.filter(
                order =>
                    order.userId ===
                    req.user.id
            ).reverse();

        res.json({
            success: true,
            orders: result
        });
    }
);

/* =========================
   CREATE TOPUP
========================= */

app.post(
    "/api/topups",
    auth,
    async (req, res) => {

        const {
            amount,
            method
        } = req.body;

        const numericAmount =
            Number(amount);

        if (
            !Number.isFinite(
                numericAmount
            ) ||
            numericAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Số tiền không hợp lệ."
            });
        }

        if (
            numericAmount > 5000000
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Số tiền nạp quá lớn."
            });
        }

        const topups =
            readJSON(TOPUPS_FILE);

        const topup = {
            id:
                "TOP-" +
                crypto
                    .randomBytes(5)
                    .toString("hex")
                    .toUpperCase(),

            userId:
                req.user.id,

            username:
                req.user.username,

            amount:
                numericAmount,

            method:
                String(
                    method || "manual"
                ),

            status:
                "pending",

            createdAt:
                new Date().toISOString()
        };

        topups.push(topup);

        writeJSON(
            TOPUPS_FILE,
            topups
        );

        await sendDiscord(
`💰 **YÊU CẦU NẠP TIỀN**

👤 Tài khoản: **${topup.username}**

📌 Mã: **${topup.id}**

💵 Số tiền: **${topup.amount.toLocaleString("vi-VN")}đ**

💳 Phương thức: **${topup.method}**

⏳ Trạng thái: **CHỜ DUYỆT**`
        );

        res.json({
            success: true,
            topup
        });
    }
);

/* =========================
   MY TOPUPS
========================= */

app.get(
    "/api/my-topups",
    auth,
    (req, res) => {

        const topups =
            readJSON(TOPUPS_FILE);

        const result =
            topups
                .filter(
                    item =>
                        item.userId ===
                        req.user.id
                )
                .reverse();

        res.json({
            success: true,
            topups: result
        });
    }
);

/* =========================
   ADMIN USERS
========================= */

app.get(
    "/api/admin/users",
    adminAuth,
    (req, res) => {

        const users =
            readJSON(USERS_FILE);

        res.json({
            success: true,
            users:
                users.map(
                    user => ({
                        id: user.id,
                        username:
                            user.username,
                        balance:
                            user.balance,
                        createdAt:
                            user.createdAt
                    })
                )
        });
    }
);

/* =========================
   ADMIN ORDERS
========================= */

app.get(
    "/api/admin/orders",
    adminAuth,
    (req, res) => {

        res.json({
            success: true,
            orders:
                readJSON(
                    ORDERS_FILE
                ).reverse()
        });
    }
);

/* =========================
   ADMIN TOPUPS
========================= */

app.get(
    "/api/admin/topups",
    adminAuth,
    (req, res) => {

        res.json({
            success: true,
            topups:
                readJSON(
                    TOPUPS_FILE
                ).reverse()
        });
    }
);

/* =========================
   ADMIN ADD BALANCE
========================= */

app.post(
    "/api/admin/users/:id/add-balance",
    adminAuth,
    async (req, res) => {

        const amount =
            Number(req.body.amount);

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Số tiền không hợp lệ."
            });
        }

        const users =
            readJSON(USERS_FILE);

        const user =
            users.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    "Không tìm thấy tài khoản."
            });
        }

        user.balance += amount;

        writeJSON(
            USERS_FILE,
            users
        );

        await sendDiscord(
`💰 **ADMIN CỘNG TIỀN**

👤 Tài khoản: **${user.username}**

➕ Số tiền: **${amount.toLocaleString("vi-VN")}đ**

💳 Số dư mới: **${user.balance.toLocaleString("vi-VN")}đ**`
        );

        res.json({
            success: true,
            username:
                user.username,
            balance:
                user.balance
        });
    }
);

/* =========================
   ADMIN REMOVE BALANCE
========================= */

app.post(
    "/api/admin/users/:id/remove-balance",
    adminAuth,
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
                    "Số tiền không hợp lệ."
            });
        }

        const users =
            readJSON(USERS_FILE);

        const user =
            users.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    "Không tìm thấy tài khoản."
            });
        }

        if (user.balance < amount) {
            return res.status(400).json({
                success: false,
                message:
                    "Số dư không đủ."
            });
        }

        user.balance -= amount;

        writeJSON(
            USERS_FILE,
            users
        );

        res.json({
            success: true,
            username:
                user.username,
            balance:
                user.balance
        });
    }
);

/* =========================
   ADMIN APPROVE TOPUP
========================= */

app.post(
    "/api/admin/topups/:id/approve",
    adminAuth,
    async (req, res) => {

        const topups =
            readJSON(TOPUPS_FILE);

        const topup =
            topups.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!topup) {
            return res.status(404).json({
                success: false,
                message:
                    "Không tìm thấy yêu cầu nạp."
            });
        }

        if (
            topup.status !==
            "pending"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Yêu cầu đã được xử lý."
            });
        }

        const users =
            readJSON(USERS_FILE);

        const user =
            users.find(
                item =>
                    item.id ===
                    topup.userId
            );

        if (!user) {
            return res.status(404).json({
                success: false,
                message:
                    "Không tìm thấy tài khoản."
            });
        }

        user.balance +=
            topup.amount;

        topup.status =
            "approved";

        topup.approvedAt =
            new Date().toISOString();

        writeJSON(
            USERS_FILE,
            users
        );

        writeJSON(
            TOPUPS_FILE,
            topups
        );

        await sendDiscord(
`✅ **NẠP TIỀN ĐÃ DUYỆT**

👤 Tài khoản: **${user.username}**

💰 Cộng: **${topup.amount.toLocaleString("vi-VN")}đ**

💳 Số dư mới: **${user.balance.toLocaleString("vi-VN")}đ**

📌 Mã: **${topup.id}**`
        );

        res.json({
            success: true,
            balance:
                user.balance,
            topup
        });
    }
);

/* =========================
   ADMIN REJECT TOPUP
========================= */

app.post(
    "/api/admin/topups/:id/reject",
    adminAuth,
    (req, res) => {

        const topups =
            readJSON(TOPUPS_FILE);

        const topup =
            topups.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!topup) {
            return res.status(404).json({
                success: false,
                message:
                    "Không tìm thấy yêu cầu."
            });
        }

        if (
            topup.status !==
            "pending"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Yêu cầu đã được xử lý."
            });
        }

        topup.status =
            "rejected";

        topup.rejectedAt =
            new Date().toISOString();

        writeJSON(
            TOPUPS_FILE,
            topups
        );

        res.json({
            success: true,
            topup
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

    console.log(
        `Admin key hiện tại: ${ADMIN_KEY}`
    );
});
```
