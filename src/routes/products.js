const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { optionalAuth } = require("../middleware/auth");
const { DEFAULT_LIMIT, MAX_LIMIT, DEFAULT_OFFSET } = require("../config/pagination");

const { MAX_CATEGORY_LENGTH } = Product;

function parseLimit(limit) {
  const parsed = parseInt(limit, 10);
  if (isNaN(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parseOffset(offset) {
  const parsed = parseInt(offset, 10);
  if (isNaN(parsed) || parsed < 0) return DEFAULT_OFFSET;
  return parsed;
}

/**
 * GET /api/products
 * List active products, paginated (?limit=, ?offset=). Optional ?category= filter.
 * TODO: products:read is defined in ROLE_PERMISSIONS but not enforced here — this
 * route is intentionally public via optionalAuth(); revisit if that should change.
 */
router.get("/", optionalAuth(), async (req, res, next) => {
  try {
    const { category, limit, offset } = req.query;

    if (category !== undefined && typeof category !== "string") {
      return res.status(400).json({ error: "category must be a string" });
    }
    if (typeof category === "string" && category.length > MAX_CATEGORY_LENGTH) {
      return res.status(400).json({
        error: `category must be at most ${MAX_CATEGORY_LENGTH} characters`,
      });
    }

    const parsedLimit = parseLimit(limit);
    const parsedOffset = parseOffset(offset);

    const [products, total] = await Promise.all([
      Product.findAll({ category, limit: parsedLimit, offset: parsedOffset }),
      Product.count({ category }),
    ]);

    res.json({
      products,
      count: products.length,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
