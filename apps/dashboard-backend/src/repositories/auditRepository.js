import { botDataFile } from "../config/database.js";
import { createCollectionRepository } from "./jsonFileRepository.js";

const repo = createCollectionRepository(botDataFile("audit-logs.json"), { idPrefix: "AUD" });

export const auditRepository = {
  list: () => repo.list(),
  create: (payload) => repo.create(payload),
};
