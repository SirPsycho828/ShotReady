import type { Timestamp } from "./common";

export type ProcessingStatus = "uploading" | "processing" | "ready" | "error";

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
