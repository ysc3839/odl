require('cross-fetch/polyfill');
const HttpsProxyAgent = require('https-proxy-agent');

if (global.fetch) {
  const _fetch = global.fetch;
  global.fetch = function(url, opts) {
    if (opts && !opts.agent) {
      const proxy = process.env.http_proxy;
      if (proxy) {
        opts.agent = new HttpsProxyAgent(proxy);
      }
    }
    return _fetch(url, opts);
  };
}
