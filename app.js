const express = require('express');
const path = require('path');
const normalize = require('normalize-path');

const {FileNotFoundError} = require('./providers/errors');
const provider = require('./providers/onedrive');

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.disable('x-powered-by');
} else {
  require('./fetch-proxy');
}

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
 * render error page
 * @param {Express.Response} res
 * @param {number} status
 * @param {string} message
 * @param {string=} title
 */
function renderErrorPage(res, status, message, title) {
  if (!title) {
    title = message;
  }
  if (!res.headersSent) {
    res.status(status);
  }
  res.render('error', {title: title, message: message, server: 'odl'});
}

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
    return renderErrorPage(res, 405, '405 Method Not Allowed');
  }
  if (hasInvalidChar(req.path)) {
    return renderErrorPage(res, 404, '404 Not Found');
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
  try {
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
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      return renderErrorPage(res, 404, '404 Not Found');
    } else {
      throw e;
    }
  }
}));

module.exports = app;
