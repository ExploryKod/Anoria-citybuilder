/** @param {object} partner */
export function hasActiveContract(partner) {
  const hasActiveImports = partner.imports.some(
    (imp) => (imp.currentOccurrences || 0) < imp.maxOccurrences
  );
  const hasActiveExports = partner.exports.some(
    (exp) => (exp.currentOccurrences || 0) < exp.maxOccurrences
  );
  return hasActiveImports || hasActiveExports;
}

/** @param {object} partner */
export function isContractFinished(partner) {
  if (!partner || !partner.isActive) {
    return false;
  }

  const hasImports = partner.imports && partner.imports.length > 0;
  const hasExports = partner.exports && partner.exports.length > 0;

  if (!hasImports && !hasExports) {
    return false;
  }

  const allImportsFinished = hasImports
    ? partner.imports.every((imp) => (imp.currentOccurrences || 0) >= imp.maxOccurrences)
    : true;

  const allExportsFinished = hasExports
    ? partner.exports.every((exp) => (exp.currentOccurrences || 0) >= exp.maxOccurrences)
    : true;

  return allImportsFinished && allExportsFinished;
}

/** @param {object} partner */
export function getContractStatus(partner) {
  const finishedImports = partner.imports
    .filter((imp) => (imp.currentOccurrences || 0) >= imp.maxOccurrences)
    .map((imp) => ({
      productId: imp.productId,
      productName: imp.productName,
      currentOccurrences: imp.currentOccurrences || 0,
      maxOccurrences: imp.maxOccurrences,
    }));

  const finishedExports = partner.exports
    .filter((exp) => (exp.currentOccurrences || 0) >= exp.maxOccurrences)
    .map((exp) => ({
      productId: exp.productId,
      productName: exp.productName,
      currentOccurrences: exp.currentOccurrences || 0,
      maxOccurrences: exp.maxOccurrences,
    }));

  return {
    finishedImports,
    finishedExports,
    hasActiveContract: hasActiveContract(partner),
  };
}
