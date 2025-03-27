'use client';

import { useState } from "react";
import Image from "next/image";
import HealthDataForm from "./components/HealthDataForm";
import FoodScan from "./components/FoodScan";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeartPulse, faUtensils, faShieldHeart } from '@fortawesome/free-solid-svg-icons';
import { HealthData } from './types/health';

export default function Home() {
  const [showHealthForm, setShowHealthForm] = useState(false);
  const [showFoodScan, setShowFoodScan] = useState(false);
  const [healthData, setHealthData] = useState<HealthData | null>(() => {
    if (typeof window !== 'undefined') {
      const savedData = localStorage.getItem('healthData');
      return savedData ? JSON.parse(savedData) : null;
    }
    return null;
  });

  const handleHealthDataUpdate = (data: HealthData) => {
    setHealthData(data);
    if (typeof window !== 'undefined') {
      localStorage.setItem('healthData', JSON.stringify(data));
    }
  };

  const handleFoodScanClick = () => {
    if (!healthData) {
      setShowHealthForm(true);
    } else {
      setShowFoodScan(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
      <main className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-8">
            <div className="relative w-72 h-72 p-8 bg-white/40 backdrop-blur-sm rounded-2xl shadow-lg 
                          before:absolute before:inset-0 before:bg-gradient-to-r before:from-blue-500/10 before:to-indigo-500/10 before:rounded-2xl
                          hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="relative w-full h-full">
                <Image
                  src="/logo.svg"
                  alt="B4UE Logo"
                  fill
                  priority
                  style={{ objectFit: 'contain' }}
                  className="rounded-lg"
                />
              </div>
            </div>
          </div>
          <p className="text-xl text-gray-600 font-medium max-w-2xl mx-auto leading-relaxed">
            Your AI-powered food detective—uncover hidden ingredients and make smarter, healthier choices.
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-16 justify-center items-center max-w-6xl mx-auto mb-16">
          <div 
            onClick={() => setShowHealthForm(true)}
            className="w-96 h-96 bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-8 hover:scale-105 group"
          >
            <div className="mb-8 text-blue-600 group-hover:text-blue-700 transition-colors w-40 h-40 flex items-center justify-center">
              <FontAwesomeIcon icon={faHeartPulse} style={{ width: '160px', height: '160px' }} />
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Add Health Data</h2>
            <p className="text-gray-600 text-center">Track your health metrics and medical records</p>
          </div>

          <div 
            onClick={handleFoodScanClick}
            className="w-96 h-96 bg-white/90 backdrop-blur-sm rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-8 hover:scale-105 group"
          >
            <div className="mb-8 text-green-600 group-hover:text-green-700 transition-colors w-40 h-40 flex items-center justify-center">
              <FontAwesomeIcon icon={faUtensils} style={{ width: '160px', height: '160px' }} />
            </div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Scan Food</h2>
            <p className="text-gray-600 text-center">Analyze nutritional content of your meals</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto text-center bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-center text-blue-600 mb-3">
            <FontAwesomeIcon icon={faShieldHeart} className="w-6 h-6 mr-2" />
          </div>
          <p className="text-gray-700 leading-relaxed">
            Your privacy matters to us. All your personal health data and records are stored exclusively on your device. 
            We maintain a strict policy of not storing any of your sensitive information on our servers, 
            ensuring complete control and privacy of your health data remains with you.
          </p>
        </div>
      </main>

      {showHealthForm && (
        <HealthDataForm 
          onClose={() => setShowHealthForm(false)} 
          onSave={handleHealthDataUpdate}
          initialData={healthData}
        />
      )}

      {showFoodScan && healthData && (
        <FoodScan 
          onClose={() => setShowFoodScan(false)} 
          healthData={healthData}
        />
      )}
    </div>
  );
}
