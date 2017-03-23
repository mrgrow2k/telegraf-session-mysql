const debug = require('debug')('telegraf:session-mysql')
const mysql = require('promise-mysql')

class MySQLSession {

  constructor (options) {
    this.options = Object.assign({
      property: 'session',
      getSessionKey: (ctx) => {
        if (!ctx.from || !ctx.chat) {
          return
        }
        return `${ctx.from.id}:${ctx.chat.id}`
      },
      store: {}
    }, options)

    this.client = mysql.createPool(this.options)
  }

  getSession (key) {
    return this.client.query('SELECT session FROM sessions WHERE id="' + key + '"')
      .then((json) => {
        debug('select query', json)
        let session = {}
        if (json && json.length) {
          try {
            debug('JSON: ', json)
            session = JSON.parse(unescape(json[0].session))
            debug('session state', session)
          } catch (error) {
            debug('Parse session state failed', error)
          }
        }
        return session
      })
  }

  saveSession (key, session) {
    if (!session || Object.keys(session).length === 0) {
      debug('clear session')
      return this.client.query('DELETE FROM sessions WHERE id="' + key + '"')
    }

    debug('save session', session, 'key', key)

    const sessionString = escape(JSON.stringify(session))
    return this.client.query('INSERT INTO sessions(id,session) value("' + key + '","' + sessionString + '") ' +
     'on duplicate key update session="' + sessionString + '";')
  }

  middleware () {
    return (ctx, next) => {
      const key = this.options.getSessionKey(ctx)
      if (!key) {
        return next()
      }
      debug('session key %s', key)
      return this.getSession(key).then((session) => {
        debug('session value', session)
        Object.defineProperty(ctx, this.options.property, {
          get: function () { return session },
          set: function (newValue) { session = Object.assign({}, newValue) }
        })
        return next().then(() => {
          return this.saveSession(key, session)
        })
      })
    }
  }
}

module.exports = MySQLSession
