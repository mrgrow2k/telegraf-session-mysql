const debug = require('debug')('telegraf:session-redis');
const mysql = require('mysql');

class MySQLSession {
  constructor (options, SQLconnection) {
    this.options = Object.assign({
      property: 'session',
      table: 'sessions',
      getSessionKey: (ctx) => ctx.from && ctx.chat && `${ctx.from.id}:${ctx.chat.id}`,
      store: {},
    }, options);

    
    if (typeof SQLconnection === 'function') this.client = SQLconnection;
    else this.client = mysql.createPool(this.options);

    /* CREATE SESSION TABLE IF NOT EXISTS */
    this.client.query(`CREATE TABLE IF NOT EXISTS ${this.options.table} ( id varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL, session longtext COLLATE utf8mb4_unicode_ci NOT NULL, PRIMARY KEY (id) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
  }

  getSession (key) {
    return new Promise((resolve, reject) => {
      this.client.query(`SELECT session FROM ${this.options.table} WHERE id = ?`, [key], (err, json) => {
        if (err) return reject(err);
        if (json) {
          try {
            const session = JSON.parse(json);
            debug('session state', key, session);
            resolve(session);
          } catch (error) {
            debug('Parse session state failed', error);
          }
        }
        resolve({});
      });
    });
  }

  clearSession (key) {
    debug('clear session', key);
    return new Promise((resolve, reject) => {
      this.client.query(`DELETE FROM ${this.options.table} WHERE id = ?`, [key], (err, json) => {
        if (err) { return reject(err); }
        resolve();
      });
    });
  }

  saveSession (key, session) {
    if (!session || Object.keys(session).length === 0) {
      return this.clearSession(key);
    }
    debug('save session', key, session);
    const sessionString = JSON.stringify(session);
    return new Promise((resolve, reject) => {
      this.client.query(`INSERT INTO ${this.options.table} (id,session) VALUE(?,?) ON DUPLICATE KEY UPDATE session = ? `, [key, sessionString, sessionString], (err, json) => {
        if (err) { return reject(err); }
        resolve({});
      });
    });
  }

  middleware () {
    return (ctx, next) => {
      const key = this.options.getSessionKey(ctx);
      if (!key) return next();
      return this.getSession(key).then((session) => {
        debug('session snapshot', key, session);
        Object.defineProperty(ctx, this.options.property, {
          get: function () { return session; },
          set: function (newValue) { session = Object.assign({}, newValue); },
        });
        return next().then(middlewareData => this.saveSession(key, session).then(() => middlewareData));
      });
    };
  }
}

module.exports = MySQLSession;
