/** @type {object | null} */
let pendingWorldBootstrap = null;

/**
 * @param {object} options
 */
export function setPendingWorldBootstrap(options) {
  pendingWorldBootstrap = options;
}

/**
 * @returns {object | null}
 */
export function consumePendingWorldBootstrap() {
  const pending = pendingWorldBootstrap;
  pendingWorldBootstrap = null;
  return pending;
}
