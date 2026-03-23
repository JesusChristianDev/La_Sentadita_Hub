export type IncidentCategory =
  | 'operational'
  | 'maintenance'
  | 'hygiene'
  | 'customer'
  | 'security'
  | 'stock'
  | 'technology'
  | 'personnel';

export type IncidentSensitivity = 'normal' | 'restricted';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical' | null;

export type IncidentStatus = 'reported' | 'in_review' | 'resolved' | 'closed';

export type IncidentRecord = {
  category: IncidentCategory;
  created_at: string;
  description: string;
  incident_id: string;
  primary_owner: string | null;
  reported_by: string;
  restaurant_id: string;
  sensitivity: IncidentSensitivity;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  updated_at: string;
  zone_id: string | null;
};

export type CreateIncidentInput = {
  category: IncidentCategory;
  description: string;
  restaurantId: string;
  sensitivity?: IncidentSensitivity;
  severity?: IncidentSeverity;
  title: string;
  zoneId?: string | null;
};
