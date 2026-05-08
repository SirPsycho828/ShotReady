import { Routes, Route } from "react-router-dom";
import BookingForm from "./pages/BookingForm";
import BookingView from "./pages/BookingView";
import WebCompanion from "./pages/WebCompanion";

export default function App() {
  return (
    <Routes>
      <Route path="/book/:slug" element={<BookingForm />} />
      <Route path="/b/:token" element={<BookingView />} />
      <Route path="/upload" element={<WebCompanion />} />
    </Routes>
  );
}
