const { componentIds } = require("../utils/constants");
const { requireVerifiedMember } = require("../middlewares/permissionGuard");
const { safeReply } = require("../utils/discordResponse.js");

async function handleModal(client, interaction) {
  const { services } = client.container;

  if (interaction.customId === componentIds.orderFormModal) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    return services.orderService.handleOrderFormModal(interaction);
  }

  // SPRINT 1: Payment/Warranty decision modals (reasons)
  if (interaction.customId === componentIds.modalPaymentRejectReason) {
    if (!(await requireVerifiedMember(interaction))) {
      // reject/approve is staff-only but we keep pattern: verify first, then staff check in service
      return null;
    }

    if (!services?.paymentService?.handlePaymentRejectReasonModal) {
      return null;
    }

    return services.paymentService.handlePaymentRejectReasonModal(interaction);
  }

  if (interaction.customId === componentIds.modalWarrantyNeedProofReason) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    if (!services?.ticketService?.setWarrantyNeedProofFromModal) {
      return null;
    }

    return services.ticketService.setWarrantyNeedProofFromModal(interaction);
  }

  if (interaction.customId === componentIds.topupFormModal) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    return services.orderService.handleTopupFormModal(interaction);
  }

  // BLOCK GTA ORDER untuk mencegah double fungsi (GTA harus diarahkan ke Joki atau Jual Akun Game).
  if (interaction.customId === componentIds.gtaAccountModal) {
    return null;
  }

  if (interaction.customId === componentIds.warrantyModal) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    return services.orderService.handleWarrantyModal(interaction);
  }

  if (interaction.customId === componentIds.windowsLicenseModal) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    return services.orderService.handleWindowsLicenseModal(interaction);
  }

  if (interaction.customId === componentIds.officeLicenseModal) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    return services.orderService.handleOfficeLicenseModal(interaction);
  }

  if (interaction.customId === componentIds.optimizerModal) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    return services.orderService.handleOptimizerModal(interaction);
  }

  if (interaction.customId === componentIds.gameAccountModal) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    return services.orderService.handleGameAccountModal(interaction);
  }

  if (interaction.customId === componentIds.discordServerModal) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    return services.orderService.handleDiscordServerModal(interaction);
  }

  if (interaction.customId === componentIds.bundlePackageModal) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }

    return services.orderService.handleBundlePackageModal(interaction);
  }

  if (interaction.customId === componentIds.testimoniModal) {
    if (!(await requireVerifiedMember(interaction))) {
      return null;
    }
    const ratingRaw = interaction.fields.getTextInputValue("rating");
    const message = interaction.fields.getTextInputValue("message");

    const ratingNum = Number(ratingRaw);
    const isInteger = Number.isInteger(ratingNum);
    if (!isInteger || ratingNum < 1 || ratingNum > 5) {
      return safeReply(interaction, { content: "❌ Rating harus angka 1 sampai 5.", flags: 64 });
    }

    const rating = String(ratingNum);

    let orderId = null;
    let ticketId = null;
    if (interaction.channel) {
      const ticket = await client.container.repositories.ticketRepository?.findByChannelId(interaction.channel.id);
      if (ticket) {
        ticketId = ticket.id;
        const order = await client.container.repositories.orderRepository?.findByTicketId(ticket.id);
        if (order) {
          orderId = order.id;
        }
      }
    }

    // Defer reply because submitting a testimonial may hit DB/external services
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 }).catch(() => null);
    }

    const result = await services.backlogService?.submitTestimonial({
      guild: interaction.guild,
      user: interaction.user,
      rating,
      message,
      orderId,
      ticketId,
      category: "general"
    });
    try {
      if (result?.ok) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: "✅ Terima kasih! Testimoni Anda telah berhasil dikirim." }).catch(() => null);
        } else {
          await safeReply(interaction, { content: "✅ Terima kasih! Testimoni Anda telah berhasil dikirim.", flags: 64 }).catch(() => null);
        }
      } else {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: "❌ Gagal mengirim testimoni: " + (result?.message || "Unknown error") }).catch(() => null);
        } else {
          await safeReply(interaction, { content: "❌ Gagal mengirim testimoni: " + (result?.message || "Unknown error"), flags: 64 }).catch(() => null);
        }
      }
    } catch (err) {
      // swallow Unknown interaction / noisy errors
    }
  }

  return null;
}

module.exports = {
  handleModal,
};
