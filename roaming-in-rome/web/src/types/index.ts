// Shared API types, mirroring the NestJS server's response shapes.

export interface User {
  id: number;
  username: string;
  role: string;
}

export interface LoginResult {
  token: string;
  user: User;
}

export interface Landmark {
  id: number;
  name: string;
  summary: string;
  description: string;
  img: string;
  mapLink: string | null;
  addressId: number;
  images: string[];
}

export interface Itinerary {
  id: number;
  name: string;
  userId: number;
}

export interface Credentials {
  username: string;
  password: string;
}
