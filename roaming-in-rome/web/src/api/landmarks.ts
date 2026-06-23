import { api } from './client';
import { Landmark } from '../types';

export const landmarksApi = {
  async list(): Promise<Landmark[]> {
    const { data } = await api.get<Landmark[]>('/landmarks');
    return data;
  },

  async get(id: number): Promise<Landmark> {
    const { data } = await api.get<Landmark>(`/landmarks/${id}`);
    return data;
  },
};
