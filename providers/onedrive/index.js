require('cross-fetch/polyfill');
const {Client} = require('@microsoft/microsoft-graph-client');
const {RefreshTokenAuthProvider} = require('./authprovider');

const config = require('../../config.json');

const client = Client.initWithMiddleware({
  authProvider: new RefreshTokenAuthProvider(
      config.clientId,
      config.clientSecret,
      config.refreshToken,
      config.redirectUri,
      'Files.Read',
  ),
});

/**
 * list children of a path
 * @param {string} path normalized and not URI encoded path
 * @param {string[]} select
 */
exports.listChildren = async function(path,
    select = ['lastModifiedDateTime', 'name', 'size', 'folder']) {
  const encodedPath = path === '/' ? '' : ':' + encodeURIComponent(path) + ':';
  const res = await client.api(`/me/drive/root${encodedPath}/children`)
      .select(select).get();
  return res;
};

exports.getItem = async function(path) {
  const res = await client.api(`/me/drive/root:${encodeURIComponent(path)}`)
      .get();
  return res;
};
