import { useState, useEffect } from "react";
import {
  collection, query, orderBy, onSnapshot, deleteDoc, doc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { usePhotoUpload, type UploadItem } from "../hooks/usePhotoUpload";
import { DropZone } from "./DropZone";
import type { Photo } from "@shotready/shared";
import {
  ArrowLeft, CheckCircle, Loader2, AlertCircle, RotateCw, Trash2, Send,
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
  if (status === "ready") return <CheckCircle size={16} className="text-success" />;
  if (status === "processing") return <Loader2 size={16} className="text-accent animate-spin" />;
  if (status === "error") return <AlertCircle size={16} className="text-error" />;
  return null;
}

function UploadProgress({ item, onRetry }: { item: UploadItem; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-surface rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-text-primary text-sm truncate">{item.file.name}</p>
        {item.status === "uploading" && (
          <div className="mt-1 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
        {item.status === "queued" && <p className="text-text-muted text-xs">Waiting...</p>}
        {item.status === "processing" && <p className="text-accent text-xs">Processing...</p>}
        {item.status === "error" && (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-error text-xs">{item.error}</p>
            <button onClick={onRetry} className="text-accent text-xs hover:underline flex items-center gap-1">
              <RotateCw size={12} /> Retry
            </button>
          </div>
        )}
      </div>
      {item.status === "uploading" && (
        <span className="text-accent text-sm font-medium">{item.progress}%</span>
      )}
    </div>
  );
}

export function UploadScreen({
  bookingId, photographerId, address, agentName, onBack, onSendToProofing,
}: UploadScreenProps) {
  const { uploads, addFiles, retryFile, isUploading } = usePhotoUpload(photographerId, bookingId);
  const [photos, setPhotos] = useState<PhotoWithId[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "bookings", bookingId, "photos"),
      orderBy("uploadedAt", "asc"),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Photo) })));
      setPhotosLoading(false);
    });
    return unsubscribe;
  }, [bookingId]);

  async function handleDelete(photo: PhotoWithId) {
    if (!window.confirm(`Delete ${photo.filename}?`)) return;
    await deleteDoc(doc(db, "bookings", bookingId, "photos", photo.id));
    try { await deleteObject(ref(storage, photo.storagePath)); } catch { /* already deleted */ }
    if (photo.watermarkedPath) {
      try { await deleteObject(ref(storage, photo.watermarkedPath)); } catch { /* ok */ }
    }
    if (photo.thumbnailPath) {
      try { await deleteObject(ref(storage, photo.thumbnailPath)); } catch { /* ok */ }
    }
  }

  const readyCount = photos.filter((p) => p.processingStatus === "ready").length;
  const processingCount = photos.filter((p) => p.processingStatus === "processing").length;
  const errorCount = photos.filter((p) => p.processingStatus === "error").length;
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

  // Dismiss upload items whose photos are now "ready" in Firestore
  const readyFilenames = new Set(
    photos.filter((p) => p.processingStatus === "ready").map((p) => p.filename),
  );
  const activeUploads = uploads.filter(
    (u) => u.status !== "ready" && !readyFilenames.has(u.file.name),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-accent text-sm hover:underline flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-right">
          <p className="text-text-primary font-medium">{address}</p>
          <p className="text-text-secondary text-sm">{agentName}</p>
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

      {photos.length > 0 && (
        <div className="mt-8">
          <h2 className="text-text-primary font-semibold mb-4">
            UPLOADED ({photos.length})
          </h2>
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="bg-surface rounded-lg overflow-hidden group relative">
                <div className="aspect-[4/3] bg-surface-raised flex items-center justify-center">
                  {photo.thumbnailPath ? (
                    <img
                      src={`https://firebasestorage.googleapis.com/v0/b/${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(photo.thumbnailPath)}?alt=media`}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Loader2 size={24} className="text-text-muted animate-spin" />
                  )}
                  <button
                    onClick={() => handleDelete(photo)}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} className="text-white" />
                  </button>
                </div>
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <StatusBadge status={photo.processingStatus} />
                  <span className="text-text-secondary text-xs truncate">{photo.filename}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        {processingCount > 0 && (
          <p className="text-text-muted text-sm mr-4 self-center">
            Waiting for {processingCount} photo{processingCount !== 1 ? "s" : ""} to finish processing...
          </p>
        )}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex items-center gap-2 px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          <Send size={18} />
          Send to Proofing
        </button>
      </div>
    </div>
  );
}
