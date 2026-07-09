import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // ensures Vite listens on all interfaces
    allowedHosts: [
      "racoon-deranged-overturn.ngrok-free.dev", // ngrok
      "https://deli-assistant-backend.onrender.com",
    ],
  },
});
