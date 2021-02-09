import { Challenge, DeclineReason, SpecResult } from '@/challenge/types';
import { IO } from 'fp-ts/IO';
import { ratedSpec } from '@/challenge/lichess';
import { Relation } from '@/challenge/operators';

const getChallenge = (rated: boolean): Challenge => ({
  accept: jest.fn(),
  challenger: {
    rating: 1500,
    id: 'user1',
  },
  decline(reason: DeclineReason): IO<void> {
    return jest.fn();
  },
  id: 'c1',
  rated,
  userLink: '',
  username: '',
  variant: { key: 'standard' },
});

const spec = ratedSpec(true, Relation.EQUAL);

describe('Rated True Spec', function() {
  it('should pass for rated challenge', function() {
    const ratedChallenge = getChallenge(true);
    const expected: SpecResult = { isSatisfied: true };

    expect(spec(ratedChallenge)).toEqual(expected);
  });

  it('should decline for unrated challenge with correct reason', function() {
    const unratedChallenge = getChallenge(false);
    const expected = {
      isSatisfied: false,
      fieldName: 'rated',
      operator: Relation.NOT_EQUAL,
      targetValue: true,
      silent: false,
    };
    expect(spec(unratedChallenge)).toEqual(expected);
  });
});
