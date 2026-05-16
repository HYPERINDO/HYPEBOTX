function createOpsRepository(database) {
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

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  function listRepo(fileKey, prefix) {
    return {
      async getAll() {
        return database.read(fileKey, []);
      },
      async findById(id) {
        const rows = await database.read(fileKey, []);
        return rows.find((row) => row.id === id) || null;
      },
      async create(payload) {
        const rows = await database.read(fileKey, []);
        const row = {
          id: payload.id || uid(prefix),
          ...payload,
          createdAt: payload.createdAt || new Date().toISOString(),
          updatedAt: payload.updatedAt || new Date().toISOString(),
        };
        rows.push(row);
        await database.write(fileKey, rows);
        return row;
      },
      async updateById(id, changes) {
        const rows = await database.read(fileKey, []);
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0) return null;
        rows[index] = {
          ...rows[index],
          ...changes,
          updatedAt: new Date().toISOString(),
        };
        await database.write(fileKey, rows);
        return rows[index];
      },
      async deleteById(id) {
        const rows = await database.read(fileKey, []);
        const nextRows = rows.filter((row) => row.id !== id);
        await database.write(fileKey, nextRows);
        return nextRows.length !== rows.length;
      },
      async replaceAll(nextRows) {
        await database.write(fileKey, Array.isArray(nextRows) ? nextRows : []);
      },
    };
  }

  const couponsRepo = listRepo("coupons", "CPN");

  couponsRepo.findByCode = async function (guildId, code) {
    const safeCode = normalizeCouponCode(code);
    const rows = typeof database.readScoped === "function"
      ? await database.readScoped("coupons", guildId, [])
      : await database.read("coupons", []);
    return rows.find((r) => normalizeCouponCode(r.code) === safeCode) || null;
  };

  couponsRepo.redeemCoupon = async function ({ guildId, code, userId, redemption }) {
    let updated = null;
    const mutator = (currentRows) => {
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
    };

    if (typeof database.updateScoped === "function") {
      await database.updateScoped("coupons", guildId, [], mutator);
    } else if (typeof database.update === "function") {
      await database.update("coupons", [], async (currentRows) => {
        const rows = Array.isArray(currentRows)
          ? currentRows
          : currentRows && typeof currentRows === "object"
            ? Object.values(currentRows).flat()
            : [];
        return mutator(rows);
      });
    } else {
      const rows = await database.read("coupons", []);
      await database.write("coupons", mutator(rows));
    }

    return updated;
  };

  return {
    coupons: couponsRepo,
    testimonials: listRepo("testimonials", "TSM"),
    jokiShifts: listRepo("jokiShifts", "SFT"),
    jokiCommissions: listRepo("jokiCommissions", "CMS"),
    mutations: listRepo("mutations", "MUT"),
    termsAcceptances: listRepo("termsAcceptances", "TRM"),
    sensitiveWarnings: listRepo("sensitiveWarnings", "SDW"),
    aiLogs: listRepo("aiLogs", "AIL"),
  };
}

module.exports = {
  createOpsRepository,
};
