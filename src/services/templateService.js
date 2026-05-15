const gamestoreTemplate = require("../templates/gamestoreTemplate");
const basicTemplate = require("../templates/basicTemplate");
const communityTemplate = require("../templates/communityTemplate");
const roleTemplate = require("../templates/roleTemplate");

function parseRoleTemplateAllowList() {
  const raw = String(process.env.ROLE_TEMPLATE_ALLOWED_NAMES || "");
  if (!raw.trim()) return null;

  const list = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return list.length ? new Set(list.map((value) => value.toUpperCase())) : null;
}

function createTemplateService() {
  const templates = {
    gamestore: gamestoreTemplate,
    basic: basicTemplate,
    community: communityTemplate,
  };

  return {
    getTemplate(key = "gamestore") {
      return templates[key] || templates.gamestore;
    },
    listTemplates() {
      return Object.values(templates);
    },
    getRoleTemplates() {
      const strict = String(process.env.ROLE_TEMPLATE_STRICT || "false").toLowerCase() === "true";
      if (!strict) {
        return roleTemplate;
      }

      const allowSet = parseRoleTemplateAllowList();
      if (!allowSet) {
        return roleTemplate;
      }

      return roleTemplate.filter((template) =>
        allowSet.has(String(template?.name || "").toUpperCase()),
      );
    },
  };
}

module.exports = {
  createTemplateService,
};
