/** Hand-maintained row types for the tables/views the app reads. */

export interface AccountRow {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  company_id: string | null;
  job_title: string;
  linkedin_url: string;
  country: string;
  sector_id: number | null;
  status: string;
  role: "member" | "moderator" | "admin";
  verification_methods: string[];
  created_at: string;
}

export interface ProfileRow {
  user_id: string;
  display_name: string;
  company_name: string;
  title: string;
  country: string;
  sector_id: number | null;
  years_experience: number | null;
  specialties: string[];
  bio: string | null;
  is_public: boolean;
}

export interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  sector_id: number | null;
  hq_country: string | null;
  hq_city: string | null;
  offices: string[];
  website: string | null;
  description: string | null;
  is_claimed: boolean;
}

export interface SoftwareRow {
  id: string;
  slug: string;
  name: string;
  vendor_company_id: string | null;
  vendor_name: string | null;
  category_id: number | null;
  description: string | null;
  website: string | null;
  pricing_model: string | null;
}

export interface ConferenceRow {
  id: string;
  slug: string;
  name: string;
  organizer_company_id: string | null;
  organizer_name: string | null;
  location: string | null;
  sector_id: number | null;
  website: string | null;
  typical_cost_estimate: string | null;
  attendee_categories: string[];
}

export interface ReviewRow {
  id: string;
  author_id: string;
  entity_type: "company" | "software" | "conference";
  company_id: string | null;
  software_id: string | null;
  conference_id: string | null;
  relationship: string;
  title: string;
  body: string;
  overall_rating: number | null;
  weight: number;
  answers: Record<string, unknown>;
  attended_year: number | null;
  would_attend_again: boolean | null;
  status: string;
  published_at: string | null;
  created_at: string;
}

export interface CategoryScore {
  category: string;
  weighted_score: number;
  review_count: number;
}

export interface OverallScore {
  overall_score: number | null;
  rating_count: number;
  review_count: number;
  would_attend_again_pct: number | null;
}
