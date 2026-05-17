import { botDataFile } from "../config/database.js";
import { createCollectionRepository } from "./jsonFileRepository.js";

const repo = createCollectionRepository(botDataFile("payments.json"), { idPrefix: "PAY" });

export const paymentRepository = {
  list: () => repo.list(),
  findById: (id) => repo.findById(id),
  updateById: (id, changes) => repo.updateById(id, changes),
  create: (payload) => repo.create(payload),
};
