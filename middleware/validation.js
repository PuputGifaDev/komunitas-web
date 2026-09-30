const validator = require('validator');

const validateEmail = (email) => validator.isEmail(email);

const validatePassword = (password) => {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
};

const validateUsername = (username) => {
  return username.length >= 3 && /^[a-zA-Z0-9_-]+$/.test(username);
};

const validateArticle = (data) => {
  const errors = [];
  
  if (!data.title || data.title.length < 5) {
    errors.push('Judul minimal 5 karakter');
  }
  
  if (!data.content || data.content.length < 20) {
    errors.push('Konten minimal 20 karakter');
  }
  
  return errors;
};

const validateEvent = (data) => {
  const errors = [];
  
  if (!data.title || data.title.length < 5) {
    errors.push('Judul minimal 5 karakter');
  }
  
  if (!data.description || data.description.length < 20) {
    errors.push('Deskripsi minimal 20 karakter');
  }
  
  if (!data.date_start) {
    errors.push('Tanggal mulai harus diisi');
  }
  
  return errors;
};

const validateContact = (data) => {
  const errors = [];
  
  if (!data.name || data.name.length < 3) {
    errors.push('Nama minimal 3 karakter');
  }
  
  if (!validateEmail(data.email)) {
    errors.push('Format email tidak valid');
  }
  
  if (!data.subject || data.subject.length < 3) {
    errors.push('Subjek minimal 3 karakter');
  }
  
  if (!data.message || data.message.length < 10) {
    errors.push('Pesan minimal 10 karakter');
  }
  
  return errors;
};

module.exports = {
  validateEmail,
  validatePassword,
  validateUsername,
  validateArticle,
  validateEvent,
  validateContact
};
