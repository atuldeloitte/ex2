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
    price: 9.99,
    quantity: 42,
    reorderThreshold: 10,
  });
  acme.set("GADGET-002", {
    sku: "GADGET-002",
    name: "Red Gadget",
    price: 24.99,
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
    price: item.price ?? 0,
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

function getInventorySummary(customerId) {
  const items = listStock(customerId);
  const totalValue = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    totalItems: items.length,
    totalUnits,
    totalValue: Math.round(totalValue * 100) / 100,
    lowStockCount: listLowStock(customerId).length,
  };
}

module.exports = {
  listStock,
  getStockItem,
  createStockItem,
  updateStockItem,
  adjustStock,
  deleteStockItem,
  listLowStock,
  getInventorySummary,
};
