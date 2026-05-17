import { STOCK_STATUS } from "@hypebotx/shared";
import { auditService } from "../services/auditService.js";
import { stockRepository } from "../repositories/stockRepository.js";
import { fail, ok } from "../utils/response.js";

function maskStock(row) {
  if (!row) return row;
  const { content, valueEncrypted, ...safeRow } = row;
  return { ...safeRow, hasSecretContent: Boolean(content || valueEncrypted) };
}

export const stockController = {
  async products(_req, res) {
    return ok(res, { products: await stockRepository.products.list() });
  },
  async productDetail(req, res) {
    const product = await stockRepository.products.findById(req.params.id);
    return product ? ok(res, { product }) : fail(res, 404, "Product tidak ditemukan.");
  },
  async createProduct(req, res) {
    const product = await stockRepository.products.create(req.body || {});
    await auditService.log("PRODUCT_CREATED", { req, targetType: "product", targetId: product.id, newValue: product });
    return ok(res, { product }, 201);
  },
  async updateProduct(req, res) {
    const product = await stockRepository.products.updateById(req.params.id, req.body || {});
    await auditService.log("PRODUCT_UPDATED", { req, targetType: "product", targetId: req.params.id, newValue: product });
    return product ? ok(res, { product }) : fail(res, 404, "Product tidak ditemukan.");
  },
  async deleteProduct(req, res) {
    const product = await stockRepository.products.deleteById(req.params.id);
    await auditService.log("PRODUCT_DELETED", { req, targetType: "product", targetId: req.params.id });
    return product ? ok(res, { deleted: true }) : fail(res, 404, "Product tidak ditemukan.");
  },
  async stock(_req, res) {
    const stock = (await stockRepository.stock.list()).map(maskStock);
    return ok(res, { stock });
  },
  async createStock(req, res) {
    const stock = await stockRepository.stock.create(req.body || {});
    await auditService.log("STOCK_CREATED", { req, targetType: "stock", targetId: stock.id, newValue: maskStock(stock) });
    return ok(res, { stock: maskStock(stock) }, 201);
  },
  async updateStock(req, res) {
    const changes = { ...req.body };
    delete changes.content;
    delete changes.valueEncrypted;
    const stock = await stockRepository.stock.updateById(req.params.id, changes);
    await auditService.log("STOCK_UPDATED", { req, targetType: "stock", targetId: req.params.id, newValue: maskStock(stock) });
    return stock ? ok(res, { stock: maskStock(stock) }) : fail(res, 404, "Stock tidak ditemukan.");
  },
  async deleteStock(req, res) {
    const stock = await stockRepository.stock.deleteById(req.params.id);
    await auditService.log("STOCK_DELETED", { req, targetType: "stock", targetId: req.params.id });
    return stock ? ok(res, { deleted: true }) : fail(res, 404, "Stock tidak ditemukan.");
  },
  async reserve(req, res) {
    const stock = await stockRepository.stock.updateById(req.params.id, { status: STOCK_STATUS.RESERVED, reserved_by_order_id: req.body.orderId || null });
    await auditService.log("STOCK_RESERVED", { req, targetType: "stock", targetId: req.params.id, newValue: maskStock(stock) });
    return stock ? ok(res, { stock: maskStock(stock) }) : fail(res, 404, "Stock tidak ditemukan.");
  },
  async markSold(req, res) {
    const stock = await stockRepository.stock.updateById(req.params.id, { status: STOCK_STATUS.SOLD, sold_at: new Date().toISOString() });
    await auditService.log("STOCK_SOLD", { req, targetType: "stock", targetId: req.params.id, newValue: maskStock(stock) });
    return stock ? ok(res, { stock: maskStock(stock) }) : fail(res, 404, "Stock tidak ditemukan.");
  },
};
