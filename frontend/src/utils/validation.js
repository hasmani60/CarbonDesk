export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  export const validatePassword = (password) => {
    return password && password.length >= 6;
  };
  
  export const validateRequired = (value) => {
    return value && value.toString().trim().length > 0;
  };
  
  export const validateNumber = (value, min = 0) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min;
  };