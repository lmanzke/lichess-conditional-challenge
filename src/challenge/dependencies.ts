import jpex, { JpexInstance } from 'jpex';
import { axiosFactory } from '@/challenge/axios';
import { AxiosInstance } from 'axios';
import store from '../store';
import { specFactory, SpecFactory } from '@/challenge/spec';
import { ChallengeRetriever, convertRuleFactory, getChallengeInfosFactory, RuleConverter } from '@/challenge/lichess';
import { Store } from 'vuex';

export const getDependencyContainer = (): JpexInstance => {
  jpex.factory<AxiosInstance>('axios', [], axiosFactory);
  jpex.constant<Store<any>>('store', store);
  jpex.factory<SpecFactory>('specFactory', ['axios'], specFactory);
  jpex.factory<RuleConverter>('ruleConverter', ['specFactory'], convertRuleFactory);
  jpex.factory<ChallengeRetriever>('challengeRetriever', ['axios'], getChallengeInfosFactory);

  return jpex;
};
