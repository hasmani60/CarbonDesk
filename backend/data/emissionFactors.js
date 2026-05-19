// backend/data/emissionFactors.js - Emission factors for RBAC activity selection
const emissionFactors = {
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
      "Business travel": {
        "Air": { factor: 2.85, unit: "km", description: "Business air travel emissions" },
        "Rail": { factor: 0.45, unit: "km", description: "Business rail travel emissions" },
        "Taxi": { factor: 1.25, unit: "km", description: "Business taxi/cab usage" }
      }
    }
  };
  
  module.exports = { emissionFactors };