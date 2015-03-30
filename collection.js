
var debug = require('debug')('yieldb:collection');
var hasOwn = require('has-own');
var isObject = require('is-object');
var mquery = require('mquery');
var helper = require('./helper');
var ensureIsObjectAndHasId = helper.ensureIsObjectAndHasId;
var cast = helper.cast;

module.exports = Collection;

function Collection(db, name) {
  if (!(this instanceof Collection))
    return new Collection(db, name);

  debug('new collection', name);

  this.name = name;
  this.col = db.collection(name);
  this.query = mquery(this.col).toConstructor();
}

/**
 * Returns a query which when executed performs a find.
 *
 *     var User = db.col('User');
 *     yield User.find();
 *
 * @param {Object|ObjectId|hexString} selector
 * @param {Object} [opts]
 * @returns {mquery}
 */

Collection.prototype.find = function(selector, opts) {
  opts || (opts = {});

  var matcher = cast(selector);
  var mq = this.query(matcher, opts);
  return mq;
}

/**
 * Returns a query which when executed performs a findOne.
 *
 *     var User = db.col('User');
 *     yield User.findOne(id);
 *
 * @param {Object|ObjectId|hexString} selector
 * @param {Object} [opts]
 * @returns {mquery}
 */

Collection.prototype.findOne = function(selector, opts) {
  opts || (opts = {});

  var matcher = cast(selector);
  var mq = this.query().findOne(matcher);
  mq.setOptions(opts);
  return mq;
}

/**
 * Returns thunk which when executed inserts
 * objects into the database.
 *
 * Note: The objects receive an _id if they don't
 * already have one.
 *
 *     yield User.insert(doc, options);
 *     yield User.insert([doc1, doc2, ..], options)
 *
 * Responds with the detailed results from MongoDB.
 *
 *     var res = yield User.insert(docs, options);
 *     console.log(res);
 *     // { ok: 1,
 *     //   writeErrors: [],
 *     //   writeConcernErrors: [],
 *     //   nInserted: 2,
 *     //   nUpserted: 0,
 *     //   nMatched: 0,
 *     //   nModified: 0,
 *     //   nRemoved: 0,
 *     //   upserted: [] }
 *
 * @param {Object} obj
 * @param {Object} [options]
 * @returns {Function} thunk
 */

Collection.prototype.insert = function(obj, opts) {
  opts || (opts = {});

  var isArray = Array.isArray(obj);

  if (isArray) {
    obj = obj.map(ensureIsObjectAndHasId);
  } else {
    obj = ensureIsObjectAndHasId(obj);
  }

  if (!hasOwn('fullResult', opts)) opts.fullResult = true;

  var self = this;

  function insert(cb) {
    debug('%s.insert(%j, %j)', self.name, obj, opts);
    self.col.insert(obj, opts, cb);
  }

  insert.then = helper.makeThen(insert);
  return insert;
}

/**
 * Returns a query which when executed updates the
 * documents in the database.
 *
 *     yield User.update(selector, { $set: { koa: true }}, options);
 *
 * @param {Object|ObjectId|hexString} selector
 * @param {Object} cmd
 * @param {Object} [options]
 * @returns {mquery}
 */

Collection.prototype.update = function(selector, cmd, opts) {
  if (!selector) throw new TypeError('missing selector argument');
  if (!isObject(cmd)) throw new TypeError('missing update argument');

  opts || (opts = {});
  if (!hasOwn('multi', opts)) opts.multi = true;
  if (!hasOwn('fullResult', opts)) opts.fullResult = true;

  var matcher = cast(selector);
  var mq = this.query().update(matcher, cmd, opts);
  return mq;
}

/**
 * Returns a query which when executed removes documents which
 * match the given `selector` from the collection.
 *
 * @param {Object|ObjectId|hexString} selector
 * @param {Boolean} [options.multi] should remove multiple docs? default: true
 * @param {Boolean} [options.fullResult] should respond with verbose cmd output? default: true
 * @returns {mquery}
 */

Collection.prototype.remove = function(selector, opts) {
  if (!selector) throw new TypeError('missing selector argument');

  opts || (opts = {});

  // we use "multi" for consistency across our other methods
  if (!hasOwn('multi', opts)) opts.multi = true;

  // the driver uses "single" for col.remove()
  hasOwn('single', opts) || (opts.single = !opts.multi);
  delete opts.multi;

  if (!hasOwn('fullResult', opts)) opts.fullResult = true;

  var matcher = cast(selector);
  var mq = this.query().remove(matcher);
  mq.setOptions(opts);
  return mq;
}

/**
 * Returns thunk which when executed deletes
 * the entire collection.
 *
 *     yield User.drop();
 *
 * @returns {Function} thunk
 */

Collection.prototype.drop = function() {
  var self = this;
  function drop(cb) {
    debug('%s.drop()', self.name);
    self.col.drop(cb);
  }

  drop.then = helper.makeThen(drop);
  return drop;
}

/**
 * Returns a thunk which when executed performs an
 * aggregation query.
 *
 *     var res = yield User.aggregate(array, opts);
 *
 * The returned thunk also has a `stream()` method which is
 * useful if a stream is desired instead.
 *
 *     var readStream = User.aggregate(array, opts).stream();
 *
 * @param {Array} pipeline
 * @param {Object} [opts]
 * @returns {Function} thunk
 * @TODO remove when mquery supports aggregation
 */

Collection.prototype.aggregate = function(pipeline, opts) {
  if (!Array.isArray(pipeline))
    throw new TypeError('pipeline must be an array');

  opts || (opts = {});

  pipeline.forEach(function(op) {
    if (!(op && op.$match)) return;
    op.$match = cast(op.$match);
  });

  var self = this;

  function aggregate(cb) {
    debug('%s.aggregate(%j, %j)', self.name, pipeline, opts);
    self.col.aggregate(pipeline, opts, cb);
  }

  aggregate.stream = function() {
    debug('%s.aggregate(%j, %j).stream()', self.name, pipeline, opts);

    // tell driver we want a stream but
    // leave original options untouched
    var o = {};
    for (var key in opts) o[key] = opts[key];
    if (!isObject(o.cursor)) o.cursor = {};

    // aggregate returns node 0.10 style stream
    return self.col.aggregate(pipeline, o);
  }

  return aggregate;
}

/**
 * Returns a query which when executed performs a
 * findAndModify update command.
 *
 * @param {Object|String|ObjectId} selector
 * @param {Object} updateCommand
 * @param {Boolean} [options.new] should respond with the document with modifications applied? default: true
 * @param {Boolean} [options.upsert]
 * @param {String} [options.sort]
 * @returns {mquery}
 */

Collection.prototype.findOneAndUpdate = function(selector, cmd, opts) {
  var matcher = cast(selector);
  var mq = this.query().findOneAndUpdate(matcher, cmd, opts);
  return mq;
}

/**
 * Returns a query which when executed performs a
 * findAndModify remove command.
 *
 * @param {Object|String|ObjectId} selector
 * @param {Object} updateCommand
 * @param {String} [options.sort]
 * @returns {mquery}
 */

Collection.prototype.findOneAndRemove = function(selector, opts) {
  var matcher = cast(selector);
  var mq = this.query().findOneAndRemove(matcher, opts);
  return mq;
}

/**
 * Returns a query which when executed performs a count.
 *
 * @param {Object|ObjectId|hexString} selector
 * @param {Object} [opts]
 * @returns {Object} mquery
 */

Collection.prototype.count = function(selector, opts) {
  var matcher = cast(selector);
  var mq = this.query().count(matcher);
  mq.setOptions(opts);
  return mq;
}

/**
 * Returns a query which when executed performs a distinct command.
 *
 * @param {String} key
 * @param {Object|ObjectId|hexString} [selector]
 * @returns {Object} mquery
 */

Collection.prototype.distinct = function(key, selector) {
  if ('string' != typeof key)
    throw new TypeError('distinct expects a `key` string');

  var mq = this.query();

  if (selector) {
    var matcher = cast(selector);
    mq.distinct(matcher, key);
  } else {
    mq.distinct(key);
  }

  return mq;
}

/**
 * Returns an mquery builder for this collection passing
 * the arg to `mquery().where(arg)`.
 *
 *     var User = db.col('users');
 *     var aaron = yield User.where({ name: 'aaron' }).select('uuid devices');
 *
 * @param {Object|String} arg
 * @returns {Object} mquery
 */

Collection.prototype.where = function(arg) {
  return this.query().where(arg);
}

/**
 * Create an index
 *
 *     var User = db.col('users');
 *     yield User.index({ name: 1, email: -1 });
 *
 * @param {Object} indexDefinition
 * @param {Object} [options]
 * @returns {Function} thunk
 */

Collection.prototype.index = function(def, opts) {
  if (!def) throw new TypeError('missing index definition');

  opts || (opts = {});
  var self = this;

  return function index(cb) {
    debug('%s.index(%j, %j)', self.name, def, opts);
    self.col.ensureIndex(def, opts, cb);
  }
}

/**
 * Retreives all indexes for the given collection
 *
 *     var User = db.col('users');
 *     var indexes = yield User.indexes();
 *
 * @returns {Function} thunk
 */

Collection.prototype.indexes = function(opts) {
  opts || (opts = {});
  if (!hasOwn('full', opts)) opts.full = true;

  var self = this;
  return function indexes(cb) {
    debug('%s.indexes(%j)', self.name, opts);
    self.col.indexInformation(opts, cb);
  }
}

// TODO
// mapReduce
// geoNear
// geoSearch
// populate ??
