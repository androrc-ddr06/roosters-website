/** Tailwind build config — regenerate assets/styles.css after changing HTML classes:
 *  npx -y tailwindcss@3 -c tailwind.config.js -i tailwind.input.css -o assets/styles.css --minify
 */
module.exports = {
  content: ['./*.html'],
  safelist: ['hidden'],
  theme: { extend: {} },
  plugins: [],
};
