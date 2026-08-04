require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use(routes);

const port = process.env.PORT || 4001;
app.listen(port, () => {
  console.log(`stock-service listening on port ${port}`);
});
