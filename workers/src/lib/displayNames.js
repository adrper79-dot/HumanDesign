/**
 * Canonical display-name mapping for user-facing output.
 * Source: PRODUCT_PRINCIPLES.md §8 — Approved Vocabulary
 *
 * Internal/engine values → user-facing brand terms.
 * Use at render time only. Do NOT modify DB values or engine output.
 */

const TYPE_NAMES = {
  'Generator': 'Builder Pattern',
  'Manifesting Generator': 'Builder-Initiator Pattern',
  'Projector': 'Guide Pattern',
  'Manifestor': 'Catalyst Pattern',
  'Reflector': 'Mirror Pattern',
};

const AUTHORITY_NAMES = {
  'Emotional': 'Emotional Wave Navigation',
  'Emotional Authority': 'Emotional Wave Navigation',
  'Sacral': 'Life Force Response',
  'Sacral Authority': 'Life Force Response',
  'Splenic': 'Intuitive Knowing',
  'Splenic Authority': 'Intuitive Knowing',
  'Ego': 'Willpower Alignment',
  'Ego Authority': 'Willpower Alignment',
  'Heart': 'Willpower Alignment',
  'Heart Authority': 'Willpower Alignment',
  'Self-Projected': 'Voiced Truth',
  'Self-Projected Authority': 'Voiced Truth',
  'Lunar': 'Lunar Cycle Awareness',
  'None': 'Outer Authority',
};

const DEFINITION_NAMES = {
  'Single': 'Single Definition',
  'Split': 'Bridging Pattern',
  'Split Definition': 'Bridging Pattern',
  'Triple Split': 'Triple Bridging Pattern',
  'Triple Split Definition': 'Triple Bridging Pattern',
  'Quadruple Split': 'Quadruple Bridging Pattern',
  'Quadruple Split Definition': 'Quadruple Bridging Pattern',
  'No Definition': 'Open Flow',
};

const MISC_NAMES = {
  'Human Design': 'Energy Blueprint',
  'Gene Keys': 'Frequency Keys',
  'Bodygraph': 'Energy Chart',
  'Incarnation Cross': 'Life Purpose Vector',
  'Not-Self Theme': 'Not-Self Signal',
  'Profile': 'Archetype Code',
  'Siddhi': 'Mastery',
};

export function mapTypeName(raw) {
  return TYPE_NAMES[raw] || raw;
}

export function mapAuthorityName(raw) {
  return AUTHORITY_NAMES[raw] || raw;
}

export function mapDefinitionName(raw) {
  return DEFINITION_NAMES[raw] || raw;
}

export function mapMiscName(raw) {
  return MISC_NAMES[raw] || raw;
}

export function mapDisplayTerm(raw) {
  return MISC_NAMES[raw] || TYPE_NAMES[raw] || AUTHORITY_NAMES[raw] || DEFINITION_NAMES[raw] || raw;
}

export { TYPE_NAMES, AUTHORITY_NAMES, DEFINITION_NAMES, MISC_NAMES };
