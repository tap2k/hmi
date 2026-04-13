/**
 * transform.js — HMI Middleware Signal Processing
 *
 * Core transform functions for normalizing raw hardware axis values into
 * the canonical -1.0 to 1.0 range. Apply in the order defined by
 * transformAxis() at the bottom of this file.
 *
 * These functions are used in Node-RED function nodes. They are documented
 * in CLAUDE.md as the canonical reference implementation.
 */

/**
 * Apply dead zone. Values within the threshold of center are clamped to 0
 * to prevent jitter when the stick is at rest.
 *
 * @param {number} value - Normalized input value (-1.0 to 1.0)
 * @param {number} threshold - Dead zone radius (default 0.08)
 * @returns {number}
 */
function applyDeadzone(value, threshold = 0.08) {
  if (Math.abs(value) < threshold) return 0.0;
  return value;
}

/**
 * Rescale the post-deadzone value back to the full -1.0 to 1.0 range.
 * Without this, the usable range is compressed by the dead zone size.
 *
 * @param {number} value - Value after applyDeadzone()
 * @param {number} threshold - Same threshold used in applyDeadzone()
 * @returns {number}
 */
function rescaleAfterDeadzone(value, threshold = 0.08) {
  if (value === 0) return 0;
  const sign = value > 0 ? 1 : -1;
  return sign * (Math.abs(value) - threshold) / (1 - threshold);
}

/**
 * Linear interpolation (lerp). Moves the current output toward the target
 * value by alpha each tick, simulating hydraulic lag.
 *
 * Recommended alpha values:
 *   0.08–0.12  heavy hydraulic feel (excavator boom)
 *   0.15–0.20  moderate (standard backhoe)
 *   0.25–0.35  light / responsive (testing/debug)
 *
 * @param {number} current - Previous smoothed output value
 * @param {number} target - New target value
 * @param {number} alpha - Responsiveness (0 = no movement, 1 = snap)
 * @returns {number}
 */
function lerp(current, target, alpha = 0.15) {
  return current + (target - current) * alpha;
}

/**
 * Clamp output to bounds. Ensures the value never exceeds the valid range
 * regardless of floating point drift or bad input.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min = -1.0, max = 1.0) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Full transform pipeline. Apply in this order for every axis value.
 *
 * @param {number} rawValue - Raw normalized input (-1.0 to 1.0)
 * @param {number} prevOutput - Previous smoothed output (for lerp continuity)
 * @param {object} config
 * @param {number} [config.deadzoneThreshold=0.08]
 * @param {number} [config.lerpAlpha=0.15]
 * @returns {number} Transformed axis value (-1.0 to 1.0)
 */
function transformAxis(rawValue, prevOutput, config = {}) {
  const { deadzoneThreshold = 0.08, lerpAlpha = 0.15 } = config;
  const deadzoned = applyDeadzone(rawValue, deadzoneThreshold);
  const rescaled  = rescaleAfterDeadzone(deadzoned, deadzoneThreshold);
  const smoothed  = lerp(prevOutput, rescaled, lerpAlpha);
  const clamped   = clamp(smoothed);
  // Snap to zero if very close — prevents lerp from endlessly chasing jitter
  return Math.abs(clamped) < 0.002 ? 0 : clamped;
}

module.exports = { applyDeadzone, rescaleAfterDeadzone, lerp, clamp, transformAxis };
