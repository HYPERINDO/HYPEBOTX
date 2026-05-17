function isTicketTopic(topic = "") {
  return topic.startsWith("ticket:");
}

function parseTicketTopic(topic = "") {
  const result = {};
  const body = topic.replace(/^ticket:/, "");
  const parts = body.split("|");

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key && value) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Sanitize text to prevent injection attacks
 * @param {string} text - Text to sanitize
 * @param {number} maxLength - Maximum length allowed
 * @returns {string} - Sanitized text
 */
function sanitizeText(text, maxLength = 1000) {
  if (typeof text !== "string") {
    return "";
  }

  return text
    .slice(0, maxLength)
    .replace(/[<>]/g, "") // Remove angle brackets that could break Discord formatting
    .trim();
}

/**
 * Validate Discord user ID
 * @param {string} id - User ID to validate
 * @returns {boolean} - True if valid user ID format
 */
function isValidUserId(id) {
  return /^\d{18,19}$/.test(String(id));
}

/**
 * Validate Discord channel ID
 * @param {string} id - Channel ID to validate
 * @returns {boolean} - True if valid channel ID format
 */
function isValidChannelId(id) {
  return /^\d{18,19}$/.test(String(id));
}

/**
 * Validate Discord guild ID
 * @param {string} id - Guild ID to validate
 * @returns {boolean} - True if valid guild ID format
 */
function isValidGuildId(id) {
  return /^\d{18,19}$/.test(String(id));
}

/**
 * Validate role ID
 * @param {string} id - Role ID to validate
 * @returns {boolean} - True if valid role ID format
 */
function isValidRoleId(id) {
  return /^\d{18,19}$/.test(String(id));
}

/**
 * Validate positive number
 * @param {any} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} - True if valid
 */
function isValidNumber(value, min = 0, max = Infinity) {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max && Number.isInteger(num);
}

/**
 * Sanitize topic string for Discord channel topics
 * @param {string} topic - Topic to sanitize
 * @returns {string} - Sanitized topic
 */
function sanitizeTopic(topic) {
  if (typeof topic !== "string") {
    return "";
  }

  // Remove dangerous characters and keep it under Discord's limit (4096)
  return topic
    .slice(0, 4096)
    .replace(/[`]/g, "'") // Replace backticks with single quotes
    .replace(/[\n\r]/g, " ") // Remove line breaks
    .trim();
}

/**
 * Validate command input
 * @param {string} input - Input to validate
 * @param {object} options - Validation options
 * @returns {object} - Validation result
 */
function validateInput(input, options = {}) {
  const { maxLength = 1000, required = true, pattern = null } = options;

  const result = {
    valid: true,
    errors: [],
  };

  if (required && (!input || input.trim().length === 0)) {
    result.valid = false;
    result.errors.push("Input is required");
  }

  if (input && input.length > maxLength) {
    result.valid = false;
    result.errors.push(`Input exceeds maximum length of ${maxLength}`);
  }

  if (pattern && input && !pattern.test(input)) {
    result.valid = false;
    result.errors.push("Input does not match required format");
  }

  return result;
}

module.exports = {
  isTicketTopic,
  parseTicketTopic,
  sanitizeText,
  isValidUserId,
  isValidChannelId,
  isValidGuildId,
  isValidRoleId,
  isValidNumber,
  sanitizeTopic,
  validateInput,
};
