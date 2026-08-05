/**
 * Shared Kernel: Citizen status catalog (readonly reference data).
 *
 * NOT a Bounded Context — no invariants, no mutations, no lifecycle.
 * This is a vocabulary module consumed by Housing, Employment, and Accounting
 * contexts. Each BC projects its own view of citizen status.
 *
 * Architecture rule: This module must remain stateless and side-effect-free.
 * BCs own their own policies and invariants; this catalog provides shared labels.
 *
 * ## Design Philosophy
 *
 * A citizen STATUS is a social contract defining:
 * - **Skills** (compétences) → what you CAN do (production, employment)
 * - **Duties** (devoirs) → what you MUST do/pay (taxes, obligations)
 * - **Rights** (droits) → what you RECEIVE (income, protection)
 * - **Housing Metadata** (documentation) → typical housing relationship (NOT enforced)
 *
 * Skills are CUMULATIVE — higher statuses add to the base set:
 * - hunter-gatherer: subsistence-forager
 * - worker: subsistence-forager + employment-eligible
 *
 * Housing metadata documents the status↔housing relationship but does NOT
 * grant housing access. Causality: house.level → status (not the reverse).
 */

/**
 * @typedef {object} CitizenSkill
 * @property {string} [description] - Human-readable description
 * @property {object} [produces] - Production output (e.g., { fruit: 1, game: 1 })
 * @property {'by-group' | 'none' | number[]} [eligibleSectors] - For employment skills
 * @property {boolean} [canBeAssigned] - Can be assigned to workplaces
 *
 * @typedef {object} CitizenDuties
 * @property {boolean} taxpayer - Must pay per-capita citizen tax
 * @property {boolean} payrollTax - Income taxed at payroll rate
 *
 * @typedef {object} CitizenRights
 * @property {IncomeRight} income - Income entitlement
 *
 * @typedef {object} IncomeRight
 * @property {boolean} receives - Gets monetary income
 * @property {'none' | 'self-sufficient' | 'employer-paid' | 'city-paid'} source
 * @property {number} multiplier - Multiplier on reference salary (0.0 to 2.0)
 *
 * @typedef {object} HousingMetadata
 * @property {1 | 2 | null} typicalLevel - Typical dwelling level (1=cabane, 2=masure, null=special)
 * @property {'none' | 'parent-dependent'} constraint - Housing constraint type
 * @property {string} description - Human-readable explanation
 *
 * @typedef {object} CitizenStatusProfile
 * @property {Record<string, CitizenSkill>} skills - Cumulative capabilities
 * @property {CitizenDuties} duties - Obligations to the city
 * @property {CitizenRights} rights - Entitlements from the city
 * @property {HousingMetadata} housingMetadata - Descriptive housing relationship (NOT enforced here)
 * @property {HousingProjection} housing - Legacy: housing-specific flags
 * @property {EmploymentProjection} employment - Legacy: employment summary (derived from skills)
 * @property {AccountingProjection} accounting - Legacy: accounting summary (derived from duties/rights)
 *
 * @typedef {object} HousingProjection
 * @property {boolean} contributesToGrowth - Does this citizen count toward +1 pop/month?
 * @property {boolean} consumesFood - Does this citizen consume food baskets?
 *
 * @typedef {object} EmploymentProjection
 * @property {boolean} isEmployable - Can be assigned to workplaces?
 * @property {'by-group' | 'none' | number[]} eligibleSectors - Sector eligibility
 * @property {boolean} countsInLaborPool - Included in workerPool aggregate?
 *
 * @typedef {object} AccountingProjection
 * @property {boolean} paysCitizenTax - Subject to per-capita citizen tax?
 * @property {boolean} paysPayrollTax - Salary taxed at payroll rate?
 * @property {boolean} receivesIncome - Gets money (salary or benefit)?
 * @property {'none' | 'self-sufficient' | 'employer-paid' | 'city-paid'} incomeSource
 * @property {number} incomeMultiplier - Multiplier on reference salary (0.0 to 2.0)
 */

/** @type {Readonly<Record<string, CitizenStatusProfile>>} */
export const CITIZEN_STATUS_PROFILES = Object.freeze({
  /**
   * Level 1 house residents (autarky / hunter-gatherer).
   * Self-sufficient, outside formal economy.
   */
  'hunter-gatherer': Object.freeze({
    // Skills: what you CAN do
    skills: Object.freeze({
      'subsistence-forager': Object.freeze({
        description: 'Cueillette et chasse autonome',
        produces: Object.freeze({ fruit: 1, game: 1 }), // per house per month (TOTAL)
      }),
    }),
    
    // Duties: what you MUST do
    duties: Object.freeze({
      taxpayer: false, // No taxes in autarky
      payrollTax: false,
    }),
    
    // Rights: what you RECEIVE
    rights: Object.freeze({
      income: Object.freeze({
        receives: false,
        source: 'self-sufficient',
        multiplier: 0.0,
      }),
    }),
    
    // Housing metadata (descriptive, NOT enforced by this catalog)
    housingMetadata: Object.freeze({
      typicalLevel: 1, // Lives in cabane (level 1)
      constraint: 'none',
      description: 'Réside en cabane (niveau 1). Le niveau de la maison détermine ce statut.',
    }),
    
    // Legacy projections (derived from above, kept for backward compatibility)
    housing: Object.freeze({
      contributesToGrowth: true,
      consumesFood: true,
    }),
    employment: Object.freeze({
      isEmployable: false,
      eligibleSectors: 'none',
      countsInLaborPool: false,
    }),
    accounting: Object.freeze({
      paysCitizenTax: false,
      paysPayrollTax: false,
      receivesIncome: false,
      incomeSource: 'self-sufficient',
      incomeMultiplier: 0.0,
    }),
  }),

  /**
   * Level 2 house residents (integrated into city economy).
   * CUMULATIVE SKILLS: keeps subsistence-forager + gains employment-eligible.
   */
  worker: Object.freeze({
    // Skills: CUMULATIVE (hunter-gatherer skills + new ones)
    skills: Object.freeze({
      'subsistence-forager': Object.freeze({
        description: 'Cueillette et chasse (maintenue)',
        produces: Object.freeze({ fruit: 1, game: 1 }), // per house per month - KEPT from level 1!
      }),
      'employment-eligible': Object.freeze({
        description: 'Employable dans les secteurs du groupe résidentiel',
        eligibleSectors: 'by-group', // resolved via residentialGroup (farm/artisan/merchant/scholar)
        canBeAssigned: true,
      }),
    }),
    
    // Duties: now pays taxes
    duties: Object.freeze({
      taxpayer: true, // Per-capita citizen tax
      payrollTax: true, // Income tax
    }),
    
    // Rights: receives income from employer
    rights: Object.freeze({
      income: Object.freeze({
        receives: true,
        source: 'employer-paid',
        multiplier: 1.0, // Base reference salary
      }),
    }),
    
    // Housing metadata (descriptive, NOT enforced by this catalog)
    housingMetadata: Object.freeze({
      typicalLevel: 2, // Lives in masure (level 2) artisan house
      constraint: 'none',
      description: 'Réside en masure (niveau 2). Le niveau de la maison détermine ce statut (route + pop).',
    }),
    
    // Legacy projections
    housing: Object.freeze({
      contributesToGrowth: true,
      consumesFood: true,
    }),
    employment: Object.freeze({
      isEmployable: true,
      eligibleSectors: 'by-group',
      countsInLaborPool: true,
    }),
    accounting: Object.freeze({
      paysCitizenTax: true,
      paysPayrollTax: true,
      receivesIncome: true,
      incomeSource: 'employer-paid',
      incomeMultiplier: 1.0,
    }),
  }),

  /**
   * Unemployed worker (same skills/duties as worker, but city-paid income).
   * Dynamic status created by Employment redistribution when no job assigned.
   */
  unemployed: Object.freeze({
    // Skills: identical to worker
    skills: Object.freeze({
      'subsistence-forager': Object.freeze({
        description: 'Cueillette et chasse',
        produces: Object.freeze({ fruit: 1, game: 1 }), // per house per month
      }),
      'employment-eligible': Object.freeze({
        description: 'Cherche emploi',
        eligibleSectors: 'by-group',
        canBeAssigned: true,
        currentlyAssigned: false, // KEY difference from 'worker'
      }),
    }),
    
    // Duties: same as worker
    duties: Object.freeze({
      taxpayer: true,
      payrollTax: true, // Even on unemployment benefits
    }),
    
    // Rights: city-paid income at reduced rate
    rights: Object.freeze({
      income: Object.freeze({
        receives: true,
        source: 'city-paid', // KEY difference
        multiplier: 0.7, // Unemployment benefit rate
      }),
    }),
    
    // Housing metadata (descriptive, NOT enforced by this catalog)
    housingMetadata: Object.freeze({
      typicalLevel: 2, // Lives in masure (level 2) - same as worker
      constraint: 'none',
      description: 'Réside en masure (niveau 2). Chômeur temporaire conservant son logement.',
    }),
    
    // Legacy projections
    housing: Object.freeze({
      contributesToGrowth: true,
      consumesFood: true,
    }),
    employment: Object.freeze({
      isEmployable: true,
      eligibleSectors: 'by-group',
      countsInLaborPool: true,
    }),
    accounting: Object.freeze({
      paysCitizenTax: true,
      paysPayrollTax: true,
      receivesIncome: true,
      incomeSource: 'city-paid',
      incomeMultiplier: 0.7,
    }),
  }),

  /**
   * Civil servant (1 per 12 total population).
   * Public administration role, full city-paid salary.
   */
  'civil-servant': Object.freeze({
    // Skills: subsistence + administration (not regular employment)
    skills: Object.freeze({
      'subsistence-forager': Object.freeze({
        description: 'Cueillette et chasse',
        produces: Object.freeze({ fruit: 1, game: 1 }), // per house per month
      }),
      'administration': Object.freeze({
        description: 'Service public (gouvernance)',
        providesService: 'city-administration',
        notAssignableToWorkplaces: true,
      }),
    }),
    
    // Duties: pays taxes + public service obligation
    duties: Object.freeze({
      taxpayer: true,
      payrollTax: true,
      publicService: true, // Must serve the city
    }),
    
    // Rights: guaranteed city income
    rights: Object.freeze({
      income: Object.freeze({
        receives: true,
        source: 'city-paid',
        multiplier: 1.0, // Full reference salary
        stability: 'guaranteed', // Cannot be fired (not implemented yet)
      }),
    }),
    
    // Housing metadata (descriptive, NOT enforced by this catalog)
    housingMetadata: Object.freeze({
      typicalLevel: 2, // Lives in masure (level 2) - city employee
      constraint: 'none',
      description: 'Réside en masure (niveau 2). Fonctionnaire payé par la ville.',
    }),
    
    // Legacy projections
    housing: Object.freeze({
      contributesToGrowth: true,
      consumesFood: true,
    }),
    employment: Object.freeze({
      isEmployable: false,
      eligibleSectors: 'none',
      countsInLaborPool: false,
    }),
    accounting: Object.freeze({
      paysCitizenTax: true,
      paysPayrollTax: true,
      receivesIncome: true,
      incomeSource: 'city-paid',
      incomeMultiplier: 1.0,
    }),
  }),

  /**
   * Elite (palace resident beyond citizen cap).
   * Leadership role, no subsistence production (palace luxury).
   */
  elite: Object.freeze({
    // Skills: NO subsistence (palace provides), governance/leadership only
    skills: Object.freeze({
      'governance': Object.freeze({
        description: 'Direction et gouvernance',
        providesService: 'leadership',
        influencesPolicy: true, // Future: policy decisions
      }),
    }),
    
    // Duties: pays taxes, leadership obligation
    duties: Object.freeze({
      taxpayer: true, // Future: higher rate?
      payrollTax: true,
      leadership: true, // Must govern
    }),
    
    // Rights: double income
    rights: Object.freeze({
      income: Object.freeze({
        receives: true,
        source: 'employer-paid', // Or 'palace-revenue'
        multiplier: 2.0, // Elite income bonus
      }),
    }),
    
    // Housing metadata (descriptive, NOT enforced by this catalog)
    housingMetadata: Object.freeze({
      typicalLevel: 2, // Lives in masure (level 2) - including palace
      constraint: 'none',
      description: 'Réside en masure (niveau 2). Dirigeants et élites de la ville.',
    }),
    
    // Legacy projections
    housing: Object.freeze({
      contributesToGrowth: false, // additive slot, not growth
      consumesFood: true,
    }),
    employment: Object.freeze({
      isEmployable: false,
      eligibleSectors: 'none',
      countsInLaborPool: false,
    }),
    accounting: Object.freeze({
      paysCitizenTax: true,
      paysPayrollTax: true,
      receivesIncome: true,
      incomeSource: 'employer-paid',
      incomeMultiplier: 2.0,
    }),
  }),

  /**
   * Youth (future: age < 16, not yet implemented).
   * Minor, not economically active, can attend school.
   */
  youth: Object.freeze({
    // Skills: learning only
    skills: Object.freeze({
      'learning': Object.freeze({
        description: 'Apprentissage scolaire',
        canAttendSchool: true,
      }),
    }),
    
    // Duties: no taxes, parental obedience
    duties: Object.freeze({
      taxpayer: false,
      payrollTax: false,
      parentalObedience: true, // Not enforced in game
    }),
    
    // Rights: no income (dependent)
    rights: Object.freeze({
      income: Object.freeze({
        receives: false,
        source: 'none',
        multiplier: 0.0,
      }),
      socialProtection: Object.freeze({
        education: true, // Future: school access
        healthcare: true, // Future
      }),
    }),
    
    // Housing metadata (descriptive, NOT enforced by this catalog)
    housingMetadata: Object.freeze({
      typicalLevel: null, // Depends on parent's house (1 or 2)
      constraint: 'parent-dependent',
      description: 'Réside avec les parents (niveau 1 ou 2 selon la famille). Mineur à charge.',
    }),
    
    // Legacy projections
    housing: Object.freeze({
      contributesToGrowth: false,
      consumesFood: true,
    }),
    employment: Object.freeze({
      isEmployable: false,
      eligibleSectors: 'none',
      countsInLaborPool: false,
    }),
    accounting: Object.freeze({
      paysCitizenTax: false,
      paysPayrollTax: false,
      receivesIncome: false,
      incomeSource: 'none',
      incomeMultiplier: 0.0,
    }),
  }),

  /**
   * Retired (future: age >= 65, not yet implemented).
   * Former worker, reduced subsistence, pension income.
   */
  retired: Object.freeze({
    // Skills: reduced subsistence + wisdom
    skills: Object.freeze({
      'subsistence-forager': Object.freeze({
        description: 'Cueillette et chasse réduites',
        produces: Object.freeze({ fruit: 0.5, game: 0.5 }), // per house per month (reduced)
      }),
      'elder-wisdom': Object.freeze({
        description: 'Conseil des anciens',
        providesAdvice: true, // Future: bonus to certain buildings
      }),
    }),
    
    // Duties: tax-exempt
    duties: Object.freeze({
      taxpayer: false, // Retired are exempt
      payrollTax: false,
    }),
    
    // Rights: pension from city
    rights: Object.freeze({
      income: Object.freeze({
        receives: true, // Future implementation
        source: 'city-paid',
        type: 'pension',
        multiplier: 0.6, // Pension rate
      }),
      socialProtection: Object.freeze({
        healthcare: 'priority', // Future
      }),
    }),
    
    // Housing metadata (descriptive, NOT enforced by this catalog)
    housingMetadata: Object.freeze({
      typicalLevel: 2, // Lives in masure (level 2) - former worker
      constraint: 'none',
      description: 'Réside en masure (niveau 2). Ancien travailleur à la retraite.',
    }),
    
    // Legacy projections
    housing: Object.freeze({
      contributesToGrowth: false,
      consumesFood: true,
    }),
    employment: Object.freeze({
      isEmployable: false,
      eligibleSectors: 'none',
      countsInLaborPool: false,
    }),
    accounting: Object.freeze({
      paysCitizenTax: false,
      paysPayrollTax: false,
      receivesIncome: false, // Will be true when pension implemented
      incomeSource: 'none',
      incomeMultiplier: 0.0,
    }),
  }),
});

/**
 * Resolve citizen status from house level (current game state).
 * Palace élites are tracked separately via `elitePopFromHouse`.
 *
 * @param {1 | 2} level
 * @returns {keyof typeof CITIZEN_STATUS_PROFILES}
 */
export function resolveCitizenStatusFromLevel(level) {
  return level === 2 ? 'worker' : 'hunter-gatherer';
}

/**
 * Get profile for a given status key.
 *
 * @param {string} statusKey
 * @returns {CitizenStatusProfile}
 */
export function getCitizenStatusProfile(statusKey) {
  return CITIZEN_STATUS_PROFILES[statusKey] ?? CITIZEN_STATUS_PROFILES['hunter-gatherer'];
}

// === Skills/Duties/Rights Accessors ===

/**
 * Check if a citizen status has a specific skill.
 *
 * @param {string} statusKey
 * @param {string} skillKey
 * @returns {boolean}
 */
export function hasSkill(statusKey, skillKey) {
  const profile = getCitizenStatusProfile(statusKey);
  return Object.hasOwn(profile.skills, skillKey);
}

/**
 * Get all skills for a citizen status.
 *
 * @param {string} statusKey
 * @returns {Record<string, CitizenSkill>}
 */
export function getSkills(statusKey) {
  const profile = getCitizenStatusProfile(statusKey);
  return profile.skills;
}

/**
 * Get duties for a citizen status.
 *
 * @param {string} statusKey
 * @returns {CitizenDuties}
 */
export function getDuties(statusKey) {
  const profile = getCitizenStatusProfile(statusKey);
  return profile.duties;
}

/**
 * Get rights for a citizen status.
 *
 * @param {string} statusKey
 * @returns {CitizenRights}
 */
export function getRights(statusKey) {
  const profile = getCitizenStatusProfile(statusKey);
  return profile.rights;
}

/**
 * Get skill names for a citizen status.
 *
 * @param {string} statusKey
 * @returns {string[]}
 */
export function getSkillNames(statusKey) {
  return Object.keys(getSkills(statusKey));
}
