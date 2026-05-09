import { useState, useCallback, useRef } from "react";
import { ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { storage, db } from "../lib/firebase";

export type UploadStatus = "queued" | "uploading" | "processing" | "ready" | "error";

export interface UploadItem {
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
}

const MAX_CONCURRENT = 3;

export function usePhotoUpload(photographerId: string, bookingId: string) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const activeRef = useRef(0);
  const queueRef = useRef<UploadItem[]>([]);

  const updateItem = useCallback((fileName: string, update: Partial<UploadItem>) => {
    setUploads((prev) =>
      prev.map((item) => (item.file.name === fileName ? { ...item, ...update } : item)),
    );
  }, []);

  const uploadFile = useCallback(
    async (item: UploadItem) => {
      activeRef.current++;
      updateItem(item.file.name, { status: "uploading", progress: 0 });

      const storagePath = `uploads/${photographerId}/${bookingId}/${item.file.name}`;
      const storageRef = ref(storage, storagePath);
      const task: UploadTask = uploadBytesResumable(storageRef, item.file);

      task.on(
        "state_changed",
        (snap) => {
          const progress = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          updateItem(item.file.name, { progress });
        },
        (err) => {
          updateItem(item.file.name, { status: "error", error: err.message });
          activeRef.current--;
          processQueue();
        },
        async () => {
          updateItem(item.file.name, { status: "processing", progress: 100 });
          try {
            const photoDoc = doc(collection(db, "bookings", bookingId, "photos"));
            await setDoc(photoDoc, {
              filename: item.file.name,
              storagePath,
              watermarkedPath: null,
              thumbnailPath: null,
              width: 0,
              height: 0,
              fileSize: item.file.size,
              sortOrder: 0,
              isSelected: false,
              processingStatus: "processing",
              uploadedAt: serverTimestamp(),
              processedAt: null,
            });
            updateItem(item.file.name, { status: "processing" });
          } catch {
            updateItem(item.file.name, { status: "error", error: "Failed to save photo record" });
          }
          activeRef.current--;
          processQueue();
        },
      );
    },
    [photographerId, bookingId, updateItem],
  );

  const processQueue = useCallback(() => {
    while (activeRef.current < MAX_CONCURRENT && queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      uploadFile(next);
    }
  }, [uploadFile]);

  const addFiles = useCallback(
    async (files: File[]) => {
      const photosRef = collection(db, "bookings", bookingId, "photos");
      const newItems: UploadItem[] = [];

      for (const file of files) {
        const dupQuery = query(photosRef, where("filename", "==", file.name));
        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty) {
          const replace = window.confirm(`${file.name} already uploaded. Replace?`);
          if (!replace) continue;
        }
        newItems.push({ file, status: "queued", progress: 0 });
      }

      if (newItems.length === 0) return;
      setUploads((prev) => [...prev, ...newItems]);
      queueRef.current.push(...newItems);
      processQueue();
    },
    [bookingId, processQueue],
  );

  const retryFile = useCallback(
    (fileName: string) => {
      setUploads((prev) => {
        const item = prev.find((u) => u.file.name === fileName);
        if (item) {
          queueRef.current.push({ ...item, status: "queued", progress: 0, error: undefined });
          processQueue();
        }
        return prev.map((u) =>
          u.file.name === fileName ? { ...u, status: "queued", progress: 0, error: undefined } : u,
        );
      });
    },
    [processQueue],
  );

  const isUploading = uploads.some((u) => u.status === "uploading" || u.status === "queued");

  return { uploads, addFiles, retryFile, isUploading };
}
