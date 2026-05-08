import type { Timestamp } from "./common";

export interface ServicePackage {
  photographerId: string;
  name: string;
  description: string;
  price: number; // cents
  deliverables: string[];
  shotListTemplate: string[];
  estimatedDuration: number; // minutes
  isActive: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
