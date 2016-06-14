var Telegraf = require('telegraf')
var redisSession = require('../lib/session')

var telegraf = new Telegraf(process.env.BOT_TOKEN)

telegraf.use(redisSession())

telegraf.on('text', (ctx, next) => {
  ctx.session.counter = ctx.session.counter || 0
  ctx.session.counter++
  return next()
})

telegraf.hears('/stats', (ctx) => {
  return ctx.reply(`${ctx.session.counter} messages from ${ctx.from.username}`)
})

telegraf.startPolling()
