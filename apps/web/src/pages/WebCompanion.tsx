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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    if (!selectedBookingId || !selectedBooking) return;
    const agentName = selectedBooking.agent.name;
    await updateDoc(doc(db, "bookings", selectedBookingId), {
      status: "proofing",
      "proofing.sentAt": serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSelectedBookingId(null);
    setSuccessMessage(`Photos sent to ${agentName}! You'll be notified when they finish selecting.`);
    setTimeout(() => setSuccessMessage(null), 6000);
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
        {successMessage && (
          <div className="mb-6 bg-success/10 border border-success/30 rounded-lg px-4 py-3 text-success text-sm">
            {successMessage}
          </div>
        )}
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
