function createCouponRepository(database) {
  function normalizeCouponCode(raw) {
    return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function normalizeDiscountType(raw) {
    const type = String(raw || "").trim().toLowerCase();
    if (type === "percent" || type === "percentage" || type === "%") {
      return "percentage";
    }
    return "amount";
  }

  function normalizeCouponPayload(payload) {
    const normalized = { ...payload };
    if (payload.discountType !== undefined) {
      normalized.discountType = normalizeDiscountType(payload.discountType);
    }
    if (payload.expiresAt === undefined && payload.expiredAt !== undefined) {
      normalized.expiresAt = payload.expiredAt;
    }
    if (payload.maxRedemptions === undefined && payload.usageLimit !== undefined) {
      normalized.maxRedemptions = payload.usageLimit;
    }
    if (payload.active === undefined && payload.isActive !== undefined) {
      normalized.active = payload.isActive;
    }
    if (typeof normalized.code === "string") {
      normalized.code = normalizeCouponCode(normalized.code);
    }
    return normalized;
  }

  async function readRows(guildId = null) {
    if (guildId && typeof database.readScoped === "function") {
      return database.readScoped("coupons", guildId, []);
    }
    if (typeof database.readAll === "function") {
      return database.readAll("coupons", []);
    }
    return database.read("coupons", []);
  }

  async function writeRows(rows) {
    await database.write("coupons", rows);
    return rows;
  }

  async function updateCoupons(guildId, mutator) {
    if (guildId && typeof database.updateScoped === "function") {
      return database.updateScoped("coupons", guildId, [], mutator);
    }

    if (typeof database.update === "function") {
      return database.update("coupons", [], async (currentRaw) => {
        const currentRows = Array.isArray(currentRaw)
          ? currentRaw
          : currentRaw && typeof currentRaw === "object"
            ? Object.values(currentRaw).flat()
            : [];
        return mutator(currentRows);
      });
    }

    const currentRows = await database.read("coupons", []);
    const nextRows = await mutator(currentRows);
    await writeRows(nextRows);
    return nextRows;
  }

  function normalizeCouponRow(row) {
    if (!row || typeof row !== "object") return row;
    return {
      ...row,
      code: normalizeCouponCode(row.code),
      discountType: normalizeDiscountType(row.discountType),
      expiresAt: row.expiresAt || row.expiredAt || null,
      maxRedemptions: row.maxRedemptions ?? row.usageLimit ?? null,
      active: row.active !== false && row.isActive !== false,
    };
  }

  return {
    async getAll() {
      return readRows();
    },
    async findByCode(guildId, code) {
      const safeCode = normalizeCouponCode(code);
      const rows = await readRows(guildId);
      return rows.find((r) => normalizeCouponCode(r.code) === safeCode) || null;
    },
    async create(payload) {
      const normalized = normalizeCouponPayload(payload);
      const rows = await readRows(normalized.guildId);
      if (rows.some((r) => normalizeCouponCode(r.code) === normalized.code)) {
        throw new Error("Coupon code already exists");
      }
      const newCoupon = {
        id: `CPN-${Date.now()}`,
        guildId: normalized.guildId,
        code: normalized.code,
        discountType: normalized.discountType,
        discountValue: Number(normalized.discountValue),
        expiresAt: normalized.expiresAt || null,
        maxRedemptions: normalized.maxRedemptions || null,
        usageCount: 0,
        active: normalized.active !== false,
        applicableCategory: normalized.applicableCategory || null,
        applicableSku: normalized.applicableSku || null,
        note: normalized.note || null,
        createdBy: normalized.createdBy || null,
        createdAt: new Date().toISOString(),
      };
      await updateCoupons(normalized.guildId, (currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        rows.push(newCoupon);
        return rows;
      });
      return newCoupon;
    },
    async update(id, payload) {
      let updated = null;
      await updateCoupons((currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        const index = rows.findIndex((r) => r.id === id);
        if (index < 0) return rows;

        const normalizedPayload = normalizeCouponPayload(payload);
        rows[index] = {
          ...rows[index],
          ...normalizedPayload,
          updatedAt: new Date().toISOString(),
        };
        updated = rows[index];
        return rows;
      });
      return updated;
    },
    async incrementUsage(id) {
      let updated = null;
      await updateCoupons((currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        const index = rows.findIndex((r) => r.id === id);
        if (index < 0) return rows;

        const coupon = rows[index];
        const usageCount = (coupon.usageCount || 0) + 1;
        const maxRedemptions = Math.max(1, Number(coupon.maxRedemptions ?? coupon.usageLimit ?? 1));

        rows[index] = {
          ...coupon,
          usageCount,
          active: usageCount < maxRedemptions,
          updatedAt: new Date().toISOString(),
        };
        updated = rows[index];
        return rows;
      });
      return updated;
    },
    async redeemCoupon({ guildId, code, userId, redemption }) {
      let updated = null;
      await updateCoupons((currentRows) => {
        const rows = Array.isArray(currentRows) ? [...currentRows] : [];
        const safeCode = normalizeCouponCode(code);
        const index = rows.findIndex((r) => r.guildId === guildId && normalizeCouponCode(r.code) === safeCode);
        if (index < 0) {
          throw new Error("Coupon tidak ditemukan.");
        }

        const coupon = normalizeCouponRow(rows[index]);
        const redemptions = Array.isArray(coupon.redemptions) ? coupon.redemptions : [];
        const usageCount = Number(coupon.usageCount || redemptions.length || 0);
        const maxRedemptions = Math.max(1, Number(coupon.maxRedemptions || 1));
        const expiryMs = coupon.expiresAt ? new Date(coupon.expiresAt).getTime() : null;

        if (Number.isFinite(expiryMs) && Date.now() > expiryMs) {
          throw new Error("Coupon sudah expired.");
        }

        if (coupon.active === false) {
          if (usageCount >= maxRedemptions) {
            throw new Error("Coupon sudah mencapai limit penggunaan.");
          }
          throw new Error("Coupon sudah tidak aktif.");
        }

        if (redemptions.some((row) => row.userId === userId)) {
          throw new Error("Coupon ini sudah pernah kamu pakai.");
        }

        if (usageCount >= maxRedemptions) {
          throw new Error("Coupon sudah mencapai limit penggunaan.");
        }

        rows[index] = {
          ...rows[index],
          usageCount: usageCount + 1,
          redemptions: [...redemptions, redemption],
          active: usageCount + 1 < maxRedemptions,
          updatedAt: new Date().toISOString(),
        };
        updated = rows[index];
        return rows;
      });
      return updated;
    },
  };
}

module.exports = {
  createCouponRepository,
};
