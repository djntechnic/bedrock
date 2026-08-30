import { logger } from "../lib/logger.js";
function getConditionalClass(value, rulesJson) {
  if (!rulesJson || value === null || value === void 0) return "";
  try {
    const rules = JSON.parse(rulesJson);
    const numValue = Number(value);
    if (isNaN(numValue)) return "";
    for (const rule of rules) {
      let match = false;
      switch (rule.op) {
        case "gte":
          match = numValue >= (rule.value ?? 0);
          break;
        case "gt":
          match = numValue > (rule.value ?? 0);
          break;
        case "lte":
          match = numValue <= (rule.value ?? 0);
          break;
        case "lt":
          match = numValue < (rule.value ?? 0);
          break;
        case "eq":
          match = numValue === (rule.value ?? 0);
          break;
        case "between":
          match = numValue >= (rule.min ?? 0) && numValue <= (rule.max ?? 0);
          break;
      }
      if (match) {
        switch (rule.color) {
          case "emerald":
            return "text-teal-700 dark:text-teal-400 font-medium";
          case "rose":
            return "text-red-700 dark:text-red-400 font-medium";
          case "amber":
            return "text-orange-600 dark:text-orange-400 font-medium";
          case "blue":
            return "text-blue-700 dark:text-blue-400 font-medium";
          default:
            return "";
        }
      }
    }
  } catch (e) {
    logger.warn("Failed to parse conditional format rules", { error: e });
  }
  return "";
}
function getConditionalVariant(value, rulesJson) {
  if (!rulesJson || value === null || value === void 0) return null;
  try {
    const rules = JSON.parse(rulesJson);
    const numValue = Number(value);
    if (isNaN(numValue)) return null;
    for (const rule of rules) {
      let match = false;
      switch (rule.op) {
        case "gte":
          match = numValue >= (rule.value ?? 0);
          break;
        case "gt":
          match = numValue > (rule.value ?? 0);
          break;
        case "lte":
          match = numValue <= (rule.value ?? 0);
          break;
        case "lt":
          match = numValue < (rule.value ?? 0);
          break;
        case "eq":
          match = numValue === (rule.value ?? 0);
          break;
        case "between":
          match = numValue >= (rule.min ?? 0) && numValue <= (rule.max ?? 0);
          break;
      }
      if (match) {
        switch (rule.color) {
          case "emerald":
            return "positive";
          case "rose":
            return "negative";
          case "amber":
            return "warning";
          case "blue":
            return "neutral";
          default:
            return null;
        }
      }
    }
  } catch (e) {
    logger.warn("Failed to parse conditional format rules", { error: e });
  }
  return null;
}
export {
  getConditionalClass,
  getConditionalVariant
};
//# sourceMappingURL=conditionalFormat.js.map
