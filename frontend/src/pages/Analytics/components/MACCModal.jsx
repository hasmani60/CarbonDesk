import { useState } from 'react';

export default function MACCModal({ onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Energy Efficiency',
    abatementPotential: '',
    costPerTon: '',
    paybackPeriod: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const abatement = parseFloat(formData.abatementPotential);
    const cost = parseFloat(formData.costPerTon);
    const totalCost = abatement * cost;
    let priority = 'low';
    if (cost < 0) priority = 'high';
    else if (cost < 50) priority = 'medium';

    onSave({
      ...formData,
      abatementPotential: abatement,
      costPerTon: cost,
      totalCost,
      paybackPeriod: formData.paybackPeriod ? parseFloat(formData.paybackPeriod) : null,
      priority
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-600 max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add MACC opportunity</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 form-stack">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
            >
              <option>Energy Efficiency</option>
              <option>Renewable Energy</option>
              <option>Process Optimization</option>
              <option>Fuel Switching</option>
              <option>Waste Reduction</option>
              <option>Supply Chain</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Abatement (tCO₂e/year)
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={formData.abatementPotential}
              onChange={(e) => setFormData({ ...formData, abatementPotential: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cost per tCO₂e ($)
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={formData.costPerTon}
              onChange={(e) => setFormData({ ...formData, costPerTon: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg"
            >
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
