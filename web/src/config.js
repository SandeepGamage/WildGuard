/** Build-time configuration (Vite inlines VITE_* values). */
export const config = {
  apiUrl: (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, ''),
};
