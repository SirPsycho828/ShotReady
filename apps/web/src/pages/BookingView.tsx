import { useParams } from "react-router-dom";

export default function BookingView() {
  const { token } = useParams<{ token: string }>();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-primary">Your Booking</h1>
        <p className="text-text-secondary mt-2">Loading booking details...</p>
      </div>
    </div>
  );
}
