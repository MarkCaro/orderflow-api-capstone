const db = require("../config/database");
const { DEFAULT_LIMIT, DEFAULT_OFFSET } = require("../config/pagination");

// Matches the products.category column (migrations/002_create_products.sql).
const MAX_CATEGORY_LENGTH = 100;

function buildWhere({ category, activeOnly }) {
  const params = [];
  const conditions = [];

  if (activeOnly) {
    params.push(true);
    conditions.push(`is_active = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  const clause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
  return { clause, params };
}

async function findAll({
  category,
  activeOnly = true,
  limit = DEFAULT_LIMIT,
  offset = DEFAULT_OFFSET,
} = {}) {
  const { clause, params } = buildWhere({ category, activeOnly });
  let sql = "SELECT * FROM products" + clause + " ORDER BY name";

  params.push(limit);
  sql += ` LIMIT $${params.length}`;
  params.push(offset);
  sql += ` OFFSET $${params.length}`;

  const { rows } = await db.query(sql, params);
  return rows;
}

async function count({ category, activeOnly = true } = {}) {
  const { clause, params } = buildWhere({ category, activeOnly });
  const sql = "SELECT COUNT(*) FROM products" + clause;

  const { rows } = await db.query(sql, params);
  return Number(rows[0].count);
}

async function findById(id) {
  const { rows } = await db.query("SELECT * FROM products WHERE id = $1", [id]);
  return rows[0] || null;
}

async function findBySku(sku) {
  const { rows } = await db.query("SELECT * FROM products WHERE sku = $1", [
    sku,
  ]);
  return rows[0] || null;
}

async function updateStock(productId, quantityDelta) {
  const { rows } = await db.query(
    `UPDATE products
     SET stock = stock + $1, updated_at = NOW()
     WHERE id = $2 AND stock + $1 >= 0
     RETURNING *`,
    [quantityDelta, productId]
  );
  return rows[0] || null;
}

module.exports = {
  findAll,
  count,
  findById,
  findBySku,
  updateStock,
  MAX_CATEGORY_LENGTH,
};
