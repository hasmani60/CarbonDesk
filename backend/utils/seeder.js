const mongoose = require('mongoose');
const { User, Emission } = require('../models');

const seedDatabase = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Emission.deleteMany({});

    // Create sample user
    const user = await User.create({
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'password123',
      role: 'admin'
    });

    // Create sample emissions
    await Emission.create({
      user: user._id,
      scope: 1,
      category: 'Fuel Combustion',
      activityType: 'Diesel Generator',
      source: 'Diesel',
      amount: 1000,
      unit: 'litres',
      emissionFactor: 2.68,
      accountingPeriod: {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31')
      }
    });

    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/carbon-accounting')
    .then(() => seedDatabase());
}

module.exports = seedDatabase;