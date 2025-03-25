import { useState, useRef, useEffect } from 'react';
import config from '../../config';

interface Ingredient {
  name: string;
  amount: string | null;
  unit: string | null;
}

interface Impact {
  metric: string;
  effect: string;
  severity: 'positive' | 'negative' | 'neutral';
}

interface AnalyzedIngredient {
  name: string;
  classification: 'very good' | 'good' | 'bad' | 'very bad';
  impacts: Impact[];
  warnings: string[];
  recommendations: string[];
}

interface HealthAnalysis {
  ingredients: AnalyzedIngredient[];
  summary: {
    safe_to_consume: boolean;
    overall_impact: string;
  };
}

interface ScanResponse {
  type: 'ingredient_list' | 'food_photo';
  ingredients: Ingredient[];
  confidence: 'high' | 'medium' | 'low';
}

interface FoodScanProps {
  onClose: () => void;
  healthData: any; // Replace with your health data type
}

export default function FoodScan({ onClose, healthData }: FoodScanProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingHealth, setIsAnalyzingHealth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [healthAnalysis, setHealthAnalysis] = useState<HealthAnalysis | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Failed to access camera. Please make sure you have granted camera permissions.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && stream) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageDataUrl);
        setShowConfirmation(true);
        // Stop the camera stream after capturing
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setShowConfirmation(false);
    setError(null);
    startCamera();
  };

  const analyzeFoodImage = async () => {
    if (!capturedImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('image', blob, 'food-image.jpg');

      const apiResponse = await fetch(`${config.api.baseUrl}${config.api.endpoints.foodScan}`, {
        method: 'POST',
        body: formData
      });

      if (!apiResponse.ok) {
        throw new Error('Failed to analyze food image');
      }

      const data = await apiResponse.json();
      
      if (data.type && Array.isArray(data.ingredients) && data.confidence) {
        setScanResult(data);
        setShowResults(true);
        setShowConfirmation(false);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error analyzing food:', error);
      setError('Failed to analyze food image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmIngredients = async () => {
    if (!scanResult) return;
    
    setIsAnalyzingHealth(true);
    setError(null);

    try {
      const response = await fetch(`${config.api.baseUrl}${config.api.endpoints.analyzeIngredients}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          health_data: healthData,
          ingredients: scanResult.ingredients
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze ingredients');
      }

      const data = await response.json();
      
      handleAnalysisResponse(data);
    } catch (error) {
      console.error('Error analyzing ingredients:', error);
      setError('Failed to analyze ingredients. Please try again.');
    } finally {
      setIsAnalyzingHealth(false);
    }
  };

  const handleAnalysisResponse = (data: any) => {
    try {
      // If we have raw_analysis, try to parse and clean it
      if (data.raw_analysis) {
        const cleanedJson = data.raw_analysis
          .replace(/\n/g, '')  // Remove newlines
          .replace(/\r/g, '')  // Remove carriage returns
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
        
        try {
          // Try parsing the cleaned JSON
          const parsedAnalysis = JSON.parse(cleanedJson);
          setHealthAnalysis({
            ingredients: parsedAnalysis.ingredients || [],
            summary: {
              safe_to_consume: !parsedAnalysis.ingredients.some((i: any) => 
                i.classification === 'very_bad' || i.warnings.length > 0
              ),
              overall_impact: determineOverallImpact(parsedAnalysis.ingredients)
            }
          });
          return;
        } catch (innerError) {
          console.error('Failed to parse cleaned raw analysis:', innerError);
          
          // If the JSON is incomplete, try to extract what we can
          const partialMatch = cleanedJson.match(/"ingredients":\s*\[([\s\S]*?)\]/);
          if (partialMatch) {
            try {
              const ingredientsJson = `[${partialMatch[1]}]`;
              const partialIngredients = JSON.parse(ingredientsJson);
              setHealthAnalysis({
                ingredients: partialIngredients,
                summary: {
                  safe_to_consume: !partialIngredients.some((i: any) => 
                    i.classification === 'very_bad' || i.warnings.length > 0
                  ),
                  overall_impact: determineOverallImpact(partialIngredients)
                }
              });
              return;
            } catch (matchError) {
              console.error('Failed to parse partial ingredients:', matchError);
            }
          }
        }
      }
      
      // If we get here, try to parse the data directly
      if (data.ingredients) {
        setHealthAnalysis({
          ingredients: data.ingredients,
          summary: {
            safe_to_consume: !data.ingredients.some((i: any) => 
              i.classification === 'very_bad' || i.warnings.length > 0
            ),
            overall_impact: determineOverallImpact(data.ingredients)
          }
        });
        return;
      }
      
      // If all parsing attempts fail, throw an error
      throw new Error('Unable to parse ingredients data');
    } catch (error) {
      console.error('Error processing analysis response:', error);
      setError('Failed to process ingredient analysis. Please try again.');
    }
  };

  const determineOverallImpact = (ingredients: any[]) => {
    const stats = ingredients.reduce((acc: any, ingredient: any) => {
      acc[ingredient.classification] = (acc[ingredient.classification] || 0) + 1;
      return acc;
    }, {});

    const totalIngredients = ingredients.length;
    const badCount = (stats.bad || 0) + (stats.very_bad || 0);
    const goodCount = (stats.good || 0) + (stats.very_good || 0);
    
    if (badCount > totalIngredients * 0.3) {
      return 'High number of potentially harmful ingredients detected. Consider alternatives.';
    } else if (goodCount > totalIngredients * 0.5) {
      return 'Generally healthy composition with beneficial ingredients.';
    } else {
      return 'Moderate nutritional value. Contains a mix of beneficial and less desirable ingredients.';
    }
  };

  const getClassificationColor = (classification: AnalyzedIngredient['classification']) => {
    switch (classification) {
      case 'very good': return 'bg-green-50 text-green-700 border-green-200';
      case 'good': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'bad': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'very bad': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getSeverityColor = (severity: Impact['severity']) => {
    switch (severity) {
      case 'positive': return 'text-green-600';
      case 'negative': return 'text-red-600';
      case 'neutral': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getConfidenceColor = (confidence: ScanResponse['confidence']) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const addIngredient = () => {
    if (!scanResult) return;
    setScanResult({
      ...scanResult,
      ingredients: [
        ...scanResult.ingredients,
        { name: '', amount: null, unit: null }
      ]
    });
    setEditingIngredient(scanResult.ingredients.length);
  };

  const updateIngredient = (index: number, updates: Partial<Ingredient>) => {
    if (!scanResult) return;
    const updatedIngredients = [...scanResult.ingredients];
    updatedIngredients[index] = { ...updatedIngredients[index], ...updates };
    setScanResult({
      ...scanResult,
      ingredients: updatedIngredients
    });
  };

  const removeIngredient = (index: number) => {
    if (!scanResult) return;
    setScanResult({
      ...scanResult,
      ingredients: scanResult.ingredients.filter((_, i) => i !== index)
    });
    if (editingIngredient === index) {
      setEditingIngredient(null);
    }
  };

  const getIngredientStats = (ingredients: AnalyzedIngredient[]) => {
    return ingredients.reduce((acc, ingredient) => {
      acc[ingredient.classification] = (acc[ingredient.classification] || 0) + 1;
      return acc;
    }, {} as Record<AnalyzedIngredient['classification'], number>);
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Food Scanner
            </h2>
            <p className="text-gray-600 mt-2">Identify ingredients in your food</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-full"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Camera/Image Preview */}
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
            {!capturedImage && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            )}
            {capturedImage && (
              <img 
                src={capturedImage} 
                alt="Captured food" 
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Camera Controls */}
            {!showConfirmation && !capturedImage && !error && (
              <button
                onClick={capturePhoto}
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-white text-gray-900 rounded-xl hover:bg-gray-100 transition-colors font-medium shadow-lg flex items-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Capture Photo
              </button>
            )}

            {/* Confirmation Controls */}
            {showConfirmation && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
                <button
                  onClick={retakePhoto}
                  className="px-6 py-3 bg-white text-gray-900 rounded-xl hover:bg-gray-100 transition-colors font-medium shadow-lg flex items-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Retake
                </button>
                <button
                  onClick={analyzeFoodImage}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-lg flex items-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Analyze Photo
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-red-800 font-medium">{error}</p>
                <button
                  onClick={retakePhoto}
                  className="mt-2 text-red-600 hover:text-red-700 font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isAnalyzing && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-blue-800 font-medium">Analyzing your food...</p>
            </div>
          )}

          {/* Health Analysis Loading State */}
          {isAnalyzingHealth && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex flex-col items-center justify-center gap-4">
              <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <div className="text-center">
                <p className="text-blue-800 font-medium text-lg">Analyzing Health Impact</p>
                <p className="text-blue-600 mt-1">Evaluating ingredients against your health data...</p>
              </div>
            </div>
          )}

          {/* Results */}
          {showResults && scanResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    {scanResult.type === 'ingredient_list' ? 'Ingredient List' : 'Food Photo Analysis'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-md text-sm font-medium ${getConfidenceColor(scanResult.confidence)}`}>
                      {scanResult.confidence.charAt(0).toUpperCase() + scanResult.confidence.slice(1)} Confidence
                    </span>
                  </div>
                </div>
                <button
                  onClick={addIngredient}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Ingredient
                </button>
              </div>

              <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-sm">
                <div className="space-y-3">
                  {scanResult.ingredients.map((ingredient, index) => (
                    <div key={index} className="flex items-start gap-3 group">
                      {editingIngredient === index ? (
                        <div className="flex-1 flex items-center gap-3">
                          <input
                            type="text"
                            value={ingredient.name}
                            onChange={(e) => updateIngredient(index, { name: e.target.value })}
                            placeholder="Ingredient name"
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={ingredient.amount || ''}
                            onChange={(e) => updateIngredient(index, { amount: e.target.value || null })}
                            placeholder="Amount"
                            className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={ingredient.unit || ''}
                            onChange={(e) => updateIngredient(index, { unit: e.target.value || null })}
                            placeholder="Unit"
                            className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => setEditingIngredient(null)}
                            className="p-2 text-blue-600 hover:text-blue-700"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-between group">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{ingredient.name}</span>
                            {ingredient.amount && (
                              <span className="text-gray-600">
                                {ingredient.amount} {ingredient.unit}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingIngredient(index)}
                              className="p-1.5 text-gray-500 hover:text-gray-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => removeIngredient(index)}
                              className="p-1.5 text-red-500 hover:text-red-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-4 mt-6">
                  <button
                    onClick={retakePhoto}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Take Another Photo
                  </button>
                  <button
                    onClick={handleConfirmIngredients}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  >
                    Confirm Ingredients
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Health Analysis Results */}
          {healthAnalysis && (
            <div className="space-y-6">
              {/* Summary Section */}
              <div className={`p-6 rounded-xl border ${
                healthAnalysis.summary.safe_to_consume 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${
                    healthAnalysis.summary.safe_to_consume 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {healthAnalysis.summary.safe_to_consume ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      )}
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold ${
                      healthAnalysis.summary.safe_to_consume 
                        ? 'text-green-800' 
                        : 'text-red-800'
                    }`}>
                      {healthAnalysis.summary.safe_to_consume 
                        ? 'Safe to Consume' 
                        : 'Consumption Warning'}
                    </h3>
                    <p className={`mt-1 ${
                      healthAnalysis.summary.safe_to_consume 
                        ? 'text-green-700' 
                        : 'text-red-700'
                    }`}>
                      {healthAnalysis.summary.overall_impact}
                    </p>
                  </div>
                </div>

                {/* Ingredient Statistics */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Ingredient Breakdown</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(getIngredientStats(healthAnalysis.ingredients)).map(([classification, count]) => (
                      <div 
                        key={classification}
                        className={`p-3 rounded-lg ${getClassificationColor(classification as AnalyzedIngredient['classification'])}`}
                      >
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-sm capitalize">{classification.replace('_', ' ')}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Warnings Summary */}
                {healthAnalysis.ingredients.some(i => i.warnings.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Key Warnings</h4>
                    <ul className="space-y-1">
                      {healthAnalysis.ingredients
                        .filter(i => i.warnings.length > 0)
                        .map((ingredient, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red-600 font-medium">{ingredient.name}:</span>
                            <span className="text-gray-600">{ingredient.warnings[0]}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Ingredients Analysis Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Ingredient</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Classification</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Health Impacts</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Warnings</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Recommendations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {healthAnalysis.ingredients.map((ingredient, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-900">{ingredient.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium ${getClassificationColor(ingredient.classification)}`}>
                            {ingredient.classification}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <ul className="space-y-2">
                            {ingredient.impacts.map((impact, impactIndex) => (
                              <li key={impactIndex} className="flex items-start gap-2">
                                <span className={`font-medium ${getSeverityColor(impact.severity)}`}>
                                  {impact.metric}:
                                </span>
                                <span className="text-gray-600">{impact.effect}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-6 py-4">
                          {ingredient.warnings.length > 0 ? (
                            <ul className="list-disc list-inside text-red-600 space-y-1">
                              {ingredient.warnings.map((warning, warningIndex) => (
                                <li key={warningIndex}>{warning}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-green-600">No warnings</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {ingredient.recommendations.length > 0 ? (
                            <ul className="list-disc list-inside text-blue-600 space-y-1">
                              {ingredient.recommendations.map((rec, recIndex) => (
                                <li key={recIndex}>{rec}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500">No specific recommendations</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-4">
                <button
                  onClick={retakePhoto}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Scan Another Food
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
