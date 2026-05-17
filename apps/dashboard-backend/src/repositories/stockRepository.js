import { botDataFile } from "../config/database.js";
import { createCollectionRepository } from "./jsonFileRepository.js";

const productRepo = createCollectionRepository(botDataFile("stock-items.json"), { idPrefix: "PRD" });
const stockRepo = createCollectionRepository(botDataFile("stock-units.json"), { idPrefix: "STK" });

export const stockRepository = {
  products: {
    list: () => productRepo.list(),
    findById: (id) => productRepo.findById(id),
    create: (payload) => productRepo.create(payload),
    updateById: (id, changes) => productRepo.updateById(id, changes),
    deleteById: (id) => productRepo.updateById(id, { is_active: false, isActive: false }),
  },
  stock: {
    list: () => stockRepo.list(),
    findById: (id) => stockRepo.findById(id),
    create: (payload) => stockRepo.create(payload),
    updateById: (id, changes) => stockRepo.updateById(id, changes),
    deleteById: (id) => stockRepo.updateById(id, { status: "disabled" }),
  },
};
