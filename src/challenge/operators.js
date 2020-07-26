export const mapOperator = operator => {
  switch (operator) {
    case 'less':
      return 'LT';
    case 'less_or_equal':
      return 'LTE';
    case 'greater':
      return 'GT';
    case 'greater_or_equal':
      return 'GTE';
    case 'equal':
      return 'EQ';
    case 'not_equal':
      return 'NEQ';
    case 'not_in':
      return 'NIN';
    case 'in':
      return 'IN';
    case 'between':
      return 'BETW';
  }
};

export const compare = (relation, value) => candidate => {
  switch (relation) {
    case 'LT':
      return value > candidate;
    case 'GT':
      return value < candidate;
    case 'LTE':
      return value >= candidate;
    case 'GTE':
      return value <= candidate;
    case 'IN':
      if (!Array.isArray(value)) {
        return value.split(';').includes(candidate);
      }
      return value.includes(candidate);
    case 'BETW':
      if (!Array.isArray(value)) {
        return false;
      }
      return candidate >= Math.min(...value) && candidate <= Math.max(...value);
    case 'NEQ':
      return value !== candidate;
    case 'NIN':
      if (!Array.isArray(value)) {
        return !value.split(';').includes(candidate);
      }
      return !value.includes(candidate);
    case 'EQ':
    default:
      return value === candidate;
  }
};
