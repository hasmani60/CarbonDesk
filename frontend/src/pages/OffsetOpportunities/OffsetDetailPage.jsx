import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Download,
  Trash2,
  FileText,
  History,
  Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/PageHeader/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { offsetsAPI } from '../../services/api';
import OffsetFormModal, { emptyOffsetForm } from './components/OffsetFormModal';
import {
  formatOffsetType,
  formatOffsetUnit,
  formatOffsetStatus,
  statusBadgeClass,
  DOCUMENT_TYPES
} from '../../utils/offsetConstants';

async function downloadWithAuth(url, filename) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function OffsetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = ['admin', 'analyst'].includes(user?.role);

  const [offset, setOffset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyOffsetForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('certificate');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await offsetsAPI.getById(id);
      setOffset(data);
    } catch (err) {
      toast.error(err.message || 'Not found');
      navigate('/offset-opportunities');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = () => {
    if (!offset) return;
    setForm({
      offset_name: offset.offset_name || '',
      offset_type: offset.offset_type || 'carbon_credit',
      certificate_number: offset.certificate_number || '',
      issuing_authority: offset.issuing_authority || '',
      vintage_year: offset.vintage_year || '',
      expiry_date: offset.expiry_date ? offset.expiry_date.slice(0, 10) : '',
      reporting_year: offset.reporting_year || '',
      applicable_scopes: offset.applicable_scopes || [1, 2, 3],
      total_quantity: String(offset.total_quantity ?? ''),
      unit: offset.unit || 'tco2e',
      notes: offset.notes || ''
    });
    setFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await offsetsAPI.update(id, {
        ...form,
        reporting_year: parseInt(form.reporting_year, 10),
        total_quantity: parseFloat(form.total_quantity),
        vintage_year: form.vintage_year ? parseInt(form.vintage_year, 10) : undefined,
        expiry_date: form.expiry_date || undefined
      });
      toast.success('Updated');
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length || !canWrite) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    fd.append('document_type', docType);
    setUploading(true);
    try {
      await offsetsAPI.uploadDocuments(id, fd);
      toast.success('Documents uploaded');
      load();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (doc) => {
    try {
      await downloadWithAuth(
        offsetsAPI.downloadDocumentUrl(id, doc.id),
        doc.original_name
      );
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Remove this document?')) return;
    try {
      await offsetsAPI.deleteDocument(id, docId);
      toast.success('Document removed');
      load();
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  const fmtQty = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });

  if (loading) {
    return <p className="p-8 text-center text-gray-500">Loading…</p>;
  }
  if (!offset) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title={offset.offset_name}
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Offset Opportunities', href: '/offset-opportunities' },
          { label: offset.offset_name }
        ]}
        action={
          canWrite && (
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-violet-300 text-violet-700 rounded-lg"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )
        }
      />

      <Link
        to="/offset-opportunities"
        className="inline-flex items-center gap-1 text-sm text-violet-600 hover:underline -mt-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to list
      </Link>

      <div className="app-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusBadgeClass(offset.status)}`}
            >
              {formatOffsetStatus(offset.status)}
            </span>
            <p className="mt-2 text-sm text-gray-500">{formatOffsetType(offset.offset_type)}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Total</p>
              <p className="font-semibold tabular-nums">
                {fmtQty(offset.total_quantity)} {formatOffsetUnit(offset.unit)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Available</p>
              <p className="font-semibold text-emerald-600 tabular-nums">
                {fmtQty(offset.available_quantity)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Utilized</p>
              <p className="font-semibold tabular-nums">{fmtQty(offset.utilized_quantity)}</p>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt className="text-gray-500">Certificate number</dt>
            <dd className="font-medium">{offset.certificate_number}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Issuing authority</dt>
            <dd>{offset.issuing_authority || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Vintage year</dt>
            <dd>{offset.vintage_year || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Reporting year</dt>
            <dd>{offset.reporting_year}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Expiry</dt>
            <dd>
              {offset.expiry_date ? new Date(offset.expiry_date).toLocaleDateString() : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Applicable scopes</dt>
            <dd>Scope {(offset.applicable_scopes || []).join(', ') || '—'}</dd>
          </div>
          {offset.notes && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Notes</dt>
              <dd className="mt-1 text-gray-700 dark:text-gray-300">{offset.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="app-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            Documents
          </h3>
          {canWrite && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="px-3 py-2 text-sm border rounded-lg dark:bg-slate-800"
              >
                {DOCUMENT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg cursor-pointer hover:bg-violet-700">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload files'}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          )}
        </div>
        {!offset.documents?.length ? (
          <p className="text-sm text-gray-500">No documents uploaded.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700">
            {offset.documents.map((doc) => (
              <li key={doc.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{doc.original_name}</p>
                  <p className="text-xs text-gray-500">
                    {(doc.size_bytes / 1024).toFixed(1)} KB · {doc.document_type}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="app-card p-6">
        <h3 className="font-semibold mb-4">Utilization history</h3>
        {!offset.utilizations?.length ? (
          <p className="text-sm text-gray-500">No utilizations recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Reporting year</th>
                  <th className="text-right py-2">Quantity</th>
                  <th className="text-left py-2">Applied by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {offset.utilizations.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2">{new Date(u.createdAt).toLocaleString()}</td>
                    <td>{u.reporting_year}</td>
                    <td className="text-right tabular-nums">
                      {fmtQty(u.quantity_applied)} {formatOffsetUnit(u.unit)}
                    </td>
                    <td className="text-gray-500">{u.applied_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="app-card p-6">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-violet-600" />
          Activity log
        </h3>
        {!offset.activity_log?.length ? (
          <p className="text-sm text-gray-500">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {offset.activity_log.map((entry, i) => (
              <li
                key={entry._id || i}
                className="text-sm border-l-2 border-violet-300 pl-3 py-1"
              >
                <p className="font-medium capitalize">{entry.action.replace(/_/g, ' ')}</p>
                {entry.details && <p className="text-gray-500">{entry.details}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  {entry.user_email || 'System'} ·{' '}
                  {entry.created_at
                    ? new Date(entry.created_at).toLocaleString()
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <OffsetFormModal
        open={formOpen}
        editing={offset}
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSave}
      />
    </div>
  );
}
