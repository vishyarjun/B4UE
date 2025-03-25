export interface HealthMetric {
  referenceInterval: string | null;
  result: number | null;
  units: string | null;
}

export interface HealthData {
  dietaryRequirement: string;
  allergies: string[];
  healthConditions: string[];
  healthReports: File[];
  additionalHealthData: { [key: string]: HealthMetric };
}
