/**
 * Tests for Product model pagination support (findAll limit/offset, count).
 *
 * Covers SQL/parameter shape via a mocked db.query — does not hit a real
 * Postgres instance. Does NOT test: findById, findBySku, updateStock.
 */

jest.mock("../../src/config/database", () => ({
  query: jest.fn(),
}));

const db = require("../../src/config/database");
const Product = require("../../src/models/Product");

describe("Product model — pagination", () => {
  afterEach(() => jest.clearAllMocks());

  // ── Error paths ────────────────────────────────────────────────────────

  describe("error paths", () => {
    it("findAll propagates a rejection when db.query rejects", async () => {
      db.query.mockRejectedValue(new Error("connection lost"));

      await expect(Product.findAll({})).rejects.toThrow("connection lost");
    });

    it("count propagates a rejection when db.query rejects", async () => {
      db.query.mockRejectedValue(new Error("connection lost"));

      await expect(Product.count({})).rejects.toThrow("connection lost");
    });
  });

  // ── Unhappy paths ──────────────────────────────────────────────────────

  describe("unhappy paths", () => {
    it("findAll applies its own defaults and still emits a parameterized LIMIT/OFFSET when called with none", async () => {
      db.query.mockResolvedValue({ rows: [] });

      await Product.findAll({});

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/LIMIT \$\d+/);
      expect(sql).toMatch(/OFFSET \$\d+/);
      expect(params).toContain(50); // DEFAULT_LIMIT
      expect(params).toContain(0); // DEFAULT_OFFSET
    });

    it("findAll with a category filter and pagination places WHERE before LIMIT/OFFSET with correctly numbered params", async () => {
      db.query.mockResolvedValue({ rows: [] });

      await Product.findAll({ category: "widgets", limit: 10, offset: 5 });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql.indexOf("WHERE")).toBeLessThan(sql.indexOf("LIMIT"));
      expect(params).toEqual(["widgets", 10, 5]);
    });
  });

  // ── Happy paths ────────────────────────────────────────────────────────

  describe("happy paths", () => {
    it("findAll builds SELECT ... LIMIT $n OFFSET $n with limit/offset as parameterized values", async () => {
      const rows = [{ id: 1 }];
      db.query.mockResolvedValue({ rows });

      const result = await Product.findAll({ limit: 20, offset: 40 });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain("LIMIT $");
      expect(sql).toContain("OFFSET $");
      expect(params).toEqual(expect.arrayContaining([20, 40]));
      expect(result).toEqual(rows);
    });

    it("count builds a SELECT COUNT(*) with the same WHERE conditions as findAll and returns a numeric total", async () => {
      db.query.mockResolvedValue({ rows: [{ count: "7" }] });

      const total = await Product.count({ category: "widgets" });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toMatch(/SELECT COUNT\(\*\)/);
      expect(sql).toContain("WHERE");
      expect(sql).toContain("category = $1");
      expect(params).toEqual(["widgets"]);
      expect(total).toBe(7);
      expect(typeof total).toBe("number");
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("findAll returns an empty array when offset is beyond the available rows", async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await Product.findAll({ limit: 10, offset: 1000 });

      expect(result).toEqual([]);
    });

    it("count returns 0 (not null/undefined/NaN) when there are no matching rows", async () => {
      db.query.mockResolvedValue({ rows: [{ count: "0" }] });

      const total = await Product.count({ category: "nonexistent" });

      expect(total).toBe(0);
    });
  });
});
