import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import morgan from "morgan";
import { corsOptions } from "./config/cors.js";
import { ensureDataDirs } from "./config/database.js";
import { env } from "./config/env.js";
import { sessionOptions } from "./config/session.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { requireAuth } from "./middlewares/requireAuth.js";
import { dashboardDataService } from "./services/dashboardDataService.js";
import { authRoutes } from "./routes/authRoutes.js";
import { auditRoutes } from "./routes/auditRoutes.js";
import { customerRoutes } from "./routes/customerRoutes.js";
import { jokiRoutes } from "./routes/jokiRoutes.js";
import { logRoutes } from "./routes/logRoutes.js";
import { orderRoutes } from "./routes/orderRoutes.js";
import { ownerRoutes } from "./routes/ownerRoutes.js";
import { paymentRoutes } from "./routes/paymentRoutes.js";
import { pricelistRoutes } from "./routes/pricelistRoutes.js";
import { productRoutes } from "./routes/productRoutes.js";
import { staffRoutes } from "./routes/staffRoutes.js";
import { stockRoutes } from "./routes/stockRoutes.js";
import { ticketRoutes } from "./routes/ticketRoutes.js";

export function createApp() {
  ensureDataDirs();

  const app = express();
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(cors(corsOptions));
  app.use(session(sessionOptions));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      service: "HYPEBOTX Dashboard Backend",
      status: "online",
    });
  });

  app.use("/api/auth", authRoutes());
  app.get("/api/dashboard/overview", requireAuth, async (req, res, next) => {
    try {
      res.json({
        success: true,
        ...(await dashboardDataService.overview(req.session.user.role, req.session.user.discordId)),
      });
    } catch (error) {
      next(error);
    }
  });
  app.use("/api/owner", ownerRoutes());
  app.use("/api/orders", orderRoutes());
  app.use("/api/payments", paymentRoutes());
  app.use("/api/tickets", ticketRoutes());
  app.use("/api/joki", jokiRoutes());
  app.use("/api/products", productRoutes());
  app.use("/api/pricelist", pricelistRoutes());
  app.use("/api/stock", stockRoutes());
  app.use("/api/staff", staffRoutes());
  app.use("/api/customers", customerRoutes());
  app.use("/api/logs", logRoutes());
  app.use("/api/audit-logs", auditRoutes());

  app.use(errorHandler);

  return app;
}
