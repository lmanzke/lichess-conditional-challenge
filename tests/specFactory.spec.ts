/* eslint-disable @typescript-eslint/no-empty-function */
import axios, { AxiosInstance } from 'axios';
import { Team, teamSpecFactory } from '@/challenge/lichess';
import { Relation } from '@/challenge/operators';

describe('compareTeams', function() {
  let http: AxiosInstance;
  beforeEach(() => {
    http = axios.create();
  });
  it('should work for an IN operator', function(done) {
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
    teamSpecFactory(http)('team1', Relation.IN)
      .isSatisfied({
        accept(): void {},
        challenger: {
          rating: 1200,
        },
        decline(): void {},
        id: 'challenger1',
        rated: false,
        userLink: '',
        username: '',
        variant: {
          key: 'standard',
        },
      })
      .then(result => {
        expect(result).toEqual(true);
        done();
      })
      .catch(done);
  });
});

describe('encounterSpec', function() {
  let http: AxiosInstance;
  beforeEach(() => {
    http = axios.create();
  });
  it('should have ', function() {
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
  });
});
