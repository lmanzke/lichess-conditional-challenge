import axios, { AxiosInstance } from 'axios';

export const axiosFactory = (): AxiosInstance =>
  axios.create({
    baseURL: 'https://lichess.org',
  });
