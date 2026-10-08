import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Relative asset paths, so the same build works at a custom domain root
// (e.g. kdoc.yourschool.ca) or under a GitHub Pages subpath
// (e.g. username.github.io/KindieObs/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
