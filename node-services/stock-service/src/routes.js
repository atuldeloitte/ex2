const express = require("express");
const store = require("./store");

const router = express.Router({ mergeParams: true });

router.get("/customers/:customerId/stock", (req, res) => {
  res.json({ items: store.listStock(req.params.customerId) });
});

router.get("/customers/:customerId/stock/low", (req, res) => {
  res.json({ items: store.listLowStock(req.params.customerId) });
});

router.get("/customers/:customerId/stock/summary", (req, res) => {
  res.json(store.getInventorySummary(req.params.customerId));
});

router.get("/customers/:customerId/stock/:sku", (req, res) => {
  const item = store.getStockItem(req.params.customerId, req.params.sku);
  if (!item) {
    return res.status(404).json({ error: "not_found" });
  }
  res.json(item);
});

router.post("/customers/:customerId/stock", (req, res) => {
  const { sku, name, price, quantity, reorderThreshold } = req.body || {};
  if (!sku || !name) {
    return res.status(400).json({ error: "sku_and_name_required" });
  }
  const created = store.createStockItem(req.params.customerId, {
    sku,
    name,
    price,
    quantity,
    reorderThreshold,
  });
  if (!created) {
    return res.status(409).json({ error: "sku_already_exists" });
  }
  res.status(201).json(created);
});

router.patch("/customers/:customerId/stock/:sku", (req, res) => {
  const updated = store.updateStockItem(req.params.customerId, req.params.sku, req.body || {});
  if (!updated) {
    return res.status(404).json({ error: "not_found" });
  }
  res.json(updated);
});

router.post("/customers/:customerId/stock/:sku/adjust", (req, res) => {
  const { delta } = req.body || {};
  if (typeof delta !== "number") {
    return res.status(400).json({ error: "delta_must_be_number" });
  }
  const result = store.adjustStock(req.params.customerId, req.params.sku, delta);
  if (!result) {
    return res.status(404).json({ error: "not_found" });
  }
  if (result.error) {
    return res.status(409).json(result);
  }
  res.json(result);
});

router.delete("/customers/:customerId/stock/:sku", (req, res) => {
  const deleted = store.deleteStockItem(req.params.customerId, req.params.sku);
  if (!deleted) {
    return res.status(404).json({ error: "not_found" });
  }
  res.status(204).end();
});

module.exports = router;
