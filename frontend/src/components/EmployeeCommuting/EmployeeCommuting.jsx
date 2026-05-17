import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  CalendarCheck,
  Plus,
  Pencil,
  UserX,
  Save,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { employeesAPI } from '../../services/api';
import {
  TRANSPORT_MODES,
  FUEL_BASED_MODES,
  formatCommuteMode,
} from '../../utils/commuteModes';
import toast from 'react-hot-toast';

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  name: '',
  employee_id: '',
  home_to_office_distance_km: '',
  transport_mode: 'personal_car_petrol',
  vehicle_number: '',
  vehicle_fuel_efficiency_kmpl: ''
});

const EmployeeCommuting = () => {
  const { user } = useAuth();
  const role = user?.role || 'viewer';
  const canManage = ['admin', 'analyst'].includes(role);
  const canMarkAttendance = ['admin', 'analyst', 'contributor'].includes(role);
  const readOnly = role === 'viewer';

  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [attendanceDate, setAttendanceDate] = useState(todayISO());
  const [attendanceMap, setAttendanceMap] = useState({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const data = await employeesAPI.list({ includeInactive: canManage });
      setEmployees(Array.isArray(data) ? data : data?.employees || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load employees');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const loadAttendance = useCallback(async () => {
    if (!attendanceDate) return;
    try {
      setAttendanceLoading(true);
      const records = await employeesAPI.getAttendance(attendanceDate);
      const list = Array.isArray(records) ? records : [];
      const map = {};
      list.forEach((r) => {
        map[r.employee_id] = r.is_present;
      });
      setAttendanceMap(map);
    } catch {
      setAttendanceMap({});
    } finally {
      setAttendanceLoading(false);
    }
  }, [attendanceDate]);

  useEffect(() => {
    if (tab === 'attendance') {
      loadAttendance();
    }
  }, [tab, loadAttendance]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      name: emp.name || '',
      employee_id: emp.employee_id || '',
      home_to_office_distance_km: String(emp.home_to_office_distance_km ?? ''),
      transport_mode: emp.transport_mode || 'personal_car_petrol',
      vehicle_number: emp.vehicle_number || '',
      vehicle_fuel_efficiency_kmpl:
        emp.vehicle_fuel_efficiency_kmpl != null
          ? String(emp.vehicle_fuel_efficiency_kmpl)
          : ''
    });
    setModalOpen(true);
  };

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    if (readOnly || !canManage) return;

    const payload = {
      name: form.name.trim(),
      employee_id: form.employee_id.trim(),
      home_to_office_distance_km: parseFloat(form.home_to_office_distance_km),
      transport_mode: form.transport_mode,
      vehicle_number: form.vehicle_number.trim()
    };

    if (FUEL_BASED_MODES.has(form.transport_mode)) {
      payload.vehicle_fuel_efficiency_kmpl = parseFloat(form.vehicle_fuel_efficiency_kmpl);
    }

    try {
      setSaving(true);
      if (editing?.id || editing?._id) {
        await employeesAPI.update(editing.id || editing._id, payload);
        toast.success('Employee updated');
      } else {
        await employeesAPI.create(payload);
        toast.success('Employee added');
      }
      setModalOpen(false);
      loadEmployees();
    } catch (err) {
      toast.error(err.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (emp) => {
    if (!canManage) return;
    if (!window.confirm(`Deactivate ${emp.name}? Attendance history will be kept.`)) return;
    try {
      await employeesAPI.remove(emp.id || emp._id);
      toast.success('Employee deactivated');
      loadEmployees();
    } catch (err) {
      toast.error(err.message || 'Failed to deactivate');
    }
  };

  const activeEmployees = employees.filter((e) => e.is_active !== false);

  const saveAttendance = async () => {
    if (!canMarkAttendance) return;
    const records = activeEmployees.map((emp) => ({
      employee_id: emp.id || emp._id,
      is_present: Boolean(attendanceMap[emp.id || emp._id])
    }));

    try {
      setSaving(true);
      await employeesAPI.bulkAttendance({
        date: attendanceDate,
        records
      });
      toast.success('Attendance saved');
      loadAttendance();
    } catch (err) {
      toast.error(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const markAllPresent = () => {
    const map = {};
    activeEmployees.forEach((emp) => {
      map[emp.id || emp._id] = true;
    });
    setAttendanceMap(map);
  };

  const tabs = [
    { id: 'employees', label: 'Manage Employees', icon: Users },
    { id: 'attendance', label: 'Mark Attendance', icon: CalendarCheck }
  ];

  return (
    <div className="border rounded-lg border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900/50 overflow-hidden mb-6">
      <div className="p-4 border-b border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚗</span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Employee Commuting</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Scope 3 Category 7 — manage employees and daily attendance
              </p>
            </div>
          </div>
          <Link
            to="/analytics"
            className="inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 hover:underline"
          >
            <BarChart3 className="w-4 h-4" />
            View emissions in Analytics
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                tab === id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {tab === 'employees' && (
          <>
            {canManage && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={openAdd}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Employee
                </button>
              </div>
            )}
            {loading ? (
              <p className="text-sm text-gray-500 py-8 text-center">Loading employees…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b dark:border-slate-700">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Employee ID</th>
                      <th className="py-2 pr-3">Distance (km)</th>
                      <th className="py-2 pr-3">Mode</th>
                      <th className="py-2 pr-3">Vehicle</th>
                      <th className="py-2 pr-3">km/L</th>
                      <th className="py-2 pr-3">Status</th>
                      {canManage && <th className="py-2">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id || emp._id} className="border-b dark:border-slate-800">
                        <td className="py-2 pr-3 font-medium">{emp.name}</td>
                        <td className="py-2 pr-3">{emp.employee_id || '—'}</td>
                        <td className="py-2 pr-3">{emp.home_to_office_distance_km}</td>
                        <td className="py-2 pr-3">{formatCommuteMode(emp.transport_mode)}</td>
                        <td className="py-2 pr-3">{emp.vehicle_number || '—'}</td>
                        <td className="py-2 pr-3">{emp.vehicle_fuel_efficiency_kmpl ?? '—'}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              emp.is_active !== false
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {emp.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {canManage && (
                          <td className="py-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(emp)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {emp.is_active !== false && (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(emp)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Deactivate"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {employees.length === 0 && (
                  <p className="text-center text-gray-500 py-6">No employees yet. Add your first employee.</p>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'attendance' && (
          <>
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <label className="text-sm">
                <span className="block text-gray-600 dark:text-gray-400 mb-1">Date</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  disabled={readOnly}
                  className="border rounded-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-600"
                />
              </label>
              {canMarkAttendance && (
                <>
                  <button
                    type="button"
                    onClick={markAllPresent}
                    className="px-3 py-2 text-sm border border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-50"
                  >
                    Mark All Present
                  </button>
                  <button
                    type="button"
                    onClick={saveAttendance}
                    disabled={saving || activeEmployees.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Save Attendance
                  </button>
                </>
              )}
            </div>
            {attendanceLoading ? (
              <p className="text-sm text-gray-500 py-6 text-center">Loading attendance…</p>
            ) : activeEmployees.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">Add active employees first.</p>
            ) : (
              <div className="space-y-2">
                {activeEmployees.map((emp) => {
                  const id = emp.id || emp._id;
                  const present = attendanceMap[id] === true;
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between p-3 rounded-lg border dark:border-slate-700"
                    >
                      <span className="font-medium">{emp.name}</span>
                      <div className="flex rounded-lg overflow-hidden border dark:border-slate-600">
                        <button
                          type="button"
                          disabled={readOnly || !canMarkAttendance}
                          onClick={() => setAttendanceMap((m) => ({ ...m, [id]: true }))}
                          className={`px-4 py-1.5 text-sm ${
                            present ? 'bg-emerald-600 text-white' : 'bg-gray-50 dark:bg-slate-800'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          disabled={readOnly || !canMarkAttendance}
                          onClick={() => setAttendanceMap((m) => ({ ...m, [id]: false }))}
                          className={`px-4 py-1.5 text-sm ${
                            !present ? 'bg-gray-600 text-white' : 'bg-gray-50 dark:bg-slate-800'
                          }`}
                        >
                          Absent
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
            <h4 className="text-lg font-semibold mb-4">
              {editing ? 'Edit Employee' : 'Add Employee'}
            </h4>
            <form onSubmit={handleSaveEmployee} className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 border rounded-lg px-3 py-2 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Employee ID (HR code)</label>
                <input
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  className="w-full mt-1 border rounded-lg px-3 py-2 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">One-way distance (km) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.home_to_office_distance_km}
                  onChange={(e) =>
                    setForm({ ...form, home_to_office_distance_km: e.target.value })
                  }
                  className="w-full mt-1 border rounded-lg px-3 py-2 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Transport mode *</label>
                <select
                  value={form.transport_mode}
                  onChange={(e) => setForm({ ...form, transport_mode: e.target.value })}
                  className="w-full mt-1 border rounded-lg px-3 py-2 dark:bg-slate-800"
                >
                  {TRANSPORT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              {FUEL_BASED_MODES.has(form.transport_mode) && (
                <>
                  <div>
                    <label className="text-sm text-gray-600">Vehicle number</label>
                    <input
                      value={form.vehicle_number}
                      onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                      className="w-full mt-1 border rounded-lg px-3 py-2 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Fuel efficiency (km/L) *</label>
                    <input
                      required
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={form.vehicle_fuel_efficiency_kmpl}
                      onChange={(e) =>
                        setForm({ ...form, vehicle_fuel_efficiency_kmpl: e.target.value })
                      }
                      className="w-full mt-1 border rounded-lg px-3 py-2 dark:bg-slate-800"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeCommuting;
