const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002',
    endpoints: {
      imageScan: '/api/image-scan',
      foodScan: '/api/food-scan',
      analyzeIngredients: '/api/analyze-ingredients'
    }
  }
} as const;

export default config;
