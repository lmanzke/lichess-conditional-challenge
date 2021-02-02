/* eslint-disable @typescript-eslint/no-empty-function */
import axios, { AxiosInstance } from 'axios';
import { Relation } from '@/challenge/operators';
import { Team } from '@/challenge/types';
import { teamReaderSpec } from '@/challenge/lichess';
import * as E from 'fp-ts/Either';

describe('compareTeams', function() {
  let http: AxiosInstance;
  beforeEach(() => {
    http = axios.create();
  });
  it('should work for an IN operator', function() {
    jest.spyOn(http, 'get').mockImplementation(() =>
      Promise.resolve<{ data: Team[] }>({
        data: [
          {
            id: 'team1',
            name: 'Team 1',
            description: 'team1',
            leader: {
              id: 'leader1',
              name: 'Leader 1',
            },
            leaders: [],
            location: 'Berlin',
            nbMembers: 1,
            open: false,
          },
        ],
      })
    );

    const challenge = {
      accept(): void {},
      challenger: {
        rating: 1200,
        id: 'any',
      },
      decline(): void {},
      id: 'challenger1',
      rated: false,
      userLink: '',
      username: '',
      variant: {
        key: 'standard',
      },
    };
    const testSubject = teamReaderSpec('team1', Relation.IN)(challenge)(http)();
    expect(testSubject).resolves.toEqual(E.right({ isSatisfied: true, silent: false }));
  });
});
