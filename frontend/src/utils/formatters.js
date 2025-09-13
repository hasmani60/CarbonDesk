export const formatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined) return '0';
    return parseFloat(value).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  
  export const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  };
  
  export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };