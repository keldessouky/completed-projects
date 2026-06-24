/**
 * API response shape for a landmark. The gallery image filenames are flattened
 * into a string array (`images`) so the client doesn't deal with the join rows.
 */
export interface LandmarkResponse {
  id: number;
  name: string;
  summary: string;
  description: string;
  img: string;
  mapLink: string | null;
  addressId: number;
  images: string[];
}
