
(function() {
  const THEME_KEY = 'crazy-eights-theme';
  
  // Get saved theme or detect system preference
  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }
  
  // Apply theme to document
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    
    // Update toggle button if exists
    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }
  
  // Toggle between themes
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }
  
  // Create toggle button
  function createToggleButton() {
    if (document.querySelector('.theme-toggle')) return;
    
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.innerHTML = `
      <span class="icon-sun">☀️</span>
      <span class="icon-moon">🌙</span>
    `;
    btn.addEventListener('click', toggleTheme);
    document.body.appendChild(btn);
  }
  
  // Initialize
  function init() {
    const theme = getPreferredTheme();
    applyTheme(theme);
    createToggleButton();
    
    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(THEME_KEY)) {
          applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }
  
  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Expose toggle function globally
  window.toggleTheme = toggleTheme;
})();

