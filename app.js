const express = require('express');
const path = require('path');
const normalize = require('normalize-path');

const provider = require('./providers/onedrive');

const app = express();

app.set('views', './themes/nginx');
app.set('view engine', 'ejs');

app.use(function(req, res, next) {
  const prefix = '/:';
  if (req.url.slice(0, prefix.length) === prefix) {
    req.url = '/' + req.url.slice(prefix.length);
    res.json('special:' + req.url);
  } else {
    next();
  }
});

/**
 * check if str has any invalid character
 * @param {string} str
 * @return {boolean}
 */
function hasInvalidChar(str) {
  const invalidChars = ':*?"<>|';
  for (let i = 0; i < str.length; ++i) {
    if (invalidChars.indexOf(str.charAt(i)) !== -1) {
      return true;
    }
  }
  return false;
}

app.use(function(req, res, next) {
  if (req.method !== 'GET') {
    res.locals.status = '405 Method Not Allowed';
    res.locals.server = 'odl';
    res.status(405).render('error');
    return;
  }
  if (hasInvalidChar(req.path)) {
    res.locals.status = '404 Not Found';
    res.locals.server = 'odl';
    res.status(404).render('error');
    return;
  }
  const normalizedPath = path.posix.normalize(normalize(req.path, false));
  if (normalizedPath !== req.path) {
    res.redirect(301, normalizedPath);
    return;
  }
  next();
});

/**
 * async function wrapper for error handling
 * @param {function} fn
 * @return {function}
 */
function wrap(fn) {
  return function(...args) {
    fn(...args).catch(args[2]);
  };
}

app.use(wrap(async function(req, res, next) {
  if (req.path.slice(-1) === '/') {
    const files = await provider.listChildren(req.path);
    res.locals.url = req.url;
    res.locals.path = req.path;
    res.locals.files = files.value;
    res.render('index');
  } else {
    const item = await provider.getItem(req.path);
    const downloadUrl = item['@microsoft.graph.downloadUrl'];
    if (downloadUrl) {
      res.redirect(downloadUrl);
    }
  }
}));

module.exports = app;
