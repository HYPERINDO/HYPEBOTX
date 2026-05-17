import { env } from "../config/env.js";
import { auditService } from "../services/auditService.js";
import { discordOAuthService } from "../services/discordOAuthService.js";
import { redirectPathForRole, resolveDashboardRole } from "../services/roleService.js";
import { sessionService } from "../services/sessionService.js";
import { userRepository } from "../repositories/userRepository.js";
import { ok } from "../utils/response.js";

function avatarUrl(user) {
  if (!user?.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}

export const authController = {
  discord(req, res) {
    const state = discordOAuthService.createState();
    req.session.oauthState = state;
    return res.redirect(discordOAuthService.getAuthorizeUrl(state));
  },

  async callback(req, res) {
    const { code, state } = req.query;
    if (!code || !state || state !== req.session.oauthState) {
      await auditService.log("LOGIN_FAILED", {
        req,
        targetType: "auth",
        newValue: { reason: "invalid_state" },
      });
      return res.redirect(`${env.frontendUrl}/unauthorized`);
    }

    try {
      const token = await discordOAuthService.exchangeCode(String(code));
      const discordUser = await discordOAuthService.fetchUser(token.access_token);
      const staffUser = await userRepository.findByDiscordId(discordUser.id);
      const role = resolveDashboardRole(discordUser.id, staffUser);

      if (!role) {
        await auditService.log("LOGIN_FAILED", {
          req,
          targetType: "auth",
          targetId: discordUser.id,
          newValue: { reason: "not_registered" },
        });
        return res.redirect(`${env.frontendUrl}/unauthorized`);
      }

      const sessionUser = sessionService.setUser(req, {
        userId: staffUser?.id || discordUser.id,
        discordId: discordUser.id,
        username: discordUser.global_name || discordUser.username,
        avatarUrl: avatarUrl(discordUser),
        role,
      });

      await auditService.log("LOGIN_SUCCESS", {
        req,
        actor: sessionUser,
        targetType: "auth",
        targetId: discordUser.id,
        newValue: { role },
      });

      return res.redirect(`${env.frontendUrl}${redirectPathForRole(role)}`);
    } catch (error) {
      await auditService.log("LOGIN_FAILED", {
        req,
        targetType: "auth",
        newValue: { reason: error.message },
      });
      return res.redirect(`${env.frontendUrl}/unauthorized`);
    }
  },

  me(req, res) {
    return ok(res, { user: sessionService.getUser(req) });
  },

  async logout(req, res) {
    const user = sessionService.getUser(req);
    await auditService.log("LOGOUT", { req, actor: user, targetType: "auth", targetId: user?.discordId || null });
    if (req.session) {
      await sessionService.destroy(req);
    }
    res.clearCookie("hypebotx.sid", { path: "/" });
    return ok(res, { loggedOut: true });
  },
};
