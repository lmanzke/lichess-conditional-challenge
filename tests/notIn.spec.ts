import MockAdapter from 'axios-mock-adapter';
import { axiosFactory } from '@/challenge/axios';
import { AxiosInstance } from 'axios';
import { Challenge, DeclineReason, Rule } from '@/challenge/types';
import { convertRuleReader } from '@/challenge/lichess';
import * as E from 'fp-ts/Either';

describe('not in spec', function() {
  let mockAdapter: MockAdapter;
  let axios: AxiosInstance;
  beforeEach(() => {
    axios = axiosFactory();
    mockAdapter = new MockAdapter(axios);
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
      silent: false,
    };
    const spec = convertRuleReader(rule);
    await expect(spec(challenge)(axios)()).resolves.toEqual(E.right({ isSatisfied: false, reason: DeclineReason.RULE_FAILED, silent: false }));
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
      silent: false,
    };
    const spec = convertRuleReader(rule);
    await expect(spec(challenge)(axios)()).resolves.toEqual(E.right({ isSatisfied: true }));
  });
});
