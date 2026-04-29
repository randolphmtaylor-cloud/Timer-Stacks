import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Resolve the Tailwind config using an absolute path so it is found correctly
// regardless of the process CWD (e.g. when Vite is invoked from the monorepo root).
const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: resolve(__dirname, 'tailwind.config.js') },
    autoprefixer: {},
  },
};
