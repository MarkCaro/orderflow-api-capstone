/**
 * Tests for GET /api/products pagination, category validation, and
 * response shape.
 *
 * Mounts the real router on a minimal local Express app (mirrors
 * src/index.js's middleware order for this route only) with db.query
 * mocked — does not hit a real Postgres instance. Does NOT test:
 * GET /api/products/:id, optionalAuth's personalization behavior.
 */

const express = require("express");
const request = require("supertest");

jest.mock("../../src/config/database", () => ({
  query: jest.fn(),
}));

const db = require("../../src/config/database");
const productRoutes = require("../../src/routes/products");
const errorHandler = require("../../src/middleware/errorHandler");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/products", productRoutes);
  app.use(errorHandler);
  return app;
}

// The route always calls Product.findAll before Product.count (Promise.all
// evaluates its array left-to-right), so db.query's calls are deterministically
// ordered: row query first, count query second — regardless of either query's
// SQL text.
function mockDb({ rows = [], total = rows.length } = {}) {
  db.query.mockImplementationOnce(() => Promise.resolve({ rows }));
  db.query.mockImplementationOnce(() =>
    Promise.resolve({ rows: [{ count: String(total) }] })
  );
}

describe("GET /api/products", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  // ── Error paths ──────────────────────────────────────────────────────

  describe("error paths", () => {
    it("returns 500 when the database query fails", async () => {
      db.query.mockRejectedValue(new Error("connection lost"));

      const res = await request(app).get("/api/products");

      expect(res.status).toBe(500);
    });

    it("returns 400 when category is provided more than once (parsed as an array)", async () => {
      const res = await request(app).get(
        "/api/products?category[]=a&category[]=b"
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when category exceeds 100 characters", async () => {
      const longCategory = "a".repeat(101);

      const res = await request(app).get(
        `/api/products?category=${longCategory}`
      );

      expect(res.status).toBe(400);
    });
  });

  // ── Unhappy paths ────────────────────────────────────────────────────

  describe("unhappy paths", () => {
    it("falls back to the default limit when limit is non-numeric", async () => {
      mockDb({ rows: [] });

      const res = await request(app).get("/api/products?limit=abc");

      expect(res.body.pagination.limit).toBe(50);
    });

    it("falls back to the default limit when limit is negative", async () => {
      mockDb({ rows: [] });

      const res = await request(app).get("/api/products?limit=-5");

      expect(res.body.pagination.limit).toBe(50);
    });

    it("clamps limit to the maximum of 100 when it exceeds the max", async () => {
      mockDb({ rows: [] });

      const res = await request(app).get("/api/products?limit=99999");

      expect(res.body.pagination.limit).toBe(100);
    });

    it("clamps offset to 0 when negative", async () => {
      mockDb({ rows: [] });

      const res = await request(app).get("/api/products?offset=-10");

      expect(res.body.pagination.offset).toBe(0);
    });

    it("falls back to the default offset when offset is non-numeric", async () => {
      mockDb({ rows: [] });

      const res = await request(app).get("/api/products?offset=abc");

      expect(res.body.pagination.offset).toBe(0);
    });
  });

  // ── Happy paths ──────────────────────────────────────────────────────

  describe("happy paths", () => {
    it("returns default pagination metadata when no query params are given", async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      mockDb({ rows, total: 2 });

      const res = await request(app).get("/api/products");

      expect(res.status).toBe(200);
      expect(res.body.products).toEqual(rows);
      expect(res.body.pagination).toEqual({
        limit: 50,
        offset: 0,
        total: 2,
        totalPages: 1,
      });
    });

    it("reflects requested limit/offset and passes them through to the model query", async () => {
      mockDb({ rows: [{ id: 3 }], total: 5 });

      const res = await request(app).get("/api/products?limit=2&offset=7");

      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.offset).toBe(7);
      const rowCall = db.query.mock.calls[0];
      expect(rowCall[1]).toEqual([true, 2, 7]);
    });

    it("computes total/totalPages from the filtered count, not the unfiltered total", async () => {
      mockDb({ rows: [{ id: 1 }], total: 3 });

      const res = await request(app).get(
        "/api/products?category=widgets&limit=10"
      );

      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(1);
      const countCall = db.query.mock.calls[1];
      expect(countCall[0]).toContain("category = $2");
      expect(countCall[1]).toEqual([true, "widgets"]);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns totalPages 0 (not NaN/Infinity) when there are no matching products", async () => {
      mockDb({ rows: [], total: 0 });

      const res = await request(app).get("/api/products");

      expect(res.body.pagination.total).toBe(0);
      expect(res.body.pagination.totalPages).toBe(0);
    });

    it("accepts limit=100 as-is without further clamping", async () => {
      mockDb({ rows: [] });

      const res = await request(app).get("/api/products?limit=100");

      expect(res.body.pagination.limit).toBe(100);
    });

    it("returns an empty page but the real total when offset is beyond the total", async () => {
      mockDb({ rows: [], total: 5 });

      const res = await request(app).get("/api/products?offset=1000");

      expect(res.body.products).toEqual([]);
      expect(res.body.pagination.total).toBe(5);
    });

    it("treats an empty category value as no filter", async () => {
      mockDb({ rows: [{ id: 1 }], total: 1 });

      const res = await request(app).get("/api/products?category=");

      expect(res.status).toBe(200);
      const rowCall = db.query.mock.calls[0];
      expect(rowCall[0]).not.toContain("category =");
    });
  });
});
