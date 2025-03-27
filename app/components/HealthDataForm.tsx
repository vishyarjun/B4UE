import { useState, useRef, useEffect } from 'react';
import config, { getAuthHeader } from '../../config';
import { HealthData, HealthMetric } from '../types/health';

interface HealthDataFormProps {
  onClose: () => void;
  onSave: (data: HealthData) => void;
  initialData: HealthData | null;
}

const dietaryOptions = [
  'None',
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Kosher',
  'Halal',
  'Keto',
  'Paleo'
];

const allergyOptions = [
  'Peanuts',
  'Tree Nuts',
  'Milk',
  'Eggs',
  'Soy',
  'Wheat',
  'Fish',
  'Shellfish'
];

export default function HealthDataForm({ onClose, onSave, initialData }: HealthDataFormProps) {
  const [healthData, setHealthData] = useState<HealthData>(() => {
    return initialData || {
      dietaryRequirement: '',
      allergies: [],
      healthConditions: [],
      healthReports: [],
      additionalHealthData: {}
    };
  });
  const [newCondition, setNewCondition] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    localStorage.setItem('healthData', JSON.stringify({
      ...healthData,
      healthReports: [] // Don't store files in localStorage
    }));
  }, [healthData]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const handleAllergiesChange = (allergy: string) => {
    setHealthData(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter(a => a !== allergy)
        : [...prev.allergies, allergy]
    }));
  };

  const handleConditionKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newCondition.trim()) {
      e.preventDefault();
      handleAddCondition();
    }
  };

  const handleAddCondition = () => {
    if (newCondition.trim()) {
      setHealthData(prev => ({
        ...prev,
        healthConditions: [...prev.healthConditions, newCondition.trim()]
      }));
      setNewCondition('');
    }
  };

  const handleRemoveCondition = (condition: string) => {
    setHealthData(prev => ({
      ...prev,
      healthConditions: prev.healthConditions.filter(c => c !== condition)
    }));
  };

  const handleAddHealthData = (key: string, value: string) => {
    if (key.trim() && value.trim()) {
      setHealthData(prev => ({
        ...prev,
        additionalHealthData: {
          ...prev.additionalHealthData,
          [key.trim()]: { result: parseFloat(value.trim()), referenceInterval: null, units: null }
        }
      }));
    }
  };

  const handleRemoveHealthData = (key: string) => {
    setHealthData(prev => {
      const newData = { ...prev };
      const newAdditionalData = { ...prev.additionalHealthData };
      delete newAdditionalData[key];
      newData.additionalHealthData = newAdditionalData;
      return newData;
    });
  };

  const handleImageAnalysis = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    setIsAnalyzing(true);

    try {
      const response = await fetch(`${config.api.baseUrl}${config.api.endpoints.imageScan}`, {
        method: 'POST',
        body: formData,
        headers: {
          ...getAuthHeader()
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Invalid or missing authentication token');
        }
        throw new Error('Failed to analyze image');
      }

      const data = await response.json();
      
      // Validate the response format
      if (typeof data === 'object' && data !== null) {
        // Validate each metric in the response
        const isValidMetric = (metric: unknown): metric is HealthMetric => {
          return metric !== null &&
                 typeof metric === 'object' &&
                 'referenceInterval' in metric &&
                 'result' in metric &&
                 'units' in metric &&
                 (metric.referenceInterval === null || typeof metric.referenceInterval === 'string') &&
                 (metric.result === null || typeof metric.result === 'number') &&
                 (metric.units === null || typeof metric.units === 'string');
        };

        const newData: { [key: string]: HealthMetric } = {};
        let hasValidData = false;

        for (const [key, value] of Object.entries(data)) {
          if (isValidMetric(value)) {
            newData[key] = value;
            hasValidData = true;
          }
        }

        if (hasValidData) {
          setHealthData(prev => ({
            ...prev,
            additionalHealthData: {
              ...prev.additionalHealthData,
              ...newData
            }
          }));
        } else {
          throw new Error('No valid health metrics found in response');
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      alert(error instanceof Error ? error.message : 'Failed to analyze image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setHealthData(prev => ({
        ...prev,
        healthReports: [...prev.healthReports, ...Array.from(files)]
      }));

      // Analyze each image file
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          await handleImageAnalysis(file);
        }
      }
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Failed to access camera. Please make sure you have granted camera permissions.');
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && stream) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
            setHealthData(prev => ({
              ...prev,
              healthReports: [...prev.healthReports, file]
            }));
            await handleImageAnalysis(file);
          }
        }, 'image/jpeg');
      }
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setShowCamera(false);
    }
  };

  const handleSave = () => {
    onSave(healthData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-12 bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-sm">
          <div>
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Health Information</h2>
            <p className="text-gray-600 mt-2">Add your personal health details</p>
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

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Dietary Requirements */}
          <div className="space-y-4 bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-sm">
            <label className="block text-xl font-semibold text-gray-800">
              Dietary Requirement
            </label>
            <select
              value={healthData.dietaryRequirement}
              onChange={(e) => setHealthData(prev => ({ ...prev, dietaryRequirement: e.target.value }))}
              className="w-full p-4 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 bg-gray-50/80 transition-colors text-gray-700"
            >
              <option value="">Select a dietary requirement</option>
              {dietaryOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {/* Allergies */}
          <div className="space-y-4 bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-sm">
            <label className="block text-xl font-semibold text-gray-800">
              Allergies
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {allergyOptions.map(allergy => (
                <label key={allergy} className="flex items-center p-4 bg-gray-50/80 rounded-xl hover:bg-gray-100/80 transition-colors cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={healthData.allergies.includes(allergy)}
                    onChange={() => handleAllergiesChange(allergy)}
                    className="w-5 h-5 text-blue-600 rounded-lg border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-3 text-gray-700 group-hover:text-gray-900">{allergy}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Health Conditions */}
          <div className="space-y-4 bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-sm">
            <label className="block text-xl font-semibold text-gray-800">
              Health Conditions
            </label>
            <div className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  onKeyPress={handleConditionKeyPress}
                  placeholder="Type and press Enter to add condition"
                  className="flex-1 p-4 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 bg-gray-50/80 transition-colors text-gray-700 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={handleAddCondition}
                  className="px-6 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium shadow-sm hover:shadow"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {healthData.healthConditions.map(condition => (
                  <span
                    key={condition}
                    className="bg-blue-50/80 backdrop-blur-sm px-4 py-2 rounded-xl flex items-center gap-2 text-blue-700 shadow-sm"
                  >
                    {condition}
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(condition)}
                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-100/80 rounded-full p-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Additional Health Data */}
          <div className="space-y-4 bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <label className="block text-xl font-semibold text-gray-800">
                Health Report Analysis
              </label>
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-blue-600">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                      fill="none"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-sm font-medium">Analyzing Report...</span>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="grid gap-3">
                {Object.entries(healthData.additionalHealthData || {}).map(([key, value]) => (
                  <div
                    key={key}
                    className="bg-gray-50/80 p-4 rounded-xl"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{key}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveHealthData(key)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50/80 p-2 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m4-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Result:</span>
                            <span className="ml-2 text-gray-900">{value.result !== null ? value.result : 'N/A'}{value.units ? ` ${value.units}` : ''}</span>
                          </div>
                          {value.referenceInterval && (
                            <div>
                              <span className="text-gray-500">Reference:</span>
                              <span className="ml-2 text-gray-900">{value.referenceInterval}</span>
                            </div>
                          )}
                          {value.units && (
                            <div>
                              <span className="text-gray-500">Units:</span>
                              <span className="ml-2 text-gray-900">{value.units}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Manual Health Data Entry */}
          <div className="mt-4">
            <div className="flex gap-4 mb-2">
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Metric name"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleAddHealthData(newKey, newValue)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium shadow-sm hover:shadow"
              >
                Add Metric
              </button>
            </div>
          </div>

          {/* Health Reports Upload */}
          <div className="space-y-4 bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-sm">
            <label className="block text-xl font-semibold text-gray-800">
              Health Reports
            </label>
            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-4 bg-gray-50/80 text-gray-700 rounded-xl hover:bg-gray-100/80 transition-colors flex items-center gap-2 font-medium shadow-sm hover:shadow"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Files
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-6 py-4 bg-gray-50/80 text-gray-700 rounded-xl hover:bg-gray-100/80 transition-colors flex items-center gap-2 font-medium shadow-sm hover:shadow"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4H7.86a2 2 0 00-1.664.89L3 9a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-5a2 2 0 00-1.664-1.11l-.812-1.22A2 2 0 0016.07 7H24v2a2 2 0 01-2 2H7" />
                  </svg>
                  Take Photo
                </button>
              </div>
              {showCamera && (
                <div className="relative bg-black rounded-xl overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-auto"
                  />
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium shadow-lg"
                  >
                    Capture
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {healthData.healthReports.map((report, index) => (
                  <div key={index} className="bg-gray-50/80 p-4 rounded-xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate text-gray-700">Report {index + 1}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHealthData(prev => ({
                          ...prev,
                          healthReports: prev.healthReports.filter((_, i) => i !== index),
                        }));
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50/80 p-2 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m4-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-4 bg-gray-50/80 text-gray-700 rounded-xl hover:bg-gray-100/80 transition-colors font-medium shadow-sm hover:shadow"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium shadow-sm hover:shadow"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
