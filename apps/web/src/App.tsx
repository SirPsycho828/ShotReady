import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import BookingForm from "./pages/BookingForm";
import BookingView from "./pages/BookingView";
import WebCompanion from "./pages/WebCompanion";
import SettingsPage from "./pages/SettingsPage";
import { useAuth } from "./hooks/useAuth";

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/book/:slug" element={<BookingForm />} />
      <Route path="/b/:token" element={<BookingView />} />
      <Route path="/upload" element={<WebCompanion />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
