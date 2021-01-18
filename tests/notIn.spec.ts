import { Challenge, convertRuleFactory, Rule, RuleConverter } from '@/challenge/lichess';
import MockAdapter from 'axios-mock-adapter';
import { axiosFactory } from '@/challenge/axios';
import { SpecFactory, specFactory } from '@/challenge/spec';
import { AxiosInstance } from 'axios';

describe('not in spec', function() {
  let speccer: SpecFactory;
  let ruler: RuleConverter;
  let mockAdapter: MockAdapter;
  let axios: AxiosInstance;
  beforeEach(() => {
    axios = axiosFactory();
    mockAdapter = new MockAdapter(axios);
    speccer = specFactory(axios);
    ruler = convertRuleFactory(speccer);
  });

  afterEach(() => {
    mockAdapter.restore();
  });

  it('should return false for not in with blacklisted user', async function() {
    const accepted = jest.fn();
    const declined = jest.fn();
    const challenge: Challenge = {
      accept: accepted,
      challenger: {
        rating: 1600,
        id: 'user-1',
      },
      decline: declined,
      id: 'OheaU77B',
      rated: false,
      userLink: 'https://lichess.org/@/user-1',
      username: 'User-1',
      variant: { key: 'standard' },
    };
    const rule: Rule = {
      condition: undefined,
      id: 'user-id',
      operator: 'not_in',
      rules: [],
      value: 'user-1;user2',
    };
    const spec = ruler(rule);
    await expect(spec.isSatisfied(challenge)).resolves.toEqual(false);
  });

  it('should return true for not in with not blacklisted user', async function() {
    const accepted = jest.fn();
    const declined = jest.fn();
    const challenge: Challenge = {
      accept: accepted,
      challenger: {
        rating: 1600,
        id: 'user-3',
      },
      decline: declined,
      id: 'OheaU77B',
      rated: false,
      userLink: 'https://lichess.org/@/user-1',
      username: 'User-1',
      variant: { key: 'standard' },
    };
    const rule: Rule = {
      condition: undefined,
      id: 'user-id',
      operator: 'not_in',
      rules: [],
      value: 'user-1;user2',
    };
    const spec = ruler(rule);
    await expect(spec.isSatisfied(challenge)).resolves.toEqual(true);
  });
});
