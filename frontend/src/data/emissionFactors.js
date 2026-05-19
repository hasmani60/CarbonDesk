// frontend/src/data/emissionFactors.js
export const emissionFactors = {
    scope1: {
      "Fuel from Generator": {
        "Diesel": { factor: 2.68, unit: "litres", description: "Emissions from the combustion of diesel in company-operated generators" },
        "HSD": { factor: 2.65, unit: "litres", description: "High Speed Diesel for generator operations" },
        "Biofuel": { factor: 1.95, unit: "litres", description: "Biofuel combustion in generators" }
      },
      "Wood Burnt for Boilers": {
        "Firewood": { factor: 1.85, unit: "kg", description: "Firewood used in industrial boilers" },
        "Coconut Husk": { factor: 1.45, unit: "kg", description: "Coconut husk biomass for boiler operations" }
      },
      "Fuel Used by Company vehicles": {
        "Diesel": { factor: 2.68, unit: "litres", description: "Diesel consumption by company-owned vehicles" },
        "Petrol": { factor: 2.31, unit: "litres", description: "Petrol consumption by company vehicles" },
        "Electric": { factor: 0.82, unit: "kWh", description: "Electric vehicle charging emissions" }
      },
      "Refrigerant Purchased": {
        "R22": { factor: 1810, unit: "kg", description: "R22 refrigerant with high GWP" },
        "R134a": { factor: 1430, unit: "kg", description: "R134a refrigerant emissions" },
        "R410A": { factor: 2088, unit: "kg", description: "R410A refrigerant for AC systems" }
      },
      "Water Used": {
        "Borewell": { factor: 0.34, unit: "litres", description: "Energy-associated emissions from borewell water extraction" },
        "Municipality": { factor: 0.29, unit: "litres", description: "Municipal water supply emissions" },
        "Tanker": { factor: 0.52, unit: "litres", description: "Tanker water delivery emissions" }
      },
      "Water Recycled": {
        "ETP": { factor: 0.15, unit: "litres", description: "Effluent Treatment Plant recycled water" },
        "RO plant": { factor: 0.18, unit: "litres", description: "Reverse Osmosis plant recycled water" },
        "Rainwater": { factor: 0.05, unit: "litres", description: "Rainwater harvesting emissions" }
      },
      "Waste Generation": {
        "Organic": { factor: 0.58, unit: "kg", description: "Organic waste decomposition emissions" },
        "Packaging": { factor: 0.42, unit: "kg", description: "Packaging waste disposal emissions" },
        "Plastic": { factor: 2.15, unit: "kg", description: "Plastic waste incineration emissions" },
        "Sludge": { factor: 0.75, unit: "kg", description: "Industrial sludge disposal emissions" }
      },
      "Fuel used in mess": {
        "LPG": { factor: 2.98, unit: "kg", description: "LPG consumption in employee mess/canteen" },
        "Firewood": { factor: 1.85, unit: "kg", description: "Firewood for cooking in mess" },
        "Kerosene": { factor: 2.52, unit: "litres", description: "Kerosene used for cooking" }
      },
      "Steam Production": {
        "Steam": { factor: 0.95, unit: "kg", description: "Steam generation in boilers" }
      },
      "AC service data": {
        "R134a": { factor: 1430, unit: "kg", description: "AC servicing refrigerant refills" },
        "R410a": { factor: 2088, unit: "kg", description: "R410a refills during maintenance" }
      },
      "Purchase of paper": {
        "A4": { factor: 1.29, unit: "kg", description: "A4 paper production emissions" },
        "Kraft": { factor: 1.45, unit: "kg", description: "Kraft paper manufacturing emissions" },
        "Prints": { factor: 1.35, unit: "kg", description: "Printing materials emissions" }
      },
      "Purchase of packing material (plastic)": {
        "HDPE": { factor: 1.95, unit: "kg", description: "High Density Polyethylene packaging" },
        "LDPE": { factor: 2.02, unit: "kg", description: "Low Density Polyethylene packaging" },
        "Shrink wrap": { factor: 2.18, unit: "kg", description: "Shrink wrap packaging material" }
      },
      "LPG Cylinders Purchase": {
        "LPG": { factor: 2.98, unit: "kg", description: "Direct emissions from using LPG cylinders" }
      },
      "Fuel for Forklift": {
        "Diesel": { factor: 2.68, unit: "litres", description: "Diesel fuel used by forklifts" },
        "Battery": { factor: 0.82, unit: "kWh", description: "Electric forklift charging" }
      },
      "Oil used for lubrication": {
        "Hydraulic": { factor: 3.15, unit: "litres", description: "Hydraulic oil for equipment" },
        "Engine Oil": { factor: 3.25, unit: "litres", description: "Engine oil for machinery" },
        "Gear oil": { factor: 3.18, unit: "litres", description: "Gear oil for equipment operation" }
      },
      "Gas purchased for Maintenance": {
        "Nitrogen": { factor: 0.15, unit: "kg", description: "Nitrogen gas for maintenance work" },
        "Oxygen": { factor: 0.18, unit: "kg", description: "Oxygen gas for welding/cutting" },
        "Acetylene": { factor: 2.95, unit: "kg", description: "Acetylene gas for welding operations" }
      },
      "Cotton Waste for boiler starters": {
        "Cotton Waste": { factor: 1.65, unit: "kg", description: "Cotton waste used for igniting boilers" }
      },
      "Transport: Factory to warehouse": {
        "Company Vehicle": { factor: 2.68, unit: "km", description: "In-house transportation between facilities" }
      }
    },
    scope2: {
      "Electricity Purchased": {
        "Grid Electricity": { factor: 0.82, unit: "kWh", description: "Grid electricity consumption emissions" },
        "Renewable Energy": { factor: 0.05, unit: "kWh", description: "Renewable energy sourced electricity" },
        "Non-Renewable": { factor: 0.95, unit: "kWh", description: "Fossil fuel-based electricity" }
      }
    },
    scope3: {
      "Transport: Harbor to plant": {
        "Truck": { factor: 0.95, unit: "km", description: "Third-party transport of raw materials from ports" },
        "Rail": { factor: 0.45, unit: "km", description: "Rail transport of materials from harbor" }
      },
      "Export of Material": {
        "Ship": { factor: 0.65, unit: "km", description: "Maritime shipping emissions for exports" },
        "Air": { factor: 2.85, unit: "km", description: "Air freight emissions for exports" },
        "Truck": { factor: 0.95, unit: "km", description: "Road transport for export delivery" }
      },
      "Domestic Sales Transport": {
        "Truck": { factor: 0.95, unit: "km", description: "Domestic delivery truck emissions" },
        "Train": { factor: 0.45, unit: "km", description: "Rail transport for domestic sales" }
      },
      "Employee transport": {
        "Bus": { factor: 0.75, unit: "km", description: "Employee commuting by bus" },
        "Carpool": { factor: 0.45, unit: "km", description: "Employee carpooling emissions" },
        "Van": { factor: 0.85, unit: "km", description: "Company van transport for employees" }
      },
      "Business travel": {
        "Air": { factor: 2.85, unit: "km", description: "Business air travel emissions" },
        "Rail": { factor: 0.45, unit: "km", description: "Business rail travel emissions" },
        "Taxi": { factor: 1.25, unit: "km", description: "Business taxi/cab usage" }
      },
      "Transport of EPT sludge": {
        "Truck": { factor: 0.95, unit: "km", description: "Transport of effluent treatment plant sludge to treatment centers" }
      }
    }
  };
  
  // Helper function to get emission factor
  export const getEmissionFactor = (scope, category, type) => {
    const scopeKey = `scope${scope}`;
    const factorData = emissionFactors[scopeKey]?.[category]?.[type];
    return factorData || { factor: 1.0, unit: 'kg', description: 'Default emission factor' };
  };
  
  // Get available units for a category and type
  export const getAvailableUnits = (scope, category, type) => {
    const factorData = getEmissionFactor(scope, category, type);
    return [factorData.unit];
  };
  
  // Calculate emissions
  export const calculateEmissions = (amount, scope, category, type) => {
    const factorData = getEmissionFactor(scope, category, type);
    return amount * factorData.factor;
  };