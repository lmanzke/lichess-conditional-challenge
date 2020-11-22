export enum Relation {
  LESS_THAN = 'LT',
  LESS_THAN_EQUAL = 'LTE',
  GREATER_THAN = 'GT',
  GREATER_THAN_EQUAL = 'GTE',
  EQUAL = 'EQ',
  NOT_EQUAL = 'NEQ',
  NOT_IN = 'NIN',
  IN = 'IN',
  BETWEEN = 'BETW',
}

export const mapOperator = (operator: string): Relation => {
  switch (operator) {
    case 'less':
      return Relation.LESS_THAN;
    case 'less_or_equal':
      return Relation.LESS_THAN_EQUAL;
    case 'greater':
      return Relation.GREATER_THAN;
    case 'greater_or_equal':
      return Relation.GREATER_THAN_EQUAL;
    case 'not_equal':
      return Relation.NOT_EQUAL;
    case 'not_in':
      return Relation.NOT_IN;
    case 'in':
      return Relation.IN;
    case 'between':
      return Relation.BETWEEN;
    case 'equal':
    default:
      return Relation.EQUAL;
  }
};

export const compare = (relation: Relation, value: string | number | boolean | string[]) => (candidate: string | number | boolean): boolean => {
  switch (relation) {
    case Relation.LESS_THAN:
      return value > candidate;
    case Relation.GREATER_THAN:
      return value < candidate;
    case Relation.LESS_THAN_EQUAL:
      return value >= candidate;
    case Relation.GREATER_THAN_EQUAL:
      return value <= candidate;
    case Relation.IN:
      if (!Array.isArray(value)) {
        return value
          .toString()
          .split(';')
          .includes(candidate.toString());
      }
      return value.includes(candidate.toString());
    case Relation.BETWEEN:
      if (!Array.isArray(value)) {
        return false;
      }
      return candidate >= Math.min(...value.map(v => parseFloat(v))) && candidate <= Math.max(...value.map(v => parseFloat(v)));
    case Relation.NOT_EQUAL:
      return value !== candidate;
    case Relation.NOT_IN:
      if (typeof value === 'boolean' || typeof value === 'number') {
        return false;
      }
      if (!Array.isArray(value)) {
        return !value.split(';').includes(candidate.toString());
      }
      return !value.map(v => v.toString()).includes(candidate.toString());
    case Relation.EQUAL:
    default:
      return value === candidate;
  }
};
