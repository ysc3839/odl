const express = require('express');
const posixPath = require('path').posix;
const normalize = require('normalize-path');
const encodeUriKeepSlash = require('./encodeuri-keepslash');

const config = require('./config');
const {FileNotFoundError, NotDirError} = require('./providers/errors');
const provider = require('./providers/' + config.provider);

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.disable('x-powered-by');
} else {
  require('./fetch-proxy');
}

app.set('views', './themes/' + config.theme);
app.set('view engine', 'ejs');

// special pages, url starts with '/:'
app.use(function(req, res, next) {
  const prefix = '/:';
  if (req.url.slice(0, prefix.length) === prefix) {
    req.url = '/' + req.url.slice(prefix.length);
    res.status(404).end();
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
  try {
    const path = decodeURIComponent(req.path);
    if (hasInvalidChar(path)) {
      return renderErrorPage(res, 404, '404 Not Found');
    }
    const normalizedPath = encodeUriKeepSlash(
        posixPath.normalize(normalize(path, false)));
    if (normalizedPath !== req.path) {
      res.redirect(301, normalizedPath);
      return;
    }
  } catch (e) {
    if (e instanceof URIError) {
      return renderErrorPage(res, 400, '400 Bad Request');
    } else {
      throw e;
    }
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
    const path = decodeURIComponent(req.path);
    if (path.slice(-1) === '/') {
      const files = await provider.listChildren(path.slice(0, -1));
      res.locals.path = path;
      res.locals.files = files;
      res.render('index');
    } else {
      const file = await provider.getItem(path);
      if (file.isDir) {
        res.redirect(req.path + '/');
        return;
      }
      if (file.downloadUrl) {
        res.redirect(file.downloadUrl);
      } else {
        throw new FileNotFoundError(path);
      }
    }
  } catch (e) {
    if (e instanceof FileNotFoundError || e instanceof NotDirError) {
      return renderErrorPage(res, 404, '404 Not Found');
    } else {
      throw e;
    }
  }
}));

module.exports = app;

if (!module.parent) {
  const port = parseInt(process.env.PORT || 3000, 10);
  app.listen(port, function() {
    console.log(`odl started on port ${port}`);
  });
}
