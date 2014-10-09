'use strict';

var debug = require('debug')('yield:db');
var mongo = require('mongodb');
var hasOwn = require('has-own');
var mquery = require('mquery');
var assert = require('assert');
var Collection = require('./collection');

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
 * Returns a thunk which when executed
 * closes the database connection.
 *
 * @returns {Function} thunk
 * @api public
 */

Db.prototype.close = function() {
  debug('close()');
  return this.db.close.bind(this.db);
}

/**
 * Returns a thunk which when executed
 * deletes the _entire_ database.
 *
 *     yield db.drop();
 *
 * @returns {Function} thunk
 * @api public
 */

Db.prototype.drop = function() {
  debug('drop()');
  return this.db.dropDatabase.bind(this.db);
}

/**
 * Returns a thunk which when executed responds
 * with an array of all collection objects, one
 * for each collection in the database, OR an
 * error if one occurs.
 *
 *     var collections = yield db.getCollections();
 *
 * @returns {Function} thunk
 * @api public
 */

Db.prototype.getCollections = function() {
  debug('getCollections()');

  var db;
  return function(cb) {
    db.collections(function(err, collections) {
      if (err) return cb(err);

      var cols = collections.map(function(collection) {
        return db.collection(collection.collectionName);
      });

      cb(err, cols);
    });
  }
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
 * For monitoring health
 *
 * Example:
 *
 *     var stats = yield db.stats();
 *
 * @returns {Function} thunk
 * @throws {Error} if the mongodb driver responds with an Error
 */

Db.prototype.stats = function() {
  debug('stats()');

  return this.db.stats.bind(this.db);
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
 * @returns {Function} thunk
 * @throws {Error} if the mongodb driver responds with an Error
 */

Db.prototype.serverStatus = function() {
  debug('serverStatus()');

  var db = this.db;
  return function(cb) {
    db.command({ serverStatus: 1 }, cb);
  }
}
