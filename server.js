const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("THANG36 SHOP BACKEND OK");
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "THANG36 backend đang hoạt động!"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
