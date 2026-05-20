# Web Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the web companion — a desktop browser interface where photographers sign in, select a booking in `editing` status, upload edited photos to Cloud Storage with per-file progress, view an uploaded-photos grid, and send photos to proofing.

**Architecture:** The web companion lives at `/upload` in the existing Vite + React web app. An auth hook wraps Firebase Auth with email/password sign-in and persistence toggle. A booking-selector component queries editing-status bookings via Firestore real-time listener. The upload screen uses a drag-and-drop zone with `input[type=file]`, uploads to `uploads/{photographerId}/{bookingId}/{filename}` in Cloud Storage with 3-concurrent-upload throttling and per-file progress tracking, then writes a photo document to `bookings/{id}/photos` subcollection. A real-time listener on the photos subcollection drives the grid display and processing status. Photo processing (thumbnails/watermarks) is handled by spec 15's Cloud Function — this plan builds the upload + display UI.

**Tech Stack:** React 19, React Router, Firebase Auth, Firestore, Cloud Storage, Tailwind CSS, Lucide React

---

### Task 1: Auth hook and sign-in screen

**Files:**
- Create: `apps/web/src/hooks/useAuth.ts`
- Create: `apps/web/src/components/SignIn.tsx`
- Modify: `apps/web/src/pages/WebCompanion.tsx`

**Context files to read:**
- `apps/web/src/lib/firebase.ts` — exports `auth`, `db`, `storage`

- [ ] **Step 1: Create `apps/web/src/hooks/useAuth.ts`**

```typescript
import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  browserSessionPersistence,
  browserLocalPersistence,
  setPersistence,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string, keepSignedIn: boolean) {
    await setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence);
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logOut() {
    return signOut(auth);
  }

  return { user, loading, signIn, logOut };
}
```

- [ ] **Step 2: Create `apps/web/src/components/SignIn.tsx`**

```typescript
import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { useAuth } from "../hooks/useAuth";

export function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password, keepSignedIn);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
          setError("Invalid email or password");
        } else if (err.code === "auth/too-many-requests") {
          setError("Too many attempts. Please try again later.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Sign-in failed");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen companion-theme flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary">ShotReady Upload</h1>
          <p className="text-text-secondary mt-1">Sign in to upload photos</p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-error text-sm">
            {error}
          </div>
        )}

        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
          />
        </div>
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(e) => setKeepSignedIn(e.target.checked)}
            className="accent-accent"
          />
          Keep me signed in
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Wire into WebCompanion page**

Replace `apps/web/src/pages/WebCompanion.tsx` with:

```typescript
import { useAuth } from "../hooks/useAuth";
import { SignIn } from "../components/SignIn";

export default function WebCompanion() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen companion-theme flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  if (!user) return <SignIn />;

  return (
    <div className="min-h-screen companion-theme">
      <div className="text-center py-12">
        <p className="text-text-primary">Signed in as {user.email}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useAuth.ts apps/web/src/components/SignIn.tsx apps/web/src/pages/WebCompanion.tsx
git commit -m "feat: add web companion auth with sign-in form"
```

---

### Task 2: Booking selector

**Files:**
- Create: `apps/web/src/hooks/useEditingBookings.ts`
- Create: `apps/web/src/components/BookingSelector.tsx`
- Modify: `apps/web/src/pages/WebCompanion.tsx`

**Context files to read:**
- `packages/shared/src/types/booking.ts` — `Booking` shape
- `apps/web/src/hooks/useAuth.ts` (Task 1) — provides `user.uid`

- [ ] **Step 1: Create `apps/web/src/hooks/useEditingBookings.ts`**

```typescript
import { useState, useEffect } from "react";
import {
  collection, query, where, orderBy, onSnapshot, getCountFromServer,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Booking } from "@shotready/shared";

export interface BookingWithId extends Booking {
  id: string;
  photoCount: number;
}

export function useEditingBookings(uid: string | undefined) {
  const [bookings, setBookings] = useState<BookingWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "bookings"),
      where("photographerId", "==", uid),
      where("status", "==", "editing"),
      orderBy("schedule.confirmedDate", "desc"),
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const results: BookingWithId[] = [];
      for (const doc of snapshot.docs) {
        const photosRef = collection(db, "bookings", doc.id, "photos");
        const countSnap = await getCountFromServer(photosRef);
        results.push({
          id: doc.id,
          ...(doc.data() as Booking),
          photoCount: countSnap.data().count,
        });
      }
      setBookings(results);
      setLoading(false);
    });

    return unsubscribe;
  }, [uid]);

  return { bookings, loading };
}
```

- [ ] **Step 2: Create `apps/web/src/components/BookingSelector.tsx`**

```typescript
import type { BookingWithId } from "../hooks/useEditingBookings";
import { Camera, ImageIcon } from "lucide-react";

interface BookingSelectorProps {
  bookings: BookingWithId[];
  loading: boolean;
  onSelect: (bookingId: string) => void;
}

function formatDate(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "";
  const date = (ts as { toDate: () => Date }).toDate();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BookingSelector({ bookings, loading, onSelect }: BookingSelectorProps) {
  if (loading) {
    return <div className="text-text-muted text-center py-12">Loading bookings...</div>;
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16">
        <Camera className="mx-auto text-text-muted mb-4" size={48} strokeWidth={1.25} />
        <p className="text-text-secondary">No bookings are ready for uploads.</p>
        <p className="text-text-muted text-sm mt-2">
          Complete a shoot in the mobile app to start editing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-text-secondary text-sm">Select a booking to upload photos:</p>
      {bookings.map((b) => (
        <button
          key={b.id}
          onClick={() => onSelect(b.id)}
          className="w-full text-left bg-surface hover:bg-surface-raised border border-border rounded-lg p-4 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-text-primary font-medium">
              {b.property.address.split(",")[0]}
            </span>
            <span className="text-text-muted text-sm">
              {formatDate(b.schedule.confirmedDate)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-text-secondary text-sm">
              {b.agent.name} · {b.package.name}
            </span>
            <span className="text-text-muted text-sm flex items-center gap-1">
              <ImageIcon size={14} />
              {b.photoCount} uploaded
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update WebCompanion to show booking selector**

Replace the signed-in branch in `apps/web/src/pages/WebCompanion.tsx`:

```typescript
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useEditingBookings } from "../hooks/useEditingBookings";
import { SignIn } from "../components/SignIn";
import { BookingSelector } from "../components/BookingSelector";
import { LogOut } from "lucide-react";

export default function WebCompanion() {
  const { user, loading, logOut } = useAuth();
  const { bookings, loading: bookingsLoading } = useEditingBookings(user?.uid);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen companion-theme flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  if (!user) return <SignIn />;

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  return (
    <div className="min-h-screen companion-theme">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-primary">ShotReady Upload</h1>
        <div className="flex items-center gap-4">
          <span className="text-text-secondary text-sm">{user.email}</span>
          <button onClick={logOut} className="text-text-muted hover:text-text-primary transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {selectedBooking ? (
          <div>
            <button
              onClick={() => setSelectedBookingId(null)}
              className="text-accent text-sm mb-6 hover:underline"
            >
              &larr; Back to bookings
            </button>
            <p className="text-text-primary">Upload screen for {selectedBooking.property.address.split(",")[0]} (Task 3)</p>
          </div>
        ) : (
          <BookingSelector
            bookings={bookings}
            loading={bookingsLoading}
            onSelect={setSelectedBookingId}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useEditingBookings.ts apps/web/src/components/BookingSelector.tsx apps/web/src/pages/WebCompanion.tsx
git commit -m "feat: add booking selector for web companion"
```

---

### Task 3: Upload screen with drop zone and file upload

**Files:**
- Create: `apps/web/src/components/DropZone.tsx`
- Create: `apps/web/src/hooks/usePhotoUpload.ts`
- Create: `apps/web/src/components/UploadScreen.tsx`
- Modify: `apps/web/src/pages/WebCompanion.tsx`

**Context files to read:**
- `apps/web/src/lib/firebase.ts` — exports `storage`, `db`
- `packages/shared/src/types/photo.ts` — `Photo` type shape

- [ ] **Step 1: Create `apps/web/src/components/DropZone.tsx`**

```typescript
import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { Upload } from "lucide-react";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB
const MAX_BATCH = 100;

function validateFiles(files: File[]): { valid: File[]; errors: string[] } {
  const errors: string[] = [];
  if (files.length > MAX_BATCH) {
    errors.push(`Maximum ${MAX_BATCH} files at a time`);
    return { valid: [], errors };
  }
  const valid: File[] = [];
  for (const f of files) {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".jpg") && !ext.endsWith(".jpeg")) {
      errors.push(`${f.name}: Only JPEG files are supported`);
      continue;
    }
    if (f.size > MAX_FILE_SIZE) {
      errors.push(`${f.name} exceeds the 30 MB limit`);
      continue;
    }
    valid.push(f);
  }
  return { valid, errors };
}

export function DropZone({ onFiles, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const { valid, errors: errs } = validateFiles(Array.from(fileList));
    setErrors(errs);
    if (valid.length > 0) onFiles(valid);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragging ? "border-accent bg-accent/5" : "border-border hover:border-text-muted"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <Upload className="mx-auto text-text-muted mb-3" size={32} />
        <p className="text-text-primary">Drag photos here or click to browse</p>
        <p className="text-text-muted text-sm mt-1">JPEG files, max 30 MB each</p>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg"
          multiple
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {errors.length > 0 && (
        <div className="mt-3 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-error text-sm">{err}</p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/src/hooks/usePhotoUpload.ts`**

```typescript
import { useState, useCallback, useRef } from "react";
import { ref, uploadBytesResumable, type UploadTask } from "firebase/storage";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { storage, db } from "../lib/firebase";

export type UploadStatus = "queued" | "uploading" | "processing" | "ready" | "error";

export interface UploadItem {
  file: File;
  status: UploadStatus;
  progress: number; // 0-100
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
          // Upload complete — write photo document
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
      // Check for duplicates
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
```

- [ ] **Step 3: Create `apps/web/src/components/UploadScreen.tsx`**

```typescript
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

  // Real-time listener on photos subcollection
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

  // Active uploads (in-progress items)
  const activeUploads = uploads.filter((u) => u.status !== "ready");

  return (
    <div>
      {/* Sub-header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-accent text-sm hover:underline flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-right">
          <p className="text-text-primary font-medium">{address}</p>
          <p className="text-text-secondary text-sm">{agentName}</p>
        </div>
      </div>

      {/* Drop zone */}
      <DropZone onFiles={addFiles} disabled={isUploading} />

      {/* Active uploads */}
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

      {/* Photo grid */}
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
                  {/* Delete button on hover */}
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

      {/* Send to proofing */}
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
```

- [ ] **Step 4: Update WebCompanion to render UploadScreen**

In `apps/web/src/pages/WebCompanion.tsx`, replace the placeholder for the selected booking branch:

```typescript
import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { useEditingBookings } from "../hooks/useEditingBookings";
import { SignIn } from "../components/SignIn";
import { BookingSelector } from "../components/BookingSelector";
import { UploadScreen } from "../components/UploadScreen";
import { LogOut } from "lucide-react";

export default function WebCompanion() {
  const { user, loading, logOut } = useAuth();
  const { bookings, loading: bookingsLoading } = useEditingBookings(user?.uid);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen companion-theme flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  if (!user) return <SignIn />;

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  async function handleSendToProofing() {
    if (!selectedBookingId) return;
    await updateDoc(doc(db, "bookings", selectedBookingId), {
      status: "proofing",
      "proofing.sentAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSelectedBookingId(null);
  }

  return (
    <div className="min-h-screen companion-theme">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-primary">ShotReady Upload</h1>
        <div className="flex items-center gap-4">
          <span className="text-text-secondary text-sm">{user.email}</span>
          <button onClick={logOut} className="text-text-muted hover:text-text-primary transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {selectedBooking ? (
          <UploadScreen
            bookingId={selectedBooking.id}
            photographerId={user.uid}
            address={selectedBooking.property.address.split(",")[0]}
            agentName={selectedBooking.agent.name}
            onBack={() => setSelectedBookingId(null)}
            onSendToProofing={handleSendToProofing}
          />
        ) : (
          <BookingSelector
            bookings={bookings}
            loading={bookingsLoading}
            onSelect={setSelectedBookingId}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/DropZone.tsx apps/web/src/hooks/usePhotoUpload.ts apps/web/src/components/UploadScreen.tsx apps/web/src/pages/WebCompanion.tsx
git commit -m "feat: add upload screen with drag-drop, progress tracking, and photo grid"
```

---

### Task 4: Typecheck all packages

- [ ] **Step 1: Run typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Fix any errors.

- [ ] **Step 2: Final commit (if fixes needed)**

```bash
git add -A && git commit -m "fix: resolve typecheck errors in web companion"
```
