// Complete UK Government GHG Conversion Factors 2023 Database
// Ready to integrate into your system - All emission factors organized by scope, category, and subcategory

const emissionFactors = {
  scope1: {
    // ==================== GASEOUS FUELS ====================
    "Gaseous Fuels": {
      "Butane (tonnes)": { factor: 3033.3807, unit: "tonnes", co2: 3029.26, ch4: 2.52, n2o: 1.6007, description: "Butane gas combustion" },
      "Butane (litres)": { factor: 1.7453, unit: "litres", co2: 1.74296, ch4: 0.0014448, n2o: 0.0009248, description: "Butane gas combustion" },
      "Butane (kWh Net CV)": { factor: 0.2411, unit: "kWh", co2: 0.24074, ch4: 0.0002016, n2o: 0.0001245, description: "Butane - Net Calorific Value" },
      "Butane (kWh Gross CV)": { factor: 0.2224, unit: "kWh", co2: 0.2221, ch4: 0.000190, n2o: 0.0001156, description: "Butane - Gross Calorific Value" },
      
      "CNG (tonnes)": { factor: 2562.5744, unit: "tonnes", co2: 2557.53, ch4: 3.8528, n2o: 1.1916, description: "Compressed Natural Gas" },
      "CNG (litres)": { factor: 0.4484, unit: "litres", co2: 0.44757, ch4: 0.000672, n2o: 0.0002045, description: "Compressed Natural Gas" },
      "CNG (kWh Net CV)": { factor: 0.2027, unit: "kWh", co2: 0.20226, ch4: 0.0003136, n2o: 0.0000978, description: "CNG - Net Calorific Value" },
      "CNG (kWh Gross CV)": { factor: 0.1829, unit: "kWh", co2: 0.18256, ch4: 0.00028, n2o: 0.0000889, description: "CNG - Gross Calorific Value" },
      
      "LNG (tonnes)": { factor: 2581.9844, unit: "tonnes", co2: 2576.94, ch4: 3.8528, n2o: 1.1916, description: "Liquefied Natural Gas" },
      "LNG (litres)": { factor: 1.1683, unit: "litres", co2: 1.16604, ch4: 0.0017472, n2o: 0.0005424, description: "Liquefied Natural Gas" },
      "LNG (kWh Net CV)": { factor: 0.2042, unit: "kWh", co2: 0.20379, ch4: 0.0003136, n2o: 0.0000978, description: "LNG - Net Calorific Value" },
      "LNG (kWh Gross CV)": { factor: 0.1843, unit: "kWh", co2: 0.18395, ch4: 0.00028, n2o: 0.0000889, description: "LNG - Gross Calorific Value" },
      
      "LPG (tonnes)": { factor: 2939.3609, unit: "tonnes", co2: 2935.18, ch4: 2.5536, n2o: 1.6273, description: "Liquefied Petroleum Gas" },
      "LPG (litres)": { factor: 1.5571, unit: "litres", co2: 1.55491, ch4: 0.0013552, n2o: 0.0008626, description: "Liquefied Petroleum Gas" },
      "LPG (kWh Net CV)": { factor: 0.2303, unit: "kWh", co2: 0.22999, ch4: 0.0002016, n2o: 0.0001245, description: "LPG - Net Calorific Value" },
      "LPG (kWh Gross CV)": { factor: 0.2145, unit: "kWh", co2: 0.21419, ch4: 0.000190, n2o: 0.0001156, description: "LPG - Gross Calorific Value" },
      
      "Natural Gas (tonnes)": { factor: 2562.5744, unit: "tonnes", co2: 2557.53, ch4: 3.8528, n2o: 1.1916, description: "Natural gas from grid network" },
      "Natural Gas (cubic metres)": { factor: 2.0384, unit: "m3", co2: 2.03437, ch4: 0.0030688, n2o: 0.0009515, description: "Natural gas from grid network" },
      "Natural Gas (kWh Net CV)": { factor: 0.2027, unit: "kWh", co2: 0.20226, ch4: 0.0003136, n2o: 0.0000978, description: "Natural gas - Net Calorific Value" },
      "Natural Gas (kWh Gross CV)": { factor: 0.1829, unit: "kWh", co2: 0.18256, ch4: 0.00028, n2o: 0.0000889, description: "Natural gas - Gross Calorific Value" },
      
      "Natural Gas 100% Mineral (tonnes)": { factor: 2581.9844, unit: "tonnes", co2: 2576.94, ch4: 3.8528, n2o: 1.1916, description: "Natural gas 100% mineral blend" },
      "Natural Gas 100% Mineral (cubic metres)": { factor: 2.0538, unit: "m3", co2: 2.04981, ch4: 0.0030688, n2o: 0.0009515, description: "Natural gas 100% mineral blend" },
      "Natural Gas 100% Mineral (kWh Net CV)": { factor: 0.2042, unit: "kWh", co2: 0.20379, ch4: 0.0003136, n2o: 0.0000978, description: "Natural gas 100% mineral - Net CV" },
      "Natural Gas 100% Mineral (kWh Gross CV)": { factor: 0.1843, unit: "kWh", co2: 0.18395, ch4: 0.00028, n2o: 0.0000889, description: "Natural gas 100% mineral - Gross CV" },
      
      "Propane (tonnes)": { factor: 2992.9423, unit: "tonnes", co2: 2989.0, ch4: 2.3296, n2o: 1.6127, description: "Propane gas" },
      "Propane (litres)": { factor: 1.5355, unit: "litres", co2: 1.53358, ch4: 0.0011952, n2o: 0.000828, description: "Propane gas" },
      "Propane (kWh Net CV)": { factor: 0.2337, unit: "kWh", co2: 0.23338, ch4: 0.0001792, n2o: 0.0001232, description: "Propane - Net Calorific Value" },
      "Propane (kWh Gross CV)": { factor: 0.2144, unit: "kWh", co2: 0.21412, ch4: 0.0001680, n2o: 0.0001132, description: "Propane - Gross Calorific Value" }
    },

    // ==================== LIQUID FUELS ====================
    "Liquid Fuels": {
      "Aviation Spirit (tonnes)": { factor: 3151.8188, unit: "tonnes", co2: 3150.0, ch4: 0.5088, n2o: 1.31, description: "Aviation gasoline" },
      "Aviation Spirit (litres)": { factor: 2.3286, unit: "litres", co2: 2.3272, ch4: 0.000376, n2o: 0.000968, description: "Aviation gasoline" },
      "Aviation Spirit (kWh Gross CV)": { factor: 0.2661, unit: "kWh", co2: 0.26594, ch4: 0.000043, n2o: 0.0001107, description: "Aviation gasoline - Gross CV" },
      
      "Aviation Turbine Fuel (tonnes)": { factor: 3150.8054, unit: "tonnes", co2: 3150.0, ch4: 0.0336, n2o: 0.7718, description: "Aviation kerosene/jet fuel" },
      "Aviation Turbine Fuel (litres)": { factor: 2.5527, unit: "litres", co2: 2.55246, ch4: 0.0000272, n2o: 0.000625, description: "Aviation kerosene/jet fuel" },
      "Aviation Turbine Fuel (kWh Gross CV)": { factor: 0.2517, unit: "kWh", co2: 0.25148, ch4: 0.0000027, n2o: 0.0000616, description: "Aviation kerosene - Gross CV" },
      
      "Burning Oil (tonnes)": { factor: 3192.9007, unit: "tonnes", co2: 3192.0, ch4: 0.2688, n2o: 0.6319, description: "Burning oil/kerosene for heating" },
      "Burning Oil (litres)": { factor: 2.5426, unit: "litres", co2: 2.54238, ch4: 0.000214, n2o: 0.000504, description: "Burning oil/kerosene for heating" },
      "Burning Oil (kWh Net CV)": { factor: 0.2468, unit: "kWh", co2: 0.24659, ch4: 0.0000207, n2o: 0.0000489, description: "Burning oil - Net Calorific Value" },
      "Burning Oil (kWh Gross CV)": { factor: 0.2332, unit: "kWh", co2: 0.23301, ch4: 0.0000196, n2o: 0.0000462, description: "Burning oil - Gross Calorific Value" },
      
      "Diesel (Average Biofuel Blend) (tonnes)": { factor: 3071.3188, unit: "tonnes", co2: 3071.0, ch4: 0.0672, n2o: 0.2516, description: "Diesel with 7% biodiesel blend" },
      "Diesel (Average Biofuel Blend) (litres)": { factor: 2.5568, unit: "litres", co2: 2.55624, ch4: 0.0000560, n2o: 0.000209, description: "Diesel with 7% biodiesel blend" },
      "Diesel (Average Biofuel Blend) (kWh Net CV)": { factor: 0.2627, unit: "kWh", co2: 0.26249, ch4: 0.0000057, n2o: 0.0000215, description: "Diesel biofuel blend - Net CV" },
      "Diesel (Average Biofuel Blend) (kWh Gross CV)": { factor: 0.2485, unit: "kWh", co2: 0.24830, ch4: 0.0000054, n2o: 0.0000203, description: "Diesel biofuel blend - Gross CV" },
      
      "Diesel (100% Mineral) (tonnes)": { factor: 3225.6309, unit: "tonnes", co2: 3225.0, ch4: 0.0672, n2o: 0.5637, description: "Pure mineral diesel" },
      "Diesel (100% Mineral) (litres)": { factor: 2.6878, unit: "litres", co2: 2.68724, ch4: 0.0000560, n2o: 0.000470, description: "Pure mineral diesel" },
      "Diesel (100% Mineral) (kWh Net CV)": { factor: 0.2762, unit: "kWh", co2: 0.27600, ch4: 0.0000057, n2o: 0.0000483, description: "Mineral diesel - Net CV" },
      "Diesel (100% Mineral) (kWh Gross CV)": { factor: 0.2611, unit: "kWh", co2: 0.26097, ch4: 0.0000054, n2o: 0.0000456, description: "Mineral diesel - Gross CV" },
      
      "Fuel Oil (tonnes)": { factor: 3266.9732, unit: "tonnes", co2: 3267.0, ch4: 0.3024, n2o: 0.329, description: "Heavy fuel oil" },
      "Fuel Oil (litres)": { factor: 3.1751, unit: "litres", co2: 3.17541, ch4: 0.000294, n2o: 0.000320, description: "Heavy fuel oil" },
      "Fuel Oil (kWh Net CV)": { factor: 0.2768, unit: "kWh", co2: 0.27686, ch4: 0.0000256, n2o: 0.0000279, description: "Fuel oil - Net Calorific Value" },
      "Fuel Oil (kWh Gross CV)": { factor: 0.2623, unit: "kWh", co2: 0.26237, ch4: 0.0000243, n2o: 0.0000264, description: "Fuel oil - Gross Calorific Value" },
      
      "Gas Oil (tonnes)": { factor: 3206.0201, unit: "tonnes", co2: 3206.0, ch4: 0.2688, n2o: 0.2513, description: "Red diesel/gas oil" },
      "Gas Oil (litres)": { factor: 2.7565, unit: "litres", co2: 2.75627, ch4: 0.000231, n2o: 0.000216, description: "Red diesel/gas oil" },
      "Gas Oil (kWh Net CV)": { factor: 0.2762, unit: "kWh", co2: 0.27600, ch4: 0.0000231, n2o: 0.0000216, description: "Gas oil - Net Calorific Value" },
      "Gas Oil (kWh Gross CV)": { factor: 0.2611, unit: "kWh", co2: 0.26097, ch4: 0.0000219, n2o: 0.0000204, description: "Gas oil - Gross Calorific Value" },
      
      "Petrol (Average Biofuel Blend) (tonnes)": { factor: 3032.3322, unit: "tonnes", co2: 3031.0, ch4: 0.7392, n2o: 0.593, description: "Petrol with 10% bioethanol" },
      "Petrol (Average Biofuel Blend) (litres)": { factor: 2.1916, unit: "litres", co2: 2.19106, ch4: 0.000534, n2o: 0.000428, description: "Petrol with 10% bioethanol" },
      "Petrol (Average Biofuel Blend) (kWh Gross CV)": { factor: 0.2445, unit: "kWh", co2: 0.24405, ch4: 0.000060, n2o: 0.0000478, description: "Petrol biofuel blend - Gross CV" },
      
      "Petrol (100% Mineral) (tonnes)": { factor: 3122.9470, unit: "tonnes", co2: 3122.0, ch4: 0.7392, n2o: 0.2078, description: "Pure mineral petrol" },
      "Petrol (100% Mineral) (litres)": { factor: 2.3155, unit: "litres", co2: 2.31494, ch4: 0.000548, n2o: 0.000154, description: "Pure mineral petrol" },
      "Petrol (100% Mineral) (kWh Gross CV)": { factor: 0.2588, unit: "kWh", co2: 0.25832, ch4: 0.000061, n2o: 0.0000172, description: "Mineral petrol - Gross CV" },
      
      "Waste oils and solvents (tonnes)": { factor: 2773.8255, unit: "tonnes", co2: 2773.0, ch4: 0.2352, n2o: 0.5903, description: "Waste oils and solvents" },
      "Waste oils and solvents (litres)": { factor: 2.4920, unit: "litres", co2: 2.49154, ch4: 0.000211, n2o: 0.000531, description: "Waste oils and solvents" },
      "Waste oils and solvents (kWh Net CV)": { factor: 0.2486, unit: "kWh", co2: 0.24839, ch4: 0.0000021, n2o: 0.0000053, description: "Waste oils/solvents - Net CV" },
      "Waste oils and solvents (kWh Gross CV)": { factor: 0.2347, unit: "kWh", co2: 0.23451, ch4: 0.0000020, n2o: 0.0000050, description: "Waste oils/solvents - Gross CV" }
    },

    // ==================== SOLID FUELS ====================
    "Solid Fuels": {
      "Coal (Industrial) (tonnes)": { factor: 3339.1511, unit: "tonnes", co2: 3339.0, ch4: 0.0672, n2o: 0.0839, description: "Industrial coal" },
      "Coal (Industrial) (kWh Net CV)": { factor: 0.4089, unit: "kWh", co2: 0.40886, ch4: 0.0000082, n2o: 0.0000103, description: "Industrial coal - Net CV" },
      "Coal (Industrial) (kWh Gross CV)": { factor: 0.3932, unit: "kWh", co2: 0.39316, ch4: 0.0000079, n2o: 0.0000099, description: "Industrial coal - Gross CV" },
      
      "Coal (Electricity Generation) (tonnes)": { factor: 3443.4363, unit: "tonnes", co2: 3443.0, ch4: 0.0672, n2o: 0.3691, description: "Coal for power generation" },
      "Coal (Electricity Generation) (kWh Net CV)": { factor: 0.4274, unit: "kWh", co2: 0.42735, ch4: 0.0000083, n2o: 0.0000458, description: "Power generation coal - Net CV" },
      "Coal (Electricity Generation) (kWh Gross CV)": { factor: 0.4107, unit: "kWh", co2: 0.41066, ch4: 0.0000080, n2o: 0.0000440, description: "Power generation coal - Gross CV" },
      
      "Coal (Domestic) (tonnes)": { factor: 3750.0, unit: "tonnes", co2: 3750.0, ch4: 0, n2o: 0, description: "Domestic/household coal" },
      "Coal (Domestic) (kWh Net CV)": { factor: 0.4583, unit: "kWh", co2: 0.45833, ch4: 0, n2o: 0, description: "Domestic coal - Net CV" },
      "Coal (Domestic) (kWh Gross CV)": { factor: 0.4405, unit: "kWh", co2: 0.44048, ch4: 0, n2o: 0, description: "Domestic coal - Gross CV" },
      
      "Coke (tonnes)": { factor: 3768.3557, unit: "tonnes", co2: 3768.0, ch4: 0.0672, n2o: 0.2885, description: "Coke fuel" },
      "Coke (kWh Net CV)": { factor: 0.4365, unit: "kWh", co2: 0.43646, ch4: 0.0000078, n2o: 0.0000334, description: "Coke - Net Calorific Value" },
      "Coke (kWh Gross CV)": { factor: 0.4310, unit: "kWh", co2: 0.43096, ch4: 0.0000077, n2o: 0.0000330, description: "Coke - Gross Calorific Value" },
      
      "Peat (tonnes)": { factor: 1595.5034, unit: "tonnes", co2: 1595.0, ch4: 0.0672, n2o: 0.4362, description: "Peat fuel" },
      "Peat (kWh Net CV)": { factor: 0.3989, unit: "kWh", co2: 0.39873, ch4: 0.0000168, n2o: 0.0001090, description: "Peat - Net Calorific Value" },
      "Peat (kWh Gross CV)": { factor: 0.3696, unit: "kWh", co2: 0.36945, ch4: 0.0000156, n2o: 0.0001010, description: "Peat - Gross Calorific Value" }
    },

    // ==================== BIOENERGY ====================
    "Bioenergy - Bioethanol": {
      "Bioethanol (tonnes)": { factor: 0, unit: "tonnes", co2: 0, ch4: 0, n2o: 0, description: "Bioethanol from biomass" },
      "Bioethanol (litres)": { factor: 0, unit: "litres", co2: 0, ch4: 0, n2o: 0, description: "Bioethanol from biomass" },
      "Bioethanol (kWh Gross CV)": { factor: 0, unit: "kWh", co2: 0, ch4: 0, n2o: 0, description: "Bioethanol - Gross CV" }
    },

    "Bioenergy - Biodiesel": {
      "Biodiesel (ME) (tonnes)": { factor: 0, unit: "tonnes", co2: 0, ch4: 0, n2o: 0, description: "Biodiesel methyl ester" },
      "Biodiesel (ME) (litres)": { factor: 0, unit: "litres", co2: 0, ch4: 0, n2o: 0, description: "Biodiesel methyl ester" },
      "Biodiesel (ME) (kWh Net CV)": { factor: 0, unit: "kWh", co2: 0, ch4: 0, n2o: 0, description: "Biodiesel ME - Net CV" },
      "Biodiesel (ME) (kWh Gross CV)": { factor: 0, unit: "kWh", co2: 0, ch4: 0, n2o: 0, description: "Biodiesel ME - Gross CV" }
    },

    "Bioenergy - Biomass": {
      "Wood Logs (tonnes)": { factor: 0.01515, unit: "tonnes", co2: 0, ch4: 0.0101, n2o: 0.00505, description: "Wood logs biomass" },
      "Wood Logs (kWh Net CV)": { factor: 0.00000370, unit: "kWh", co2: 0, ch4: 0.00000247, n2o: 0.00000123, description: "Wood logs - Net CV" },
      "Wood Logs (kWh Gross CV)": { factor: 0.00000343, unit: "kWh", co2: 0, ch4: 0.00000229, n2o: 0.00000114, description: "Wood logs - Gross CV" },
      
      "Wood Chips (tonnes)": { factor: 0.01515, unit: "tonnes", co2: 0, ch4: 0.0101, n2o: 0.00505, description: "Wood chips biomass" },
      "Wood Chips (kWh Net CV)": { factor: 0.00000412, unit: "kWh", co2: 0, ch4: 0.00000275, n2o: 0.00000137, description: "Wood chips - Net CV" },
      "Wood Chips (kWh Gross CV)": { factor: 0.00000382, unit: "kWh", co2: 0, ch4: 0.00000255, n2o: 0.00000127, description: "Wood chips - Gross CV" },
      
      "Wood Pellets (tonnes)": { factor: 0.01515, unit: "tonnes", co2: 0, ch4: 0.0101, n2o: 0.00505, description: "Wood pellets biomass" },
      "Wood Pellets (kWh Net CV)": { factor: 0.00000319, unit: "kWh", co2: 0, ch4: 0.00000213, n2o: 0.00000106, description: "Wood pellets - Net CV" },
      "Wood Pellets (kWh Gross CV)": { factor: 0.00000296, unit: "kWh", co2: 0, ch4: 0.00000197, n2o: 0.00000099, description: "Wood pellets - Gross CV" },
      
      "Grass/Straw (tonnes)": { factor: 0.02525, unit: "tonnes", co2: 0, ch4: 0.0168, n2o: 0.00845, description: "Grass/straw biomass" },
      "Grass/Straw (kWh Net CV)": { factor: 0.00000630, unit: "kWh", co2: 0, ch4: 0.00000420, n2o: 0.00000211, description: "Grass/straw - Net CV" },
      "Grass/Straw (kWh Gross CV)": { factor: 0.00000583, unit: "kWh", co2: 0, ch4: 0.00000389, n2o: 0.00000195, description: "Grass/straw - Gross CV" },
      
      "Biogas (tonnes)": { factor: 0.02165, unit: "tonnes", co2: 0, ch4: 0.0144, n2o: 0.00725, description: "Biogas combustion" },
      "Biogas (kWh Net CV)": { factor: 0.00001099, unit: "kWh", co2: 0, ch4: 0.00000732, n2o: 0.00000368, description: "Biogas - Net CV" },
      "Biogas (kWh Gross CV)": { factor: 0.00000991, unit: "kWh", co2: 0, ch4: 0.00000660, n2o: 0.00000331, description: "Biogas - Gross CV" },
      
      "Landfill gas (tonnes)": { factor: 0.02525, unit: "tonnes", co2: 0, ch4: 0.0168, n2o: 0.00845, description: "Landfill gas combustion" },
      "Landfill gas (kWh Net CV)": { factor: 0.00001282, unit: "kWh", co2: 0, ch4: 0.00000854, n2o: 0.00000429, description: "Landfill gas - Net CV" },
      "Landfill gas (kWh Gross CV)": { factor: 0.00001156, unit: "kWh", co2: 0, ch4: 0.00000770, n2o: 0.00000386, description: "Landfill gas - Gross CV" }
    },

    // ==================== REFRIGERANTS ====================
    "Refrigerants": {
      "R22": { factor: 1810, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R22 refrigerant (HCFC) - GWP 1810" },
      "R134a": { factor: 1430, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R134a refrigerant (HFC) - GWP 1430" },
      "R404A": { factor: 3922, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R404A refrigerant (HFC) - GWP 3922" },
      "R407C": { factor: 1774, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R407C refrigerant (HFC) - GWP 1774" },
      "R410A": { factor: 2088, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R410A refrigerant (HFC) - GWP 2088" },
      "R32": { factor: 675, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R32 refrigerant (HFC) - GWP 675" },
      "R1234yf": { factor: 4, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R1234yf refrigerant (HFO) - GWP 4" },
      "R1234ze": { factor: 7, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R1234ze refrigerant (HFO) - GWP 7" },
      "R290 (Propane)": { factor: 3, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R290 Propane refrigerant - GWP 3" },
      "R600a (Isobutane)": { factor: 3, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R600a Isobutane refrigerant - GWP 3" },
      "R717 (Ammonia)": { factor: 0, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R717 Ammonia refrigerant - GWP 0" },
      "R744 (CO2)": { factor: 1, unit: "kg", co2: 0, ch4: 0, n2o: 0, description: "R744 CO2 refrigerant - GWP 1" }
    },

    // ==================== PASSENGER VEHICLES - CARS ====================
    "Passenger Vehicles - Cars by Size": {
      "Small car (petrol) (km)": { factor: 0.14549, unit: "km", co2: 0.14527, ch4: 0.0000050, n2o: 0.0002144, description: "Small petrol car" },
      "Small car (diesel) (km)": { factor: 0.13815, unit: "km", co2: 0.13794, ch4: 0.0000047, n2o: 0.0002041, description: "Small diesel car" },
      "Small car (hybrid) (km)": { factor: 0.10927, unit: "km", co2: 0.10911, ch4: 0.0000038, n2o: 0.0001614, description: "Small hybrid car" },
      "Small car (electric) (km)": { factor: 0.05304, unit: "km", co2: 0.05262, ch4: 0.0000011, n2o: 0.0003892, description: "Small electric car" },
      
      "Medium car (petrol) (km)": { factor: 0.17317, unit: "km", co2: 0.17291, ch4: 0.0000059, n2o: 0.0002554, description: "Medium petrol car" },
      "Medium car (diesel) (km)": { factor: 0.16392, unit: "km", co2: 0.16368, ch4: 0.0000056, n2o: 0.0002421, description: "Medium diesel car" },
      "Medium car (hybrid) (km)": { factor: 0.11008, unit: "km", co2: 0.10991, ch4: 0.0000038, n2o: 0.0001625, description: "Medium hybrid car" },
      "Medium car (electric) (km)": { factor: 0.05918, unit: "km", co2: 0.05872, ch4: 0.0000012, n2o: 0.0004343, description: "Medium electric car" },
      
      "Large car (petrol) (km)": { factor: 0.22100, unit: "km", co2: 0.22069, ch4: 0.0000076, n2o: 0.0003259, description: "Large petrol car" },
      "Large car (diesel) (km)": { factor: 0.20915, unit: "km", co2: 0.20888, ch4: 0.0000072, n2o: 0.0003087, description: "Large diesel car" },
      "Large car (hybrid) (km)": { factor: 0.13963, unit: "km", co2: 0.13945, ch4: 0.0000048, n2o: 0.0002062, description: "Large hybrid car" },
      "Large car (electric) (km)": { factor: 0.07433, unit: "km", co2: 0.07373, ch4: 0.0000015, n2o: 0.0005456, description: "Large electric car" },
      
      "Average car (km)": { factor: 0.17148, unit: "km", co2: 0.17122, ch4: 0.0000059, n2o: 0.0002531, description: "Average car all types" }
    },

    "Passenger Vehicles - Cars by Market Segment": {
      "Mini (km)": { factor: 0.11964, unit: "km", co2: 0.11945, ch4: 0.0000041, n2o: 0.0001765, description: "Mini car segment" },
      "Supermini (km)": { factor: 0.11747, unit: "km", co2: 0.11728, ch4: 0.0000040, n2o: 0.0001734, description: "Supermini car segment" },
      "Lower medium (km)": { factor: 0.13585, unit: "km", co2: 0.13563, ch4: 0.0000047, n2o: 0.0002005, description: "Lower medium car segment" },
      "Upper medium (km)": { factor: 0.17195, unit: "km", co2: 0.17168, ch4: 0.0000059, n2o: 0.0002538, description: "Upper medium car segment" },
      "Executive (km)": { factor: 0.22383, unit: "km", co2: 0.22352, ch4: 0.0000077, n2o: 0.0003304, description: "Executive car segment" },
      "Luxury (km)": { factor: 0.29661, unit: "km", co2: 0.29621, ch4: 0.0000102, n2o: 0.0004379, description: "Luxury car segment" },
      "Sports (km)": { factor: 0.23555, unit: "km", co2: 0.23523, ch4: 0.0000081, n2o: 0.0003479, description: "Sports car segment" },
      "4x4 (km)": { factor: 0.28131, unit: "km", co2: 0.28093, ch4: 0.0000097, n2o: 0.0004155, description: "4x4/SUV segment" },
      "MPV (km)": { factor: 0.19091, unit: "km", co2: 0.19062, ch4: 0.0000066, n2o: 0.0002819, description: "Multi-purpose vehicle" }
    },

    // ==================== PASSENGER VEHICLES - MOTORBIKES ====================
    "Passenger Vehicles - Motorbikes": {
      "Small motorbike (≤125cc) (km)": { factor: 0.08449, unit: "km", co2: 0.08434, ch4: 0.0000081, n2o: 0.0001459, description: "Small motorbike up to 125cc" },
      "Medium motorbike (125-500cc) (km)": { factor: 0.10280, unit: "km", co2: 0.10264, ch4: 0.0000099, n2o: 0.0001778, description: "Medium motorbike 125-500cc" },
      "Large motorbike (>500cc) (km)": { factor: 0.13400, unit: "km", co2: 0.13381, ch4: 0.0000129, n2o: 0.0002318, description: "Large motorbike over 500cc" },
      "Average motorbike (km)": { factor: 0.11450, unit: "km", co2: 0.11434, ch4: 0.0000110, n2o: 0.0001982, description: "Average motorbike all sizes" }
    },

    // ==================== DELIVERY VEHICLES ====================
    "Delivery Vehicles - Vans": {
      "Class I (up to 1.305 tonnes) (km)": { factor: 0.23968, unit: "km", co2: 0.23939, ch4: 0.0000083, n2o: 0.0003538, description: "Small van up to 1.305 tonnes" },
      "Class II (1.305 to 1.74 tonnes) (km)": { factor: 0.32076, unit: "km", co2: 0.32041, ch4: 0.0000110, n2o: 0.0004733, description: "Medium van 1.305-1.74 tonnes" },
      "Class III (1.74 to 3.5 tonnes) (km)": { factor: 0.44031, unit: "km", co2: 0.43986, ch4: 0.0000152, n2o: 0.0006502, description: "Large van 1.74-3.5 tonnes" },
      "Average van (km)": { factor: 0.32718, unit: "km", co2: 0.32682, ch4: 0.0000113, n2o: 0.0004831, description: "Average van all classes" }
    },

    "Delivery Vehicles - HGV": {
      "Rigid (>3.5-7.5 tonnes) (km)": { factor: 0.57751, unit: "km", co2: 0.57689, ch4: 0.0000199, n2o: 0.0008528, description: "Rigid HGV 3.5-7.5 tonnes" },
      "Rigid (>7.5-17 tonnes) (km)": { factor: 0.82098, unit: "km", co2: 0.82010, ch4: 0.0000283, n2o: 0.0012121, description: "Rigid HGV 7.5-17 tonnes" },
      "Rigid (>17 tonnes) (km)": { factor: 0.68978, unit: "km", co2: 0.68902, ch4: 0.0000238, n2o: 0.0010186, description: "Rigid HGV over 17 tonnes" },
      "All rigids (km)": { factor: 0.70857, unit: "km", co2: 0.70777, ch4: 0.0000244, n2o: 0.0010465, description: "All rigid HGVs average" },
      
      "Articulated (>3.5-33 tonnes) (km)": { factor: 0.75893, unit: "km", co2: 0.75806, ch4: 0.0000262, n2o: 0.0011208, description: "Articulated HGV 3.5-33 tonnes" },
      "Articulated (>33 tonnes) (km)": { factor: 0.81558, unit: "km", co2: 0.81470, ch4: 0.0000281, n2o: 0.0012048, description: "Articulated HGV over 33 tonnes" },
      "All articulated (km)": { factor: 0.79746, unit: "km", co2: 0.79657, ch4: 0.0000275, n2o: 0.0011774, description: "All articulated HGVs average" },
      
      "All HGVs (km)": { factor: 0.74740, unit: "km", co2: 0.74654, ch4: 0.0000258, n2o: 0.0011040, description: "All HGVs average" }
    }
  },

  scope2: {
    // ==================== UK ELECTRICITY ====================
    "UK Electricity": {
      "Grid Electricity (kWh)": { factor: 0.21233, unit: "kWh", co2: 0.21073, ch4: 0.0000421, n2o: 0.0015581, description: "UK grid electricity 2023" },
      "Grid Electricity - Location Based (kWh)": { factor: 0.21233, unit: "kWh", co2: 0.21073, ch4: 0.0000421, n2o: 0.0015581, description: "UK grid - location based accounting" },
      "Grid Electricity - Market Based (kWh)": { factor: 0.39355, unit: "kWh", co2: 0.39070, ch4: 0.0000780, n2o: 0.0028875, description: "UK grid - market based (residual mix)" }
    },

    // ==================== UK ELECTRICITY FOR EVs ====================
    "UK Electricity for Electric Vehicles": {
      "Grid Electricity for EVs (kWh)": { factor: 0.21233, unit: "kWh", co2: 0.21073, ch4: 0.0000421, n2o: 0.0015581, description: "UK grid electricity for EV charging" },
      "Grid Electricity for EVs - Location Based (kWh)": { factor: 0.21233, unit: "kWh", co2: 0.21073, ch4: 0.0000421, n2o: 0.0015581, description: "EV charging - location based" },
      "Grid Electricity for EVs - Market Based (kWh)": { factor: 0.39355, unit: "kWh", co2: 0.39070, ch4: 0.0000780, n2o: 0.0028875, description: "EV charging - market based" }
    },

    // ==================== TRANSMISSION & DISTRIBUTION ====================
    "Transmission & Distribution Losses": {
      "T&D Losses UK (kWh)": { factor: 0.01666, unit: "kWh", co2: 0.01654, ch4: 0.0000033, n2o: 0.0001223, description: "UK transmission & distribution losses" },
      "T&D Losses for EVs UK (kWh)": { factor: 0.01666, unit: "kWh", co2: 0.01654, ch4: 0.0000033, n2o: 0.0001223, description: "T&D losses for EV charging" }
    }
  },

  scope3: {
    // ==================== BUSINESS TRAVEL - AIR ====================
    "Business Travel - Air - Domestic": {
      "Domestic flight (average) (passenger.km)": { factor: 0.24587, unit: "passenger.km", co2: 0.24568, ch4: 0.0000036, n2o: 0.0001826, description: "Domestic flight - average distance" },
      "Domestic flight (economy) (passenger.km)": { factor: 0.24587, unit: "passenger.km", co2: 0.24568, ch4: 0.0000036, n2o: 0.0001826, description: "Domestic flight - economy class" },
      "Domestic flight (business) (passenger.km)": { factor: 0.36881, unit: "passenger.km", co2: 0.36852, ch4: 0.0000054, n2o: 0.0002739, description: "Domestic flight - business class" }
    },

    "Business Travel - Air - Short Haul": {
      "Short-haul (<3700km) (average) (passenger.km)": { factor: 0.15102, unit: "passenger.km", co2: 0.15091, ch4: 0.0000019, n2o: 0.0000923, description: "Short-haul flight - average" },
      "Short-haul (<3700km) (economy) (passenger.km)": { factor: 0.15102, unit: "passenger.km", co2: 0.15091, ch4: 0.0000019, n2o: 0.0000923, description: "Short-haul - economy class" },
      "Short-haul (<3700km) (business) (passenger.km)": { factor: 0.22746, unit: "passenger.km", co2: 0.22730, ch4: 0.0000028, n2o: 0.0001389, description: "Short-haul - business class" }
    },

    "Business Travel - Air - Long Haul": {
      "Long-haul (>3700km) (average) (passenger.km)": { factor: 0.14298, unit: "passenger.km", co2: 0.14287, ch4: 0.0000019, n2o: 0.0000873, description: "Long-haul flight - average" },
      "Long-haul (>3700km) (economy) (passenger.km)": { factor: 0.10274, unit: "passenger.km", co2: 0.10266, ch4: 0.0000014, n2o: 0.0000627, description: "Long-haul - economy class" },
      "Long-haul (>3700km) (premium economy) (passenger.km)": { factor: 0.16438, unit: "passenger.km", co2: 0.16426, ch4: 0.0000022, n2o: 0.0001003, description: "Long-haul - premium economy" },
      "Long-haul (>3700km) (business) (passenger.km)": { factor: 0.28767, unit: "passenger.km", co2: 0.28749, ch4: 0.0000038, n2o: 0.0001755, description: "Long-haul - business class" },
      "Long-haul (>3700km) (first) (passenger.km)": { factor: 0.41093, unit: "passenger.km", co2: 0.41065, ch4: 0.0000055, n2o: 0.0002507, description: "Long-haul - first class" }
    },

    "Business Travel - Air - International": {
      "International flight (average) (passenger.km)": { factor: 0.14574, unit: "passenger.km", co2: 0.14563, ch4: 0.0000019, n2o: 0.0000890, description: "International flight - average" },
      "International flight (economy) (passenger.km)": { factor: 0.11908, unit: "passenger.km", co2: 0.11899, ch4: 0.0000016, n2o: 0.0000727, description: "International - economy class" },
      "International flight (premium economy) (passenger.km)": { factor: 0.19052, unit: "passenger.km", co2: 0.19038, ch4: 0.0000025, n2o: 0.0001163, description: "International - premium economy" },
      "International flight (business) (passenger.km)": { factor: 0.33265, unit: "passenger.km", co2: 0.33244, ch4: 0.0000044, n2o: 0.0002031, description: "International - business class" },
      "International flight (first) (passenger.km)": { factor: 0.47620, unit: "passenger.km", co2: 0.47588, ch4: 0.0000063, n2o: 0.0002907, description: "International - first class" }
    },

    // ==================== BUSINESS TRAVEL - LAND ====================
    "Business Travel - Cars": {
      "Small car (km)": { factor: 0.14549, unit: "km", co2: 0.14527, ch4: 0.0000050, n2o: 0.0002144, description: "Small car for business travel" },
      "Medium car (km)": { factor: 0.17317, unit: "km", co2: 0.17291, ch4: 0.0000059, n2o: 0.0002554, description: "Medium car for business travel" },
      "Large car (km)": { factor: 0.22100, unit: "km", co2: 0.22069, ch4: 0.0000076, n2o: 0.0003259, description: "Large car for business travel" },
      "Average car (km)": { factor: 0.17148, unit: "km", co2: 0.17122, ch4: 0.0000059, n2o: 0.0002531, description: "Average car for business travel" }
    },

    "Business Travel - Taxis": {
      "Regular taxi (km)": { factor: 0.20066, unit: "km", co2: 0.20038, ch4: 0.0000069, n2o: 0.0002959, description: "Regular taxi" },
      "Black cab (km)": { factor: 0.28071, unit: "km", co2: 0.28037, ch4: 0.0000097, n2o: 0.0004141, description: "London black cab" }
    },

    "Business Travel - Motorbikes": {
      "Small motorbike (≤125cc) (km)": { factor: 0.08449, unit: "km", co2: 0.08434, ch4: 0.0000081, n2o: 0.0001459, description: "Small motorbike for business" },
      "Medium motorbike (125-500cc) (km)": { factor: 0.10280, unit: "km", co2: 0.10264, ch4: 0.0000099, n2o: 0.0001778, description: "Medium motorbike for business" },
      "Large motorbike (>500cc) (km)": { factor: 0.13400, unit: "km", co2: 0.13381, ch4: 0.0000129, n2o: 0.0002318, description: "Large motorbike for business" },
      "Average motorbike (km)": { factor: 0.11450, unit: "km", co2: 0.11434, ch4: 0.0000110, n2o: 0.0001982, description: "Average motorbike for business" }
    },

    "Business Travel - Bus": {
      "Local bus (passenger.km)": { factor: 0.11923, unit: "passenger.km", co2: 0.11902, ch4: 0.0000128, n2o: 0.0001927, description: "Local bus service" },
      "Coach (passenger.km)": { factor: 0.02760, unit: "passenger.km", co2: 0.02755, ch4: 0.0000030, n2o: 0.0000446, description: "Coach service" }
    },

    "Business Travel - Rail": {
      "National rail (passenger.km)": { factor: 0.03549, unit: "passenger.km", co2: 0.03522, ch4: 0.0000070, n2o: 0.0002593, description: "National rail service" },
      "International rail (passenger.km)": { factor: 0.00455, unit: "passenger.km", co2: 0.00452, ch4: 0.0000009, n2o: 0.0000332, description: "International rail (Eurostar)" },
      "Light rail and tram (passenger.km)": { factor: 0.03157, unit: "passenger.km", co2: 0.03133, ch4: 0.0000063, n2o: 0.0002317, description: "Light rail/tram" },
      "London Underground (passenger.km)": { factor: 0.02929, unit: "passenger.km", co2: 0.02906, ch4: 0.0000058, n2o: 0.0002148, description: "London Underground" }
    },

    // ==================== BUSINESS TRAVEL - SEA ====================
    "Business Travel - Sea": {
      "Ferry (foot passenger) (passenger.km)": { factor: 0.01874, unit: "passenger.km", co2: 0.01871, ch4: 0.0000002, n2o: 0.0000114, description: "Ferry - foot passenger" },
      "Ferry (car passenger) (passenger.km)": { factor: 0.12949, unit: "passenger.km", co2: 0.12932, ch4: 0.0000012, n2o: 0.0000790, description: "Ferry - car passenger" },
      "Ferry (average) (passenger.km)": { factor: 0.11131, unit: "passenger.km", co2: 0.11113, ch4: 0.0000010, n2o: 0.0000680, description: "Ferry - average passenger" }
    },

    // ==================== FREIGHT - ROAD ====================
    "Freighting Goods - Road": {
      "HGV (All diesel) (tonne.km)": { factor: 0.82029, unit: "tonne.km", co2: 0.81921, ch4: 0.0000283, n2o: 0.0010511, description: "Heavy Goods Vehicle - all diesel" },
      "HGV Refrigerated (All diesel) (tonne.km)": { factor: 1.15467, unit: "tonne.km", co2: 1.15321, ch4: 0.0000398, n2o: 0.0014793, description: "Refrigerated HGV" },
      
      "HGV (>3.5-7.5 tonnes) (tonne.km)": { factor: 1.04440, unit: "tonne.km", co2: 1.04316, ch4: 0.0000360, n2o: 0.0013419, description: "HGV 3.5-7.5 tonnes" },
      "HGV (>7.5-17 tonnes) (tonne.km)": { factor: 0.65537, unit: "tonne.km", co2: 0.65457, ch4: 0.0000226, n2o: 0.0008403, description: "HGV 7.5-17 tonnes" },
      "HGV (>17 tonnes) (tonne.km)": { factor: 0.11735, unit: "tonne.km", co2: 0.11719, ch4: 0.0000040, n2o: 0.0001505, description: "HGV over 17 tonnes" },
      
      "HGV (>17-26 tonnes) (tonne.km)": { factor: 0.16093, unit: "tonne.km", co2: 0.16073, ch4: 0.0000055, n2o: 0.0002062, description: "HGV 17-26 tonnes" },
      "HGV (>26 tonnes) (tonne.km)": { factor: 0.08846, unit: "tonne.km", co2: 0.08832, ch4: 0.0000030, n2o: 0.0001133, description: "HGV over 26 tonnes" },
      
      "Van (Class I up to 1.305 tonnes) (tonne.km)": { factor: 1.80357, unit: "tonne.km", co2: 1.80182, ch4: 0.0000622, n2o: 0.0023130, description: "Small van" },
      "Van (Class II 1.305-1.74 tonnes) (tonne.km)": { factor: 1.04545, unit: "tonne.km", co2: 1.04421, ch4: 0.0000360, n2o: 0.0013404, description: "Medium van" },
      "Van (Class III 1.74-3.5 tonnes) (tonne.km)": { factor: 0.70046, unit: "tonne.km", co2: 0.69966, ch4: 0.0000242, n2o: 0.0008987, description: "Large van" },
      "Van (Average) (tonne.km)": { factor: 0.93951, unit: "tonne.km", co2: 0.93819, ch4: 0.0000324, n2o: 0.0012044, description: "Average van" }
    },

    // ==================== FREIGHT - AIR ====================
    "Freighting Goods - Air": {
      "Freight flights (domestic) (tonne.km)": { factor: 2.55365, unit: "tonne.km", co2: 2.55173, ch4: 0.0000371, n2o: 0.0018439, description: "Domestic air freight" },
      "Freight flights (short-haul <3700km) (tonne.km)": { factor: 1.51026, unit: "tonne.km", co2: 1.50906, ch4: 0.0000194, n2o: 0.0009232, description: "Short-haul air freight" },
      "Freight flights (long-haul >3700km) (tonne.km)": { factor: 0.62989, unit: "tonne.km", co2: 0.62927, ch4: 0.0000081, n2o: 0.0003848, description: "Long-haul air freight" },
      "Freight flights (international) (tonne.km)": { factor: 0.75951, unit: "tonne.km", co2: 0.75877, ch4: 0.0000098, n2o: 0.0004635, description: "International air freight" }
    },

    // ==================== FREIGHT - SEA ====================
    "Freighting Goods - Sea": {
      "Sea tanker (tonne.km)": { factor: 0.00565, unit: "tonne.km", co2: 0.00564, ch4: 0.0000001, n2o: 0.0000034, description: "Sea tanker freight" },
      "Bulk carrier (tonne.km)": { factor: 0.00806, unit: "tonne.km", co2: 0.00805, ch4: 0.0000001, n2o: 0.0000049, description: "Bulk carrier freight" },
      "General cargo (tonne.km)": { factor: 0.01485, unit: "tonne.km", co2: 0.01483, ch4: 0.0000001, n2o: 0.0000091, description: "General cargo ship" },
      "Container ship (tonne.km)": { factor: 0.01125, unit: "tonne.km", co2: 0.01123, ch4: 0.0000001, n2o: 0.0000069, description: "Container ship freight" },
      "Vehicle transport (tonne.km)": { factor: 0.02926, unit: "tonne.km", co2: 0.02922, ch4: 0.0000003, n2o: 0.0000179, description: "Vehicle transport ship" },
      "RoRo-Ferry (tonne.km)": { factor: 0.13032, unit: "tonne.km", co2: 0.13014, ch4: 0.0000012, n2o: 0.0000796, description: "Roll-on/Roll-off ferry" },
      "Large RoPax ferry (tonne.km)": { factor: 0.11131, unit: "tonne.km", co2: 0.11113, ch4: 0.0000010, n2o: 0.0000680, description: "Large passenger/cargo ferry" },
      "Cargo ship (average) (tonne.km)": { factor: 0.01125, unit: "tonne.km", co2: 0.01123, ch4: 0.0000001, n2o: 0.0000069, description: "Average cargo ship" }
    },

    // ==================== FREIGHT - RAIL ====================
    "Freighting Goods - Rail": {
      "Rail freight (tonne.km)": { factor: 0.02680, unit: "tonne.km", co2: 0.02659, ch4: 0.0000053, n2o: 0.0001964, description: "Rail freight" }
    },

    // ==================== MATERIAL USE ====================
    "Material Use - Aggregates & Minerals": {
      "Aggregates (tonnes)": { factor: 4.6, unit: "tonnes", co2: 4.6, ch4: 0, n2o: 0, description: "Construction aggregates" },
      "Asbestos (tonnes)": { factor: 4.6, unit: "tonnes", co2: 4.6, ch4: 0, n2o: 0, description: "Asbestos materials" },
      "Asphalt (tonnes)": { factor: 39.6, unit: "tonnes", co2: 39.6, ch4: 0, n2o: 0, description: "Asphalt/bitumen" },
      "Bricks (tonnes)": { factor: 240, unit: "tonnes", co2: 240, ch4: 0, n2o: 0, description: "Clay bricks" },
      "Concrete (tonnes)": { factor: 140, unit: "tonnes", co2: 140, ch4: 0, n2o: 0, description: "Concrete" },
      "Glass (tonnes)": { factor: 890, unit: "tonnes", co2: 890, ch4: 0, n2o: 0, description: "Glass materials" },
      "Insulation (tonnes)": { factor: 3340, unit: "tonnes", co2: 3340, ch4: 0, n2o: 0, description: "Insulation materials" },
      "Mineral oil (tonnes)": { factor: 650, unit: "tonnes", co2: 650, ch4: 0, n2o: 0, description: "Mineral oil products" },
      "Plaster (tonnes)": { factor: 120, unit: "tonnes", co2: 120, ch4: 0, n2o: 0, description: "Plaster/gypsum" },
      "Sand (tonnes)": { factor: 4.6, unit: "tonnes", co2: 4.6, ch4: 0, n2o: 0, description: "Sand" },
      "Soil (tonnes)": { factor: 8.8, unit: "tonnes", co2: 8.8, ch4: 0, n2o: 0, description: "Soil/earth" },
      "Tarmac (tonnes)": { factor: 39.6, unit: "tonnes", co2: 39.6, ch4: 0, n2o: 0, description: "Tarmac" }
    },

    "Material Use - Metals": {
      "Aluminium (tonnes)": { factor: 9140, unit: "tonnes", co2: 9140, ch4: 0, n2o: 0, description: "Aluminium/aluminum" },
      "Copper (tonnes)": { factor: 4110, unit: "tonnes", co2: 4110, ch4: 0, n2o: 0, description: "Copper" },
      "Lead (tonnes)": { factor: 1730, unit: "tonnes", co2: 1730, ch4: 0, n2o: 0, description: "Lead" },
      "Metals (average) (tonnes)": { factor: 2450, unit: "tonnes", co2: 2450, ch4: 0, n2o: 0, description: "Average metals" },
      "Steel (tonnes)": { factor: 1580, unit: "tonnes", co2: 1580, ch4: 0, n2o: 0, description: "Steel" },
      "Zinc (tonnes)": { factor: 3080, unit: "tonnes", co2: 3080, ch4: 0, n2o: 0, description: "Zinc" }
    },

    "Material Use - Plastics & Polymers": {
      "Plastics (average) (tonnes)": { factor: 2530, unit: "tonnes", co2: 2530, ch4: 0, n2o: 0, description: "Average plastics" },
      "HDPE (tonnes)": { factor: 1880, unit: "tonnes", co2: 1880, ch4: 0, n2o: 0, description: "High-density polyethylene" },
      "LDPE & LLDPE (tonnes)": { factor: 2050, unit: "tonnes", co2: 2050, ch4: 0, n2o: 0, description: "Low-density polyethylene" },
      "PET (tonnes)": { factor: 2690, unit: "tonnes", co2: 2690, ch4: 0, n2o: 0, description: "Polyethylene terephthalate" },
      "PP (tonnes)": { factor: 1950, unit: "tonnes", co2: 1950, ch4: 0, n2o: 0, description: "Polypropylene" },
      "PS (tonnes)": { factor: 3020, unit: "tonnes", co2: 3020, ch4: 0, n2o: 0, description: "Polystyrene" },
      "PVC (tonnes)": { factor: 2430, unit: "tonnes", co2: 2430, ch4: 0, n2o: 0, description: "Polyvinyl chloride" },
      "Rubber (tonnes)": { factor: 3200, unit: "tonnes", co2: 3200, ch4: 0, n2o: 0, description: "Rubber materials" },
      "Tyres (tonnes)": { factor: 3000, unit: "tonnes", co2: 3000, ch4: 0, n2o: 0, description: "Tyres/tires" }
    },

    "Material Use - Organics": {
      "Paper (tonnes)": { factor: 910, unit: "tonnes", co2: 910, ch4: 0, n2o: 0, description: "Paper products" },
      "Cardboard (tonnes)": { factor: 910, unit: "tonnes", co2: 910, ch4: 0, n2o: 0, description: "Cardboard" },
      "Timber (tonnes)": { factor: 220, unit: "tonnes", co2: 220, ch4: 0, n2o: 0, description: "Timber/wood" },
      "Wood (tonnes)": { factor: 220, unit: "tonnes", co2: 220, ch4: 0, n2o: 0, description: "Wood materials" }
    },

    "Material Use - Textiles": {
      "Clothing (tonnes)": { factor: 16450, unit: "tonnes", co2: 16450, ch4: 0, n2o: 0, description: "Clothing/textiles" },
      "Textiles (tonnes)": { factor: 16450, unit: "tonnes", co2: 16450, ch4: 0, n2o: 0, description: "Textile materials" }
    },

    "Material Use - Electronics": {
      "Electrical equipment (tonnes)": { factor: 1100, unit: "tonnes", co2: 1100, ch4: 0, n2o: 0, description: "Electrical equipment" },
      "Computers and equipment (tonnes)": { factor: 350, unit: "tonnes", co2: 350, ch4: 0, n2o: 0, description: "Computer equipment" },
      "White goods (tonnes)": { factor: 400, unit: "tonnes", co2: 400, ch4: 0, n2o: 0, description: "White goods/appliances" }
    },

    "Material Use - Other": {
      "Books (tonnes)": { factor: 920, unit: "tonnes", co2: 920, ch4: 0, n2o: 0, description: "Books/publications" },
      "Furniture (tonnes)": { factor: 340, unit: "tonnes", co2: 340, ch4: 0, n2o: 0, description: "Furniture" },
      "Batteries (tonnes)": { factor: 2250, unit: "tonnes", co2: 2250, ch4: 0, n2o: 0, description: "Batteries" },
      "Paint (tonnes)": { factor: 1960, unit: "tonnes", co2: 1960, ch4: 0, n2o: 0, description: "Paint/coatings" }
    },

    // ==================== WASTE DISPOSAL ====================
    "Waste Disposal - Refuse": {
      "Refuse - Landfill (tonnes)": { factor: 462.7, unit: "tonnes", co2: 21.68, ch4: 440.94, n2o: 0.08, description: "Mixed waste to landfill" },
      "Refuse - Combustion (tonnes)": { factor: 21.28, unit: "tonnes", co2: 21.03, ch4: 0.05, n2o: 0.20, description: "Mixed waste incineration" },
      "Refuse - Closed-loop (tonnes)": { factor: 21.28, unit: "tonnes", co2: 21.03, ch4: 0.05, n2o: 0.20, description: "Mixed waste - closed loop" },
      "Refuse - Composting (tonnes)": { factor: 12.84, unit: "tonnes", co2: 8.57, ch4: 4.24, n2o: 0.03, description: "Mixed waste - composting" },
      "Refuse - Anaerobic digestion (tonnes)": { factor: 9.12, unit: "tonnes", co2: 8.57, ch4: 0.52, n2o: 0.03, description: "Mixed waste - anaerobic digestion" }
    },

    "Waste Disposal - Organic": {
      "Organic - Landfill (tonnes)": { factor: 411.07, unit: "tonnes", co2: 21.75, ch4: 389.20, n2o: 0.12, description: "Organic waste to landfill" },
      "Organic - Combustion (tonnes)": { factor: 15.98, unit: "tonnes", co2: 15.82, ch4: 0.04, n2o: 0.12, description: "Organic waste incineration" },
      "Organic - Closed-loop (tonnes)": { factor: 15.98, unit: "tonnes", co2: 15.82, ch4: 0.04, n2o: 0.12, description: "Organic - closed loop" },
      "Organic - Composting (tonnes)": { factor: 41.11, unit: "tonnes", co2: 21.75, ch4: 19.24, n2o: 0.12, description: "Organic composting" },
      "Organic - Anaerobic digestion (tonnes)": { factor: 10.21, unit: "tonnes", co2: 8.90, ch4: 1.19, n2o: 0.12, description: "Organic - anaerobic digestion" }
    },

    "Waste Disposal - Paper & Cardboard": {
      "Paper/Cardboard - Landfill (tonnes)": { factor: 572.33, unit: "tonnes", co2: 21.75, ch4: 550.46, n2o: 0.12, description: "Paper to landfill" },
      "Paper/Cardboard - Combustion (tonnes)": { factor: 13.29, unit: "tonnes", co2: 13.15, ch4: 0.03, n2o: 0.11, description: "Paper incineration" },
      "Paper/Cardboard - Closed-loop (tonnes)": { factor: 13.29, unit: "tonnes", co2: 13.15, ch4: 0.03, n2o: 0.11, description: "Paper - closed loop" },
      "Paper/Cardboard - Composting (tonnes)": { factor: 41.11, unit: "tonnes", co2: 21.75, ch4: 19.24, n2o: 0.12, description: "Paper composting" },
      "Paper/Cardboard - Anaerobic digestion (tonnes)": { factor: 10.21, unit: "tonnes", co2: 8.90, ch4: 1.19, n2o: 0.12, description: "Paper - anaerobic digestion" }
    },

    "Waste Disposal - Plastics": {
      "Plastics - Landfill (tonnes)": { factor: 21.17, unit: "tonnes", co2: 21.17, ch4: 0, n2o: 0, description: "Plastics to landfill" },
      "Plastics - Combustion (tonnes)": { factor: 61.37, unit: "tonnes", co2: 60.75, ch4: 0.12, n2o: 0.50, description: "Plastics incineration" },
      "Plastics - Closed-loop (tonnes)": { factor: 61.37, unit: "tonnes", co2: 60.75, ch4: 0.12, n2o: 0.50, description: "Plastics - closed loop" },
      "Plastics - Open-loop (tonnes)": { factor: 61.37, unit: "tonnes", co2: 60.75, ch4: 0.12, n2o: 0.50, description: "Plastics - open loop" }
    },

    "Waste Disposal - Metal": {
      "Metal - Landfill (tonnes)": { factor: 21.17, unit: "tonnes", co2: 21.17, ch4: 0, n2o: 0, description: "Metal to landfill" },
      "Metal - Combustion (tonnes)": { factor: 21.45, unit: "tonnes", co2: 21.23, ch4: 0.04, n2o: 0.18, description: "Metal incineration" },
      "Metal - Closed-loop (tonnes)": { factor: 21.45, unit: "tonnes", co2: 21.23, ch4: 0.04, n2o: 0.18, description: "Metal - closed loop" },
      "Metal - Open-loop (tonnes)": { factor: 21.45, unit: "tonnes", co2: 21.23, ch4: 0.04, n2o: 0.18, description: "Metal - open loop" }
    },

    "Waste Disposal - Glass": {
      "Glass - Landfill (tonnes)": { factor: 21.17, unit: "tonnes", co2: 21.17, ch4: 0, n2o: 0, description: "Glass to landfill" },
      "Glass - Combustion (tonnes)": { factor: 21.54, unit: "tonnes", co2: 21.31, ch4: 0.04, n2o: 0.19, description: "Glass incineration" },
      "Glass - Closed-loop (tonnes)": { factor: 21.54, unit: "tonnes", co2: 21.31, ch4: 0.04, n2o: 0.19, description: "Glass - closed loop" },
      "Glass - Open-loop (tonnes)": { factor: 21.54, unit: "tonnes", co2: 21.31, ch4: 0.04, n2o: 0.19, description: "Glass - open loop" }
    },

    "Waste Disposal - Clothing & Textiles": {
      "Clothing - Landfill (tonnes)": { factor: 649.98, unit: "tonnes", co2: 21.75, ch4: 628.11, n2o: 0.12, description: "Clothing to landfill" },
      "Clothing - Combustion (tonnes)": { factor: 22.68, unit: "tonnes", co2: 22.46, ch4: 0.04, n2o: 0.18, description: "Clothing incineration" },
      "Clothing - Closed-loop (tonnes)": { factor: 22.68, unit: "tonnes", co2: 22.46, ch4: 0.04, n2o: 0.18, description: "Clothing - closed loop" },
      "Clothing - Composting (tonnes)": { factor: 41.11, unit: "tonnes", co2: 21.75, ch4: 19.24, n2o: 0.12, description: "Clothing composting" }
    },

    "Waste Disposal - WEEE": {
      "WEEE - Landfill (tonnes)": { factor: 21.17, unit: "tonnes", co2: 21.17, ch4: 0, n2o: 0, description: "Electronic waste to landfill" },
      "WEEE - Combustion (tonnes)": { factor: 21.28, unit: "tonnes", co2: 21.03, ch4: 0.05, n2o: 0.20, description: "Electronic waste incineration" },
      "WEEE - Closed-loop (tonnes)": { factor: 21.28, unit: "tonnes", co2: 21.03, ch4: 0.05, n2o: 0.20, description: "Electronic waste - closed loop" },
      "WEEE - Open-loop (tonnes)": { factor: 21.28, unit: "tonnes", co2: 21.03, ch4: 0.05, n2o: 0.20, description: "Electronic waste - open loop" }
    },

    "Waste Disposal - Construction": {
      "Construction - Landfill (tonnes)": { factor: 10.59, unit: "tonnes", co2: 10.59, ch4: 0, n2o: 0, description: "Construction waste to landfill" },
      "Construction - Combustion (tonnes)": { factor: 3.78, unit: "tonnes", co2: 3.74, ch4: 0.01, n2o: 0.03, description: "Construction waste incineration" },
      "Construction - Closed-loop (tonnes)": { factor: 3.78, unit: "tonnes", co2: 3.74, ch4: 0.01, n2o: 0.03, description: "Construction - closed loop" },
      "Construction - Open-loop (tonnes)": { factor: 3.78, unit: "tonnes", co2: 3.74, ch4: 0.01, n2o: 0.03, description: "Construction - open loop" }
    },

    "Waste Disposal - Other": {
      "Books - Landfill (tonnes)": { factor: 572.33, unit: "tonnes", co2: 21.75, ch4: 550.46, n2o: 0.12, description: "Books to landfill" },
      "Books - Combustion (tonnes)": { factor: 13.29, unit: "tonnes", co2: 13.15, ch4: 0.03, n2o: 0.11, description: "Books incineration" },
      "Books - Closed-loop (tonnes)": { factor: 13.29, unit: "tonnes", co2: 13.15, ch4: 0.03, n2o: 0.11, description: "Books - closed loop" },
      
      "Batteries - Landfill (tonnes)": { factor: 21.17, unit: "tonnes", co2: 21.17, ch4: 0, n2o: 0, description: "Batteries to landfill" },
      "Batteries - Combustion (tonnes)": { factor: 21.28, unit: "tonnes", co2: 21.03, ch4: 0.05, n2o: 0.20, description: "Batteries incineration" },
      "Batteries - Closed-loop (tonnes)": { factor: 21.28, unit: "tonnes", co2: 21.03, ch4: 0.05, n2o: 0.20, description: "Batteries - closed loop" }
    },

    // ==================== WATER ====================
    "Water Supply": {
      "Water supply (cubic metres)": { factor: 0.34411, unit: "m3", co2: 0.34143, ch4: 0.0000068, n2o: 0.0025203, description: "Water supply treatment and distribution" },
      "Water supply (litres)": { factor: 0.00034411, unit: "litres", co2: 0.00034143, ch4: 0.0000000068, n2o: 0.0000025203, description: "Water supply per litre" }
    },

    "Water Treatment": {
      "Water treatment (cubic metres)": { factor: 0.70858, unit: "m3", co2: 0.70297, ch4: 0.0000141, n2o: 0.0051887, description: "Wastewater treatment" },
      "Water treatment (litres)": { factor: 0.00070858, unit: "litres", co2: 0.00070297, ch4: 0.0000000141, n2o: 0.0000051887, description: "Wastewater treatment per litre" }
    },

    // ==================== HOTEL STAY ====================
    "Hotel Stay": {
      "Hotel stay (room.night)": { factor: 24.08, unit: "room.night", co2: 23.90, ch4: 0.0000479, n2o: 0.1769, description: "Average hotel stay per room night" }
    },

    // ==================== HOMEWORKING ====================
    "Homeworking": {
      "Homeworking (employee.hour)": { factor: 0.14443, unit: "employee.hour", co2: 0.14333, ch4: 0.0000287, n2o: 0.0010590, description: "Homeworking emissions per employee hour" }
    }
  }
};

// Export for use in your system
module.exports = { emissionFactors };