import jpex, { JpexInstance } from 'jpex';
import { axiosFactory } from '@/challenge/axios';
import { AxiosInstance } from 'axios';
import { specFactory, SpecFactory } from '@/challenge/spec';
import { ChallengeRetriever, convertRuleFactory, getChallengeInfosFactory, RuleConverter } from '@/challenge/lichess';

export const getDependencyContainer = (): JpexInstance => {
  jpex.factory<AxiosInstance>('axios', [], axiosFactory);
  jpex.factory<SpecFactory>('specFactory', ['axios'], specFactory);
  jpex.factory<RuleConverter>('ruleConverter', ['specFactory'], convertRuleFactory);
  jpex.factory<ChallengeRetriever>('challengeRetriever', ['axios'], getChallengeInfosFactory);

  return jpex;
};
