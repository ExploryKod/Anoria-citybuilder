/**
 * ACL Employment — only entry from legacy `src/js/` into the Employment BC.
 *
 * Do not import `contexts/employment/domain/**` from UI or SimServices.
 */

export {
  createEmploymentContext,
  getOrCreateEmploymentContext,
} from '../../composition/createEmploymentContext.js';
