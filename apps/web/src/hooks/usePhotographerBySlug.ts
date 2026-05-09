import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Photographer, ServicePackage } from "@shotready/shared";

export interface PackageWithId extends ServicePackage {
  id: string;
}

export interface PhotographerData {
  id: string;
  photographer: Photographer;
  packages: PackageWithId[];
}

export function usePhotographerBySlug(slug: string | undefined) {
  const [data, setData] = useState<PhotographerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      setError("Invalid booking link");
      return;
    }

    async function load() {
      try {
        const photoQuery = query(
          collection(db, "photographers"),
          where("bookingSlug", "==", slug),
        );
        const photoSnap = await getDocs(photoQuery);

        if (photoSnap.empty) {
          setError("This booking link isn't valid. Please check with your photographer.");
          setIsLoading(false);
          return;
        }

        const photoDoc = photoSnap.docs[0];
        const photographer = photoDoc.data() as Photographer;

        const pkgQuery = query(
          collection(db, "packages"),
          where("photographerId", "==", photoDoc.id),
          where("isActive", "==", true),
          orderBy("sortOrder"),
        );
        const pkgSnap = await getDocs(pkgQuery);
        const packages = pkgSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PackageWithId[];

        setData({ id: photoDoc.id, photographer, packages });
      } catch {
        setError("Failed to load booking page. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [slug]);

  return { data, isLoading, error };
}
