import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { usePhotoUpload, type UploadItem } from "../hooks/usePhotoUpload";
import { DropZone } from "./DropZone";
import type { Photo } from "@shotready/shared";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  AlertCircle,
  RotateCw,
  Trash2,
  Send,
} from "lucide-react";

interface PhotoWithId extends Photo {
  id: string;
}

interface UploadScreenProps {
  bookingId: string;
  photographerId: string;
  address: string;
  agentName: string;
  onBack: () => void;
  onSendToProofing: () => void;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready")
    return <CheckCircle size={14} className="text-success" />;
  if (status === "processing")
    return <Loader2 size={14} className="text-accent animate-spin" />;
  if (status === "error")
    return <AlertCircle size={14} className="text-destructive" />;
  return null;
}

function UploadProgress({
  item,
  onRetry,
}: {
  item: UploadItem;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 bg-card border border-border rounded-md">
      <div className="flex-1 min-w-0">
        <p className="text-foreground text-sm truncate">{item.file.name}</p>
        {item.status === "uploading" && (
          <div className="mt-1.5 h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
        {item.status === "queued" && (
          <p className="text-muted-foreground text-xs mt-0.5">Waiting...</p>
        )}
        {item.status === "processing" && (
          <p className="text-accent text-xs mt-0.5">Processing...</p>
        )}
        {item.status === "error" && (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-destructive text-xs">{item.error}</p>
            <button
              onClick={onRetry}
              className="text-accent text-xs hover:underline flex items-center gap-1"
            >
              <RotateCw size={11} /> Retry
            </button>
          </div>
        )}
      </div>
      {item.status === "uploading" && (
        <span className="text-accent text-sm font-500 tabular-nums">
          {item.progress}%
        </span>
      )}
    </div>
  );
}

export function UploadScreen({
  bookingId,
  photographerId,
  address,
  agentName,
  onBack,
  onSendToProofing,
}: UploadScreenProps) {
  const { uploads, addFiles, retryFile, isUploading } = usePhotoUpload(
    photographerId,
    bookingId,
  );
  const [photos, setPhotos] = useState<PhotoWithId[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "bookings", bookingId, "photos"),
      orderBy("uploadedAt", "asc"),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setPhotos(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Photo) })),
      );
      setPhotosLoading(false);
    });
    return unsubscribe;
  }, [bookingId]);

  async function handleDelete(photo: PhotoWithId) {
    if (!window.confirm(`Delete ${photo.filename}?`)) return;
    await deleteDoc(doc(db, "bookings", bookingId, "photos", photo.id));
    try {
      await deleteObject(ref(storage, photo.storagePath));
    } catch {
      /* already deleted */
    }
    if (photo.watermarkedPath) {
      try {
        await deleteObject(ref(storage, photo.watermarkedPath));
      } catch {
        /* ok */
      }
    }
    if (photo.thumbnailPath) {
      try {
        await deleteObject(ref(storage, photo.thumbnailPath));
      } catch {
        /* ok */
      }
    }
  }

  const readyCount = photos.filter(
    (p) => p.processingStatus === "ready",
  ).length;
  const processingCount = photos.filter(
    (p) => p.processingStatus === "processing",
  ).length;
  const errorCount = photos.filter(
    (p) => p.processingStatus === "error",
  ).length;
  const canSend = readyCount > 0 && !isUploading && processingCount === 0;

  function handleSend() {
    if (errorCount > 0) {
      const proceed = window.confirm(
        `${errorCount} photo${errorCount !== 1 ? "s" : ""} failed to process. Send the ${readyCount} successful photo${readyCount !== 1 ? "s" : ""} anyway?`,
      );
      if (!proceed) return;
    }
    const confirmed = window.confirm(
      `Send ${readyCount} photo${readyCount !== 1 ? "s" : ""} to ${agentName} for review? They'll receive an email with a proofing link.`,
    );
    if (confirmed) onSendToProofing();
  }

  const readyFilenames = new Set(
    photos
      .filter((p) => p.processingStatus === "ready")
      .map((p) => p.filename),
  );
  const activeUploads = uploads.filter(
    (u) => u.status !== "ready" && !readyFilenames.has(u.file.name),
  );

  return (
    <div className="animate-slide-in">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="text-accent text-sm hover:underline flex items-center gap-1.5 font-500"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-right">
          <p className="text-foreground font-500">{address}</p>
          <p className="text-muted-foreground text-sm">{agentName}</p>
        </div>
      </div>

      <DropZone onFiles={addFiles} disabled={isUploading} />

      {activeUploads.length > 0 && (
        <div className="mt-6 space-y-2">
          {activeUploads.map((item) => (
            <UploadProgress
              key={item.file.name}
              item={item}
              onRetry={() => retryFile(item.file.name)}
            />
          ))}
        </div>
      )}

      {photosLoading && photos.length === 0 && (
        <div className="mt-8 grid grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-md animate-shimmer"
            />
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-body font-500 tracking-[0.1em] uppercase text-muted-foreground mb-4">
            Uploaded ({photos.length})
          </h2>
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="bg-card border border-border rounded-md overflow-hidden group relative"
              >
                <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                  {photo.thumbnailPath ? (
                    <img
                      src={`https://firebasestorage.googleapis.com/v0/b/${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(photo.thumbnailPath)}?alt=media`}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Loader2
                      size={20}
                      className="text-muted-foreground animate-spin"
                    />
                  )}
                  <button
                    onClick={() => handleDelete(photo)}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} className="text-white" />
                  </button>
                </div>
                <div className="px-2.5 py-2 flex items-center gap-1.5">
                  <StatusBadge status={photo.processingStatus} />
                  <span className="text-muted-foreground text-xs truncate">
                    {photo.filename}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-end gap-4">
        {processingCount > 0 && (
          <p className="text-muted-foreground text-sm">
            Waiting for {processingCount} photo
            {processingCount !== 1 ? "s" : ""} to finish processing...
          </p>
        )}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="btn-accent flex items-center gap-2 px-6 py-3 bg-accent text-accent-foreground font-body text-sm font-600 tracking-[0.05em] uppercase rounded-md disabled:opacity-50"
        >
          <Send size={16} />
          Send to Proofing
        </button>
      </div>
    </div>
  );
}
