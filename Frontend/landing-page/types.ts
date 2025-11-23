export interface Review {
  id: string;
  customerName: string;
  rating: number; // 1-5 stars
  comment: string;
}

export type Page = 'home' | 'login' | 'about' | 'services';