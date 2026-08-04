// In-memory, multi-tenant stock store: Map<customerId, Map<sku, item>>
const customers = new Map();

function getCustomerStock(customerId) {
  if (!customers.has(customerId)) {
    customers.set(customerId, new Map());
  }
  return customers.get(customerId);
}

function seedDemoCustomer() {
  const acme = getCustomerStock("acme");
  acme.set("WIDGET-001", {
    sku: "WIDGET-001",
    name: "Blue Widget",
    quantity: 42,
    reorderThreshold: 10,
  });
  acme.set("GADGET-002", {
    sku: "GADGET-002",
    name: "Red Gadget",
    quantity: 3,
    reorderThreshold: 5,
  });
}

seedDemoCustomer();

function listStock(customerId) {
  return Array.from(getCustomerStock(customerId).values());
}

function getStockItem(customerId, sku) {
  return getCustomerStock(customerId).get(sku) || null;
}

function createStockItem(customerId, item) {
  const stock = getCustomerStock(customerId);
  if (stock.has(item.sku)) {
    return null;
  }
  const record = {
    sku: item.sku,
    name: item.name,
    quantity: item.quantity ?? 0,
    reorderThreshold: item.reorderThreshold ?? 5,
  };
  stock.set(item.sku, record);
  return record;
}

function updateStockItem(customerId, sku, updates) {
  const stock = getCustomerStock(customerId);
  const existing = stock.get(sku);
  if (!existing) {
    return null;
  }
  const updated = { ...existing, ...updates, sku: existing.sku };
  stock.set(sku, updated);
  return updated;
}

function adjustStock(customerId, sku, delta) {
  const stock = getCustomerStock(customerId);
  const existing = stock.get(sku);
  if (!existing) {
    return null;
  }
  const nextQuantity = existing.quantity + delta;
  if (nextQuantity < 0) {
    return { error: "insufficient_stock", available: existing.quantity };
  }
  existing.quantity = nextQuantity;
  stock.set(sku, existing);
  return existing;
}

function deleteStockItem(customerId, sku) {
  return getCustomerStock(customerId).delete(sku);
}

function listLowStock(customerId) {
  return listStock(customerId).filter((item) => item.quantity <= item.reorderThreshold);
}

module.exports = {
  listStock,
  getStockItem,
  createStockItem,
  updateStockItem,
  adjustStock,
  deleteStockItem,
  listLowStock,
};
