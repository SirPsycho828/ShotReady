import type { Timestamp } from "./common";
import type { PROCESSING_STATUSES } from "../constants/booking-status";

export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export interface Photo {
  filename: string;
  storagePath: string;
  watermarkedPath: string | null;
  thumbnailPath: string | null;
  width: number;
  height: number;
  fileSize: number; // bytes
  sortOrder: number;
  isSelected: boolean;
  processingStatus: ProcessingStatus;
  uploadedAt: Timestamp;
  processedAt: Timestamp | null;
}
