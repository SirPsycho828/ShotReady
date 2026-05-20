import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { useEditingBookings } from "../hooks/useEditingBookings";
import { AuthLayout } from "../components/AuthLayout";
import { BookingSelector } from "../components/BookingSelector";
import { UploadScreen } from "../components/UploadScreen";

export default function WebCompanion() {
  const { user } = useAuth();
  const { bookings, loading: bookingsLoading } = useEditingBookings(user?.uid);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedBooking = bookings.find((b) => b.id === selectedBookingId);

  async function handleSendToProofing() {
    if (!selectedBookingId || !selectedBooking) return;
    const agentName = selectedBooking.agent.name;
    await updateDoc(doc(db, "bookings", selectedBookingId), {
      status: "proofing",
      "proofing.sentAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSelectedBookingId(null);
    setSuccessMessage(
      `Photos sent to ${agentName}! You'll be notified when they finish selecting.`,
    );
    setTimeout(() => setSuccessMessage(null), 6000);
  }

  return (
    <AuthLayout activePage="upload">
      <main className="max-w-3xl mx-auto px-6 py-8">
        {successMessage && (
          <div className="mb-6 bg-success/10 border border-success/30 rounded-md px-4 py-3 text-success text-sm animate-slide-in">
            {successMessage}
          </div>
        )}
        {user && (
          selectedBooking ? (
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
          )
        )}
      </main>
    </AuthLayout>
  );
}
