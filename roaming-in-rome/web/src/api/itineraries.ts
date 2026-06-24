import { api } from './client';
import { Itinerary, Landmark } from '../types';

export const itinerariesApi = {
  async listMine(): Promise<Itinerary[]> {
    const { data } = await api.get<Itinerary[]>('/itineraries');
    return data;
  },

  async create(name: string): Promise<Itinerary> {
    const { data } = await api.post<Itinerary>('/itineraries', { name });
    return data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/itineraries/${id}`);
  },

  async getLandmarks(id: number): Promise<Landmark[]> {
    const { data } = await api.get<Landmark[]>(`/itineraries/${id}/landmarks`);
    return data;
  },

  async addLandmark(itineraryId: number, landmarkId: number): Promise<void> {
    await api.post(`/itineraries/${itineraryId}/landmarks`, { landmarkId });
  },

  async removeLandmark(itineraryId: number, landmarkId: number): Promise<void> {
    await api.delete(`/itineraries/${itineraryId}/landmarks/${landmarkId}`);
  },
};
