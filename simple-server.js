import express from "express";
const app = express();
const PORT = 3000;
app.get("*", (req, res) => {
  res.send("Hello from simple server JS");
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Simple server running on http://0.0.0.0:${PORT}`);
});
