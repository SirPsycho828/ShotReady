import { useState, useEffect, useCallback } from "react";
import firestore from "@react-native-firebase/firestore";

export interface InvoiceLineItem {
  description: string;
  amount: number; // cents
}

export interface InvoiceData {
  id: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  total: number;
  status: string;
}

export function useInvoice(invoiceId: string | null) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }
    const unsub = firestore()
      .collection("invoices")
      .doc(invoiceId)
      .onSnapshot(
        (snap) => {
          if (snap.exists()) {
            const data = snap.data()!;
            setInvoice({
              id: snap.id,
              lineItems: data.lineItems ?? [],
              subtotal: data.subtotal ?? 0,
              total: data.total ?? 0,
              status: data.status ?? "draft",
            });
          }
          setLoading(false);
        },
        () => setLoading(false),
      );
    return unsub;
  }, [invoiceId]);

  const updateLineItems = useCallback(
    async (lineItems: InvoiceLineItem[]) => {
      if (!invoiceId) return;
      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
      await firestore().collection("invoices").doc(invoiceId).update({
        lineItems,
        subtotal,
        total: subtotal,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    },
    [invoiceId],
  );

  return { invoice, loading, updateLineItems };
}
