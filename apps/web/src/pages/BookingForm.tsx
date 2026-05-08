import { useParams } from "react-router-dom";

export default function BookingForm() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-primary">Book a Shoot</h1>
        <p className="text-text-secondary mt-2">Photographer: {slug}</p>
      </div>
    </div>
  );
}
