// frontend/src/utils/sampleDataSeeder.js
import { saveEmission, clearAllEmissions } from './localStorage';

// Sample emission data for testing and demonstration
const sampleEmissions = [
  // Scope 1 Emissions
  {
    scope: 1,
    category: 'Fuel from Generator',
    type: 'Diesel',
    amount: 5000,
    unit: 'litres',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Factory A',
    description: 'Monthly diesel consumption for backup generator',
    factor: 2.68,
    calculatedEmissions: 13400
  },
  {
    scope: 1,
    category: 'Fuel Used by Company vehicles',
    type: 'Petrol',
    amount: 2000,
    unit: 'litres',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Factory A',
    description: 'Company vehicle fleet fuel consumption',
    factor: 2.31,
    calculatedEmissions: 4620
  },
  {
    scope: 1,
    category: 'Water Used',
    type: 'Borewell',
    amount: 50000,
    unit: 'litres',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Factory A',
    description: 'Industrial process water from borewell',
    factor: 0.34,
    calculatedEmissions: 17000
  },
  {
    scope: 1,
    category: 'Waste Generation',
    type: 'Organic',
    amount: 1000,
    unit: 'kg',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Canteen/Mess',
    description: 'Organic waste from employee cafeteria',
    factor: 0.58,
    calculatedEmissions: 580
  },
  {
    scope: 1,
    category: 'Fuel used in mess',
    type: 'LPG',
    amount: 500,
    unit: 'kg',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Canteen/Mess',
    description: 'LPG consumption for cooking in employee mess',
    factor: 2.98,
    calculatedEmissions: 1490
  },
  
  // Scope 2 Emissions
  {
    scope: 2,
    category: 'Electricity Purchased',
    type: 'Grid Electricity',
    amount: 25000,
    unit: 'kWh',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Factory A',
    description: 'Monthly electricity consumption from grid',
    factor: 0.82,
    calculatedEmissions: 20500
  },
  {
    scope: 2,
    category: 'Electricity Purchased',
    type: 'Renewable Energy',
    amount: 5000,
    unit: 'kWh',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Office Building',
    description: 'Solar panel electricity generation',
    factor: 0.05,
    calculatedEmissions: 250
  },
  
  // Scope 3 Emissions
  {
    scope: 3,
    category: 'Business travel',
    type: 'Air',
    amount: 15000,
    unit: 'km',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Office Building',
    description: 'Employee business travel by air',
    factor: 2.85,
    calculatedEmissions: 42750
  },
  {
    scope: 3,
    category: 'Employee transport',
    type: 'Bus',
    amount: 8000,
    unit: 'km',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Factory A',
    description: 'Employee commuting via company bus service',
    factor: 0.75,
    calculatedEmissions: 6000
  },
  {
    scope: 3,
    category: 'Transport: Harbor to plant',
    type: 'Truck',
    amount: 5000,
    unit: 'km',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Factory A',
    description: 'Raw material transport from port to factory',
    factor: 0.95,
    calculatedEmissions: 4750
  },
  {
    scope: 3,
    category: 'Export of Material',
    type: 'Ship',
    amount: 12000,
    unit: 'km',
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    location: 'Warehouse 1',
    description: 'Product export via maritime shipping',
    factor: 0.65,
    calculatedEmissions: 7800
  },
  
  // Additional September data for trend analysis
  {
    scope: 1,
    category: 'Fuel from Generator',
    type: 'Diesel',
    amount: 4500,
    unit: 'litres',
    startDate: '2025-09-01',
    endDate: '2025-09-15',
    location: 'Factory A',
    description: 'Mid-month diesel consumption',
    factor: 2.68,
    calculatedEmissions: 12060
  },
  {
    scope: 2,
    category: 'Electricity Purchased',
    type: 'Grid Electricity',
    amount: 12000,
    unit: 'kWh',
    startDate: '2025-09-01',
    endDate: '2025-09-15',
    location: 'Factory A',
    description: 'Mid-month electricity consumption',
    factor: 0.82,
    calculatedEmissions: 9840
  },
  {
    scope: 3,
    category: 'Business travel',
    type: 'Air',
    amount: 8000,
    unit: 'km',
    startDate: '2025-09-01',
    endDate: '2025-09-15',
    location: 'Office Building',
    description: 'Mid-month business travel',
    factor: 2.85,
    calculatedEmissions: 22800
  }
];

// Function to seed sample data
export const seedSampleData = () => {
  try {
    console.log('🌱 Seeding sample emission data...');
    
    sampleEmissions.forEach(emission => {
      // Create a proper date format
      const emissionRecord = {
        ...emission,
        id: `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Get existing emissions and add new one
      const existingEmissions = JSON.parse(localStorage.getItem('carbon_accounting_emissions') || '[]');
      existingEmissions.push(emissionRecord);
      localStorage.setItem('carbon_accounting_emissions', JSON.stringify(existingEmissions));
    });
    
    console.log(`✅ Successfully seeded ${sampleEmissions.length} emission records`);
    return true;
  } catch (error) {
    console.error('❌ Error seeding sample data:', error);
    return false;
  }
};

// Function to reset data (clear all and reseed)
export const resetToSampleData = () => {
  try {
    clearAllEmissions();
    return seedSampleData();
  } catch (error) {
    console.error('Error resetting to sample data:', error);
    return false;
  }
};

// Function to check if sample data exists
export const hasSampleData = () => {
  try {
    const emissions = JSON.parse(localStorage.getItem('carbon_accounting_emissions') || '[]');
    return emissions.some(emission => emission.id?.includes('sample_'));
  } catch (error) {
    return false;
  }
};

// Development utility function
export const devUtils = {
  seedSampleData,
  resetToSampleData,
  hasSampleData,
  clearAllEmissions,
  getSampleEmissionCount: () => sampleEmissions.length
};

// Auto-seed on first load (only in development)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const emissions = JSON.parse(localStorage.getItem('carbon_accounting_emissions') || '[]');
  if (emissions.length === 0) {
    console.log('🔧 Development mode: Auto-seeding sample data...');
    seedSampleData();
  }
}