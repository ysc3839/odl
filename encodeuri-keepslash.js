module.exports = function(str) {
  return str.split('/').map(encodeURIComponent).join('/');
};
