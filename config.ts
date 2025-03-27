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

export default config;

// Helper function to get auth header
export const getAuthHeader = () => {
  if (!config.api.auth.token) {
    throw new Error('API token is not configured');
  }
  return {
    [config.api.auth.headerName]: `${config.api.auth.prefix} ${config.api.auth.token}`
  };
};

// Validate required environment variables
if (!config.api.baseUrl) {
  throw new Error('NEXT_PUBLIC_API_URL is not configured');
}
