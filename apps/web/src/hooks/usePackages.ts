import { useState, useEffect } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { ServicePackage } from "@shotready/shared";

export interface PackageWithId extends ServicePackage {
  id: string;
}

export function usePackages(uid: string | undefined) {
  const [packages, setPackages] = useState<PackageWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPackages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "packages"),
      where("photographerId", "==", uid),
      orderBy("sortOrder", "asc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPackages(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PackageWithId),
        );
        setLoading(false);
      },
      () => {
        setPackages([]);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [uid]);

  async function addPackage(uid: string, pkg: Omit<ServicePackage, "photographerId" | "createdAt" | "updatedAt">) {
    await addDoc(collection(db, "packages"), {
      ...pkg,
      photographerId: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function updatePackage(id: string, updates: Partial<ServicePackage>) {
    await updateDoc(doc(db, "packages", id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  async function removePackage(id: string) {
    await deleteDoc(doc(db, "packages", id));
  }

  return { packages, loading, addPackage, updatePackage, removePackage };
}
