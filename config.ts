const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    auth: {
      token: process.env.API_TOKEN,
      headerName: 'Authorization',
      prefix: 'Bearer'
    },
    endpoints: {
      imageScan: '/api/image-scan',
      foodScan: '/api/food-scan',
      analyzeIngredients: '/api/analyze-ingredients'
    }
  }
} as const;

// Debug logging for environment variables
console.log('Environment Variables Status:', {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ? 'Set' : 'Not Set',
  API_TOKEN: process.env.API_TOKEN ? 'Set' : 'Not Set',
  tokenFromConfig: config.api.auth.token ? 'Set' : 'Not Set'
});

export default config;

// Helper function to get auth header
export const getAuthHeader = () => {
  if (!config.api.auth.token) {
    console.error('Auth Token Debug:', {
      envToken: process.env.API_TOKEN,
      configToken: config.api.auth.token,
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('TOKEN') || key.includes('API'))
    });
    throw new Error('API token is not configured. Please check environment variables.');
  }
  return {
    [config.api.auth.headerName]: `${config.api.auth.prefix} ${config.api.auth.token}`
  };
};

// Validate required environment variables
if (!config.api.baseUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is not configured');
}
