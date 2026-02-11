var fs = require('fs');
var base = 'C:/Users/bassa/Projects/terango-final/admin-dashboard';

// 1. Update vite.config.js with Tailwind plugin
fs.writeFileSync(base + '/vite.config.js', 
`import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
`, 'utf8');

// 2. Replace src/index.css with Tailwind import
fs.writeFileSync(base + '/src/index.css', 
`@import "tailwindcss";
`, 'utf8');

// 3. Clean up App.css
fs.writeFileSync(base + '/src/App.css', '', 'utf8');

console.log('Tailwind configured!');
