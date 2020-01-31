require('cross-fetch/polyfill');
const {URLSearchParams} = require('url');

exports.RefreshTokenAuthProvider = class {
  /**
   * @param {string} clientId
   * @param {string} clientSecret
   * @param {string} refreshToken
   * @param {string} redirectUri
   * @param {string} scope
   * @param {string} tenant
   */
  constructor(clientId, clientSecret, refreshToken, redirectUri, scope = 'https://graph.microsoft.com/.default', tenant = 'common') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.redirectUri = redirectUri;
    this.scope = scope;
    this.tenant = tenant;
    this.token = null;
    this.expiresAt = 0;
  }
  async getAccessToken() {
    if (!this.token || Date.now() >= this.expiresAt) {
      const params = new URLSearchParams({
        client_id: this.clientId,
        scope: this.scope,
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        redirect_uri: this.redirectUri,
      });
      // client_secret is optional for public clients
      if (this.clientSecret) params.append('client_secret', this.clientSecret);
      const res = await fetch(`https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        body: params,
      });
      if (res.ok) {
        const json = await res.json();
        this.token = json.access_token;
        this.expiresAt = Date.now() + (json.expires_in - 10) * 1000;
      } else {
        throw res;
      }
    }
    return this.token;
  }
};

/**
 * For use with client credentials grant flow
 * https://docs.microsoft.com/en-us/graph/auth-v2-service
 */
exports.ClientCredAuthProvider = class {
  /**
   * @param {string} clientId
   * @param {string} clientSecret
   * @param {string} tenant
   * @param {string} scope
   */
  constructor(clientId, clientSecret, tenant = 'common', scope = 'https://graph.microsoft.com/.default') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tenant = tenant;
    this.scope = scope;
    this.token = null;
    this.expiresAt = 0;
  }
  async getAccessToken() {
    if (!this.token || Date.now() >= this.expiresAt) {
      const res = await fetch(`https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`, {
        method: 'POST',
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        this.token = json.access_token;
        this.expiresAt = Date.now() + (json.expires_in - 10) * 1000;
      } else {
        throw res;
      }
    }
    return this.token;
  }
};
