'use strict';

var koa = require('koa');
var app = module.exports = koa();

app.use(function*() {
  var doc = yield this.db.col('users').findOne();
  if (!doc) return this.throw(404);
  this.body = doc;
});

