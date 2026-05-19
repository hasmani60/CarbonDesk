/** Parse API / user date values without UTC day-shift on YYYY-MM-DD strings. */
export function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'string') {
    const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) {
      const d = new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Display date as DD-MM-YYYY */
export function formatDate(value) {
  const d = parseDate(value);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/** Display date and time as DD-MM-YYYY, HH:mm (24-hour) */
export function formatDateTime(value) {
  const d = parseDate(value);
  if (!d) return '';
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${formatDate(d)}, ${time}`;
}

/** HTML date input value (always YYYY-MM-DD internally) */
export function toDateInputValue(value) {
  const d = parseDate(value);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Period label for filters / reports */
export function formatPeriodRange(start, end, separator = ' – ') {
  if (start && end) return `${formatDate(start)}${separator}${formatDate(end)}`;
  if (start) return formatDate(start);
  if (end) return formatDate(end);
  return '';
}

export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return '0';
  return parseFloat(value).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};
