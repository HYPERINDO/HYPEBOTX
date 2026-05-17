function createJokiRepository(source) {
  const database = source && source.database ? source.database : source;
  const logger = source && source.logger ? source.logger : console;
  const fileKey = "jokiQueues";

  function nowIso() {
    return new Date().toISOString();
  }

  function toPositiveSeconds(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
  }

  function normalizeQueueStatus(status) {
    const raw = String(status || "").trim().toLowerCase();
    const aliases = {
      queue: "queued",
      pending: "queued",
      process: "processing",
      proses: "processing",
      done: "completed",
      selesai: "completed",
      hold: "hold",
      waiting: "hold",
      refund: "refund",
      refunded: "refund",
      cancel: "cancelled",
      canceled: "cancelled",
    };

    const normalized = aliases[raw] || raw;
    if (["queued", "processing", "completed", "hold", "refund", "cancelled"].includes(normalized)) {
      return normalized;
    }
    return "queued";
  }

  function normalizeOrder(order, fallbackPosition = 0) {
    const num = (v, fallback = 0) => {
      if (v === null || v === undefined || v === "") return fallback;
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    return {
      id: order.id,
      userId: order.userId || null,
      ticketId: order.ticketId || null,
      orderLabel: typeof order.orderLabel === "string" ? order.orderLabel : null,
      status: normalizeQueueStatus(order.status),
      claimedBy: order.claimedBy || null,
      claimedAt: order.claimedAt || null,
      createdAt: order.createdAt || nowIso(),
      startedAt: order.startedAt || null,
      estimatedSeconds: toPositiveSeconds(order.estimatedSeconds, 0),
      position: Number.isInteger(order.position) ? order.position : fallbackPosition,
      progress: typeof order.progress === "number" ? order.progress : 0,
      etaAt: order.etaAt || null,
      completedAt: order.completedAt || null,
      completedBy: order.completedBy || null,
      holdAt: order.holdAt || null,
      lastHoldReminderAt: order.lastHoldReminderAt || null,
      holdReminderCount: num(order.holdReminderCount, 0),

      // Heist-progress fields (optional, used for heist big orders)
      totalHeist: num(order.totalHeist, null),
      completedHeist: num(order.completedHeist, 0),
      todayCompletedHeist: num(order.todayCompletedHeist, 0),
      remainingHeist: num(order.remainingHeist, null),
      dailyLimitHeist: num(order.dailyLimitHeist, null),
      progressDate: order.progressDate || null,
    };
  }

  function normalizeQueue(rawQueue) {
    const guildId = rawQueue?.guildId;
    if (!guildId || typeof guildId !== "string") return null;
    const orders = Array.isArray(rawQueue.orders) ? rawQueue.orders : [];
    const history = Array.isArray(rawQueue.history) ? rawQueue.history : [];
    return {
      guildId,
      orders: orders.map((order, index) => normalizeOrder(order, index)),
      history: history.map((order, index) => normalizeOrder(order, index)),
    };
  }

  function normalizeStore(raw) {
    // Legacy single object shape
    if (raw && typeof raw === "object" && !Array.isArray(raw) && raw.guildId) {
      const queue = normalizeQueue(raw);
      return queue ? { [queue.guildId]: queue } : {};
    }

    // Preferred new shape: object keyed by guildId
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const store = {};
      for (const [guildId, queue] of Object.entries(raw)) {
        const normalized = normalizeQueue({ ...(queue || {}), guildId });
        if (normalized) {
          store[guildId] = normalized;
        }
      }
      return store;
    }

    // Legacy array shape
    if (Array.isArray(raw)) {
      const store = {};
      for (const queue of raw) {
        const normalized = normalizeQueue(queue);
        if (normalized) {
          store[normalized.guildId] = normalized;
        }
      }
      return store;
    }

    return {};
  }

  async function readStore() {
    const raw = await database.read(fileKey, {});
    return normalizeStore(raw);
  }

  async function writeStore(store) {
    await database.write(fileKey, store);
    return store;
  }

  async function updateStore(mutator) {
    let result = null;
    if (database && typeof database.update === "function") {
      await database.update(fileKey, {}, (rawStore) => {
        const store = normalizeStore(rawStore);
        result = mutator(store);
        return store;
      });
      return result;
    }

    // Backward compatibility for tests/mocks that only implement read+write.
    const rawStore = await database.read(fileKey, {});
    const store = normalizeStore(rawStore);
    result = mutator(store);
    await database.write(fileKey, store);
    return result;
  }

  function uid() {
    return `J-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  function resolveMaxWork() {
    const raw = process.env.JOKI_MAX_WORK;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 25;
    // 0 = unlimited
    return n;
  }

  function recalc(queue) {
    // Normalize + preserve list order positions.
    queue.orders = queue.orders.map((order, index) => normalizeOrder(order, index));
    queue.orders.forEach((order, idx) => {
      order.position = idx;
    });

    // IMPORTANT: NO auto-promotion (queued -> processing) here.
    // Promote only when an order is explicitly completed (see setOrderStatus()).

    // Compute progress/eta for all WORK (= processing) orders.
    const nowMs = Date.now();
    for (const order of queue.orders) {
      if (order.status !== "processing") continue;

      const startMs = new Date(order.startedAt || nowIso()).getTime();
      const totalMs = Math.max(0, toPositiveSeconds(order.estimatedSeconds, 0)) * 1000;
      const elapsedMs = nowMs - startMs;

      if (totalMs > 0) {
        order.progress = Math.max(0, Math.min(99, (elapsedMs / totalMs) * 100));
        order.etaAt = new Date(startMs + totalMs).toISOString();
      } else {
        order.progress = Math.max(order.progress || 0, 1);
        order.etaAt = null;
      }
    }

    // Completion must stay completed.
    for (const order of queue.orders) {
      if (order.status === "completed") {
        order.progress = 100;
        order.etaAt = order.etaAt || order.completedAt || nowIso();
      }
    }

    return queue;
  }

  function findOrderIndex(queue, orderId) {
    return queue.orders.findIndex((order) => order.id === orderId);
  }

  async function getQueue(guildId) {
    const store = await readStore();
    return store[guildId] || null;
  }

  async function listQueues() {
    const store = await readStore();
    return Object.values(store);
  }

  async function ensureQueue(guildId) {
    return updateStore((store) => {
      if (!store[guildId]) {
        store[guildId] = { guildId, orders: [], history: [] };
      }
      return store[guildId];
    });
  }

  async function addToQueue(guildId, {
    userId,
    ticketId = null,
    estimatedSeconds,
    orderLabel = null,
    // Heist-progress numeric fields (optional)
    totalHeist = null,
    completedHeist = 0,
    todayCompletedHeist = 0,
    remainingHeist = null,
    dailyLimitHeist = null,
    progressDate = null,
  }) {
    return updateStore((store) => {
      if (!store[guildId]) {
        store[guildId] = { guildId, orders: [] };
      }

      const queue = store[guildId];
      const order = {
        id: uid(),
        userId,
        ticketId,
        orderLabel,
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        estimatedSeconds: toPositiveSeconds(estimatedSeconds, 0),
        position: queue.orders.length,
        progress: 0,
        etaAt: null,
        completedAt: null,
        holdAt: null,
        lastHoldReminderAt: null,
        holdReminderCount: 0,

        // Heist-progress fields
        totalHeist: totalHeist === null ? null : Number(totalHeist),
        completedHeist: Number.isFinite(Number(completedHeist)) ? Number(completedHeist) : 0,
        todayCompletedHeist: Number.isFinite(Number(todayCompletedHeist)) ? Number(todayCompletedHeist) : 0,
        remainingHeist: remainingHeist === null ? null : Number(remainingHeist),
        dailyLimitHeist: dailyLimitHeist === null ? null : Number(dailyLimitHeist),
        progressDate: progressDate || null,
      };

      queue.orders.push(order);
      return order;
    });
  }

  async function ensureActive() {
    // UAT spec: jangan auto-promote/berdasarkan urutan.
    // Admin/staff yang memilih order mana jadi WORK/HOLD/DONE.
    return null;
  }

  async function recalcProgressAndEta(guildId) {
    return updateStore((store) => {
      if (!store[guildId]) {
        store[guildId] = { guildId, orders: [], history: [] };
      }

      store[guildId] = recalc(store[guildId]);
      return store[guildId];
    });
  }

  async function runAutomationTick(guildId) {
    let tickResult = null;
    await updateStore((store) => {
      if (!store[guildId]) {
        store[guildId] = { guildId, orders: [], history: [] };
      }

      const queue = store[guildId];
      const beforeMap = new Map(queue.orders.map((order) => [order.id, order.status]));
      store[guildId] = recalc(queue);

      const startedOrders = [];
      const completedOrders = [];

      for (const order of store[guildId].orders) {
        const beforeStatus = beforeMap.get(order.id);
        if (!beforeStatus) continue;

        if (beforeStatus !== "processing" && order.status === "processing") {
          startedOrders.push(order);
        }

        if (order.status === "completed") {
          completedOrders.push(order);
        }
      }

      const finalQueue = store[guildId];
      finalQueue.history = Array.isArray(finalQueue.history) ? finalQueue.history : [];
      const completedIds = new Set(completedOrders.map((order) => order.id));
      finalQueue.history = [...finalQueue.history, ...completedOrders];
      finalQueue.orders = finalQueue.orders.filter((order) => !completedIds.has(order.id));
      store[guildId] = finalQueue;

      tickResult = {
        queue: store[guildId],
        startedOrders,
        completedOrders,
      };
      return tickResult;
    });
    return tickResult;
  }

  async function getOrderById(guildId, orderId) {
    const queue = await ensureQueue(guildId);
    const idx = findOrderIndex(queue, orderId);
    if (idx < 0) return null;
    return queue.orders[idx];
  }

  async function setOrderStatus(guildId, orderId, updates = {}) {
    return updateStore((store) => {
      if (!store[guildId]) {
        store[guildId] = { guildId, orders: [] };
      }

      const queue = store[guildId];
      const idx = findOrderIndex(queue, orderId);
      if (idx < 0) {
        return null;
      }

      const order = queue.orders[idx];
      const previousStatus = order.status;

      if (updates.status) {
        const nextStatus = normalizeQueueStatus(updates.status);

        if (nextStatus === "processing") {
          const maxWork = resolveMaxWork();
          const processingCount = queue.orders.filter((entry) => entry.status === "processing").length;

          // When converting from non-processing -> processing, enforce limit.
          if (maxWork !== 0 && processingCount >= maxWork && order.status !== "processing") {
            return null;
          }
        }

        order.status = nextStatus;

        if (previousStatus !== "hold" && nextStatus === "hold") {
          order.holdAt = nowIso();
        }
        if (previousStatus === "hold" && nextStatus !== "hold") {
          order.holdAt = null;
          order.lastHoldReminderAt = null;
          order.holdReminderCount = 0;
        }
        if (nextStatus === "completed" && !order.completedAt) {
          order.completedAt = nowIso();
        }
      }

      if (Object.prototype.hasOwnProperty.call(updates, "startedAt")) order.startedAt = updates.startedAt;
      if (Object.prototype.hasOwnProperty.call(updates, "completedAt")) order.completedAt = updates.completedAt;
      if (Object.prototype.hasOwnProperty.call(updates, "progress")) order.progress = updates.progress;
      if (Object.prototype.hasOwnProperty.call(updates, "etaAt")) order.etaAt = updates.etaAt;
      if (Object.prototype.hasOwnProperty.call(updates, "claimedBy")) order.claimedBy = updates.claimedBy;
      if (Object.prototype.hasOwnProperty.call(updates, "claimedAt")) order.claimedAt = updates.claimedAt;
      if (Object.prototype.hasOwnProperty.call(updates, "completedBy")) order.completedBy = updates.completedBy;
      if (Object.prototype.hasOwnProperty.call(updates, "orderLabel")) order.orderLabel = updates.orderLabel;
      if (Object.prototype.hasOwnProperty.call(updates, "holdAt")) order.holdAt = updates.holdAt;
      if (Object.prototype.hasOwnProperty.call(updates, "lastHoldReminderAt")) order.lastHoldReminderAt = updates.lastHoldReminderAt;
      if (Object.prototype.hasOwnProperty.call(updates, "holdReminderCount")) {
        const reminderCount = Number(updates.holdReminderCount);
        order.holdReminderCount = Number.isFinite(reminderCount) && reminderCount >= 0
          ? Math.floor(reminderCount)
          : 0;
      }

      // Heist-progress mutable fields
      if (Object.prototype.hasOwnProperty.call(updates, "totalHeist")) order.totalHeist = updates.totalHeist;
      if (Object.prototype.hasOwnProperty.call(updates, "completedHeist")) order.completedHeist = updates.completedHeist;
      if (Object.prototype.hasOwnProperty.call(updates, "todayCompletedHeist")) order.todayCompletedHeist = updates.todayCompletedHeist;
      if (Object.prototype.hasOwnProperty.call(updates, "remainingHeist")) order.remainingHeist = updates.remainingHeist;
      if (Object.prototype.hasOwnProperty.call(updates, "dailyLimitHeist")) order.dailyLimitHeist = updates.dailyLimitHeist;
      if (Object.prototype.hasOwnProperty.call(updates, "progressDate")) order.progressDate = updates.progressDate;

      store[guildId] = recalc(queue);

      const shouldAutoPromote = String(process.env.JOKI_AUTO_PROMOTE ?? "false").toLowerCase() === "true";

      // Auto-promotion ONLY when enabled, and only when an order becomes completed.
      // Default: OFF (per your spec).
      if (shouldAutoPromote && updates.status && normalizeQueueStatus(updates.status) === "completed") {
        const maxWork = resolveMaxWork(); // 0 = unlimited
        const processingCount = queue.orders.filter((o) => o.status === "processing").length;

        const canPromote = maxWork === 0 ? true : processingCount < maxWork;
        if (canPromote) {
          let remaining = maxWork === 0 ? Infinity : (maxWork - processingCount);
          for (const qOrder of queue.orders) {
            if (remaining <= 0) break;
            if (qOrder.status !== "queued") continue;

            qOrder.status = "processing";
            qOrder.startedAt = qOrder.startedAt || nowIso();
            qOrder.progress = 0;
            qOrder.etaAt = null;
            remaining -= 1;
          }
          // Re-calc for progress/eta of processing orders.
          store[guildId] = recalc(queue);
        }
      }

      return store[guildId];
    });
  }

  async function listHistory(guildId, { orderId = "", customer = "" } = {}) {
    const queue = await getQueue(guildId);
    const orders = Array.isArray(queue?.history) ? queue.history : Array.isArray(queue?.orders) ? queue.orders : [];
    const historyStatuses = new Set(["completed", "refund", "cancelled"]);
    const needleOrder = String(orderId || "").trim().toLowerCase();
    const needleCustomer = String(customer || "").trim().toLowerCase();

    function parseOrderIdFromLabel(orderLabel) {
      const raw = typeof orderLabel === "string" ? orderLabel : "";
      const match = raw.match(/ORDER ID:\s*([^\n\r]+)/i);
      return match?.[1]?.trim() || null;
    }

    function parseCustomerFromLabel(orderLabel) {
      const raw = typeof orderLabel === "string" ? orderLabel : "";
      const parts = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return parts[1] || null;
    }

    return orders
      .filter((entry) => historyStatuses.has(entry.status))
      .filter((entry) => {
        if (!needleOrder && !needleCustomer) return true;

        const labelOrderId = String(parseOrderIdFromLabel(entry.orderLabel) || "").toLowerCase();
        const ticketOrderId = String(entry.ticketId || "").toLowerCase();
        const queueOrderId = String(entry.id || "").toLowerCase();
        const labelCustomer = String(parseCustomerFromLabel(entry.orderLabel) || "").toLowerCase();

        const orderMatched = needleOrder
          ? (
            labelOrderId === needleOrder ||
            ticketOrderId === needleOrder ||
            queueOrderId === needleOrder
          )
          : false;
        const customerMatched = needleCustomer
          ? labelCustomer.includes(needleCustomer)
          : false;

        return orderMatched || customerMatched;
      })
      .sort((a, b) => {
        const aTs = new Date(a.completedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.completedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      });
  }

  async function claimOrder(guildId, orderId, userId) {
    let result = { ok: false, message: "Order tidak ditemukan." };
    await updateStore((store) => {
      if (!store[guildId]) {
        store[guildId] = { guildId, orders: [] };
      }

      const queue = store[guildId];
      const idx = findOrderIndex(queue, orderId);
      if (idx < 0) {
        result = { ok: false, message: "Order tidak ditemukan." };
        return null;
      }

      const order = queue.orders[idx];
      if (order.status === "completed") {
        result = { ok: false, message: "Order sudah selesai." };
        return null;
      }
      if (order.status === "processing") {
        if (order.claimedBy && order.claimedBy !== userId) {
          result = { ok: false, message: "Order ini sudah di-claim staff lain." };
          return null;
        }
        result = { ok: false, message: "Order ini sedang diproses." };
        return null;
      }
      if (order.status !== "queued") {
        result = { ok: false, message: "Order belum siap untuk di-claim." };
        return null;
      }

      const maxWork = resolveMaxWork();
      const processingCount = queue.orders.filter((entry) => entry.status === "processing").length;

      // 0 = unlimited
      if (maxWork !== 0 && processingCount >= maxWork) {
        result = { ok: false, message: `Maksimal ${maxWork} order boleh WORK bersamaan.` };
        return null;
      }

      order.status = "processing";
      order.startedAt = nowIso();
      order.progress = 0;
      order.etaAt = null;
      order.claimedBy = userId;
      order.claimedAt = nowIso();
      store[guildId] = recalc(queue);
      result = { ok: true };
      return null;
    });

    return result;
  }

  async function completeOrder(guildId, orderId, userId) {
    let result = { ok: false, message: "Order tidak ditemukan." };
    await updateStore((store) => {
      if (!store[guildId]) {
        store[guildId] = { guildId, orders: [] };
      }

      const queue = store[guildId];
      const idx = findOrderIndex(queue, orderId);
      if (idx < 0) {
        result = { ok: false, message: "Order tidak ditemukan." };
        return null;
      }

      const order = queue.orders[idx];
      if (order.status === "completed") {
        result = { ok: false, message: "Order sudah selesai." };
        return null;
      }
      if (order.status !== "processing") {
        result = { ok: false, message: "Order ini belum diproses." };
        return null;
      }

      order.status = "completed";
      order.completedAt = nowIso();
      order.progress = 100;
      order.completedBy = userId;
      store[guildId] = recalc(queue);
      result = { ok: true };
      return null;
    });

    return result;
  }

  async function clearActiveQueue(guildId) {
    await updateStore((store) => {
      if (!store[guildId]) {
        store[guildId] = { guildId, orders: [] };
        return store[guildId];
      }

      // Reset only active joki queue entries. Completed/old entries get wiped too
      // to avoid "DONE" data leaking into the active list.
      store[guildId].orders = [];
      return store[guildId];
    });
    return getQueue(guildId);
  }

  return {
    getQueue,
    listQueues,
    ensureQueue,
    addToQueue,
    ensureActive,
    recalcProgressAndEta,
    runAutomationTick,
    getOrderById,
    setOrderStatus,
    claimOrder,
    completeOrder,
    clearActiveQueue,
    listHistory,
    getHistory: listHistory,
  };
}

module.exports = { createJokiRepository };
