// Centralized Configuration - SECURITY ENHANCED
// ⚠️ ONLY put PUBLIC configuration here that's safe to expose

const config = {
  // Backend URL - prioritize VITE_API_URL first, then VITE_BACKEND_URL, then fallback
  BACKEND_URL: import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'https://quiznest-full-stack-ai-powered-quiz.onrender.com',

  // App configuration
  APP_NAME: 'QuizNest',
  APP_VERSION: '1.0.0',

  // Public API timeouts and limits
  API_TIMEOUT: 30000,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB

  // Feature flags (public)
  FEATURES: {
    ANALYTICS_ENABLED: true,
    THEMES_ENABLED: true,
    PREMIUM_ENABLED: true
  }
};

// Log the backend URL in development to help debugging
if (import.meta.env.DEV) {
  console.log('🔧 Config loaded - BACKEND_URL:', config.BACKEND_URL);
}

// ⚠️ MOVED TO BACKEND: Contact service credentials should be handled server-side
// Don't expose EmailJS credentials in frontend!

export default config;
