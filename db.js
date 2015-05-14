'use strict';

var debug = require('debug')('yieldb:db');
var mongo = require('mongodb');
var hasOwn = require('has-own');
var assert = require('assert');
var Collection = require('./collection');
var helper = require('./helper');

module.exports = exports = Db;

/**
 * Database constructor
 *
 * @param {Object} database A mongodb native driver database object
 */

function Db(database) {
  assert(database, 'missing db object');
  this.db = database;
  this.cols = {};
}

/**
 * Creates a Db instance
 *
 * @param {nativeDatabase} database A mongodb-native database object
 * @returns {Object} Db
 * @api private
 */

Db.init = function*(database) {
  debug('initialize database');
  var db = new Db(database);
  return db;
}

/**
 * Returns a promise which closes the database connection.
 *
 *     yield db.close();
 *
 * @returns {Promise/Function} promise
 * @api public
 */

Db.prototype.close = function() {
  debug('close()');

  var self = this;
  function dbCloseTimingFix(cb) {
    // mongodb driver immediately executes the db.close callback, breaking
    // node callback execution order expectations. when that bug is
    // fixed, remove setImmediate()
    setImmediate(function() {
      self.db.close(cb);
      self = dbCloseTimingFix = cb = null;
    })
  }

  dbCloseTimingFix.then = helper.makeThen(dbCloseTimingFix);
  return dbCloseTimingFix;
}

/**
 * Returns a promise which deletes the _entire_ database.
 *
 *     yield db.drop();
 *
 * @returns {Promise/Function} promise
 * @api public
 */

Db.prototype.drop = function() {
  debug('drop()');
  var fn = this.db.dropDatabase.bind(this.db);
  fn.then = helper.makeThen(fn);
  return fn;
}

/**
 * Returns a promise which retreives the list of
 * existing collections in the database.
 *
 *     yield db.listCollections();
 *
 * @returns {Promise/Function} promise
 * @api public
 */

Db.prototype.listCollections = function() {
  debug('listCollections()');
  var cursor = this.db.listCollections();
  var fn = cursor.toArray.bind(cursor);
  fn.then = helper.makeThen(fn);
  return fn;
}

/**
 * Creates a new collection object for the given `name`.
 *
 *     var Trends = db.col('trends');
 *     yield Trends.insert({ .. })
 *
 * @param {String} name
 * @returns {Collection}
 */

Db.prototype.col = Db.prototype.collection = function(name) {
  debug('collection()');

  if ('string' != typeof name)
    throw new TypeError('name must be a string');

  if (this.cols[name]) return this.cols[name];
  return this.cols[name] = new Collection(this.db, name);
}

/**
 * Sends a ping to mongodb
 *
 * Example:
 *
 *     var stats = yield db.ping();
 *
 * @returns {Promise/Function} promise
 * @throws {Error} if the mongodb driver responds with an Error
 */

Db.prototype.ping = function() {
  var db = this.db;
  function ping(cb) {
    db.command({ ping: 1 }, cb);
  }
  ping.then = helper.makeThen(ping);
  return ping;
}

/**
 * Even better for monitoring health but
 * compose.io doesn't expose this method unless we're
 * on a dedicated cluster. This will error for now
 * with an "unauthorized" message but leaving it in
 * for the future.
 *
 *     var status = yield db.serverStatus();
 *
 * @returns {Promise/Function} promise
 * @throws {Error} if the mongodb driver responds with an Error
 */

Db.prototype.serverStatus = function() {
  debug('serverStatus()');

  var db = this.db;
  function serverStatus(cb) {
    db.command({ serverStatus: 1 }, cb);
  }
  serverStatus.then = helper.makeThen(serverStatus);
  return serverStatus;
}
