require('cross-fetch/polyfill');
const {FileNotFoundError, NotDirError} = require('../errors');
const {Client, GraphError, BatchRequestContent, BatchResponseContent,
  PageIterator} = require('@microsoft/microsoft-graph-client');
const {RefreshTokenAuthProvider} = require('./authprovider');
const LRU = require('lru-cache');
const posixPath = require('path').posix;
const encodeUriKeepSlash = require('../../encodeuri-keepslash');

const config = require('../../config').providerConf;
const cache = new LRU(config.cache);

const client = Client.initWithMiddleware({
  authProvider: new RefreshTokenAuthProvider(
      config.clientId,
      config.clientSecret,
      config.refreshToken,
      config.redirectUri,
      'Files.Read',
  ),
});

async function batchRequest(reqs) {
  const steps = reqs.map(function(value, index) {
    return {
      id: (index + 1).toString(),
      request: value,
    };
  });
  const batchRequestContent = new BatchRequestContent(steps);
  const content = await batchRequestContent.getContent();
  const res = await client.api('/$batch').post(content);
  return new BatchResponseContent(res);
}

function checkResponse(res) {
  if (!res.ok) {
    if (res.status === 404) {
      throw new FileNotFoundError(res);
    }
    throw new Error(res);
  }
}

function convertFileInfo(file) {
  const info = {
    name: file.name,
    size: file.size,
    lastModified: +new Date(file.lastModifiedDateTime),
    isDir: file.folder !== undefined,
  };
  const downloadUrl = file['@microsoft.graph.downloadUrl'];
  if (downloadUrl) {
    info.downloadUrl = downloadUrl;
  }
  return info;
}

/**
 * list children of a path
 * @param {string} path normalized, trailing slashes stripped
 *   and not URI encoded path
 * @param {string[]} select
 */
exports.listChildren = async function(path) {
  if (!path) path = '/';
  let files = cache.get(path);
  if (files === false) { // not a dir
    throw new NotDirError(path);
  } else if (files === undefined) {
    const encodedPath = (path === '/') ? '' :
      ':' + encodeUriKeepSlash(path) + ':';
    const batchRes = await batchRequest([
      new Request(`/me/drive/root${encodedPath}?$select=folder`),
      new Request(`/me/drive/root${encodedPath}/children` +
        '?select=name,size,lastModifiedDateTime,folder,' +
        '@microsoft.graph.downloadUrl'),
    ]);

    const infoRes = batchRes.getResponseById('1');
    checkResponse(infoRes);
    const childrenRes = batchRes.getResponseById('2');
    checkResponse(childrenRes);

    const info = await infoRes.json();
    const isDir = (info.folder !== undefined);
    if (!isDir) {
      cache.set(path, false); // not a dir
      throw new NotDirError(path);
    }

    files = [];
    (new PageIterator(client, await childrenRes.json(), function(item) {
      files.push(convertFileInfo(item));
      return true;
    })).iterate();

    cache.set(path, files);
  }
  return files;
};

exports.getItem = async function(path) {
  const parentDir = posixPath.dirname(path);
  const files = cache.get(parentDir);
  if (files) {
    const fileName = posixPath.basename(path);
    let file;
    for (let i = 0; i < files.length; ++i) {
      if (files[i].name === fileName) {
        file = files[i];
        break;
      }
    }
    if (!file) throw new FileNotFoundError(path);
    return file;
  }

  try {
    const file = await client.api(
        `/me/drive/root:${encodeUriKeepSlash(path)}`).get();
    return convertFileInfo(file);
  } catch (e) {
    if (e instanceof GraphError && e.statusCode === 404) {
      throw new FileNotFoundError(e);
    } else {
      throw e;
    }
  }
};
