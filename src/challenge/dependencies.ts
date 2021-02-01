import jpex, { JpexInstance } from 'jpex';
import { axiosFactory } from '@/challenge/axios';
import { AxiosInstance } from 'axios';
import store, { State } from '@/store';
import { Store } from 'vuex';

export const getDependencyContainer = (): JpexInstance => {
  jpex.factory<AxiosInstance>('axios', [], axiosFactory);
  jpex.constant<Store<State>>('store', store);

  return jpex;
};
