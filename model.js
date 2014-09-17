
var debug = require('debug')('comongo:model');
var ObjectId = require('mongodb').ObjectID;
var hasOwn = require('has-own');
var isObject = require('is-object');
var QueryStream = require('./querystream');
var Doc = require('./doc');

module.exports = Model;

function Model(db, name) {
  debug('new model', name);
  this.$col = db.$db.collection(name);
  this.name = name;
}

Model.prototype.new = function(obj) {
  var doc = new Doc(this);
  doc.$become(obj);
  return doc;
}

Model.prototype.init = function(obj) {
  var doc = new Doc(this);
  doc.$init(obj);
  return doc;
}

/**
 * currently does not support passing Docs in selector
 *
 * var User = db.model('User');
 * User.find()
 * User.find().stream();
 * @returns {Function} thunk
 */

Model.prototype.find = function(selector, opts) {
  opts || (opts = {});

  var model = this;
  var col = model.$col;
  var query = cast(selector);
  var cursor = col.find(query, opts);

  function find(cb) {
    debug('%s.find(%j, %j)', model.name, query, opts);
    cursor.toArray(convertAll(model, cb));
  }

  find.stream = function(){
    debug('%s.find(%j, %j).stream()', model.name, query, opts);

    // TODO rewrite the stream as node 10.x style
    // driver stream is 0.8 style
    //return new QueryStream(cursor, model);

    return cursor.stream({ transform: function(doc) {
      if (doc) return model.init(doc);
      return doc;
    }});
  }

  return find;
}

Model.prototype.findOne = function(selector, opts) {
  opts || (opts = {});

  var model = this;
  var col = model.$col;
  var query = cast(selector);

  return function findOne(cb) {
    debug('%s.findOne(%j, %j)', model.name, query, opts);
    col.findOne(query, opts, convertOne(model, cb));
  }
}

/**
 * Objects receive an _id if they don't already have one.
 *
 * User.insert(doc, options);
 * User.insert([doc1, doc2, ..], options)
 *
 * Responds with the detailed results from MongoDB.
 *
 *   { ok: 1,
 *     writeErrors: [],
 *     writeConcernErrors: [],
 *     nInserted: 2,
 *     nUpserted: 0,
 *     nMatched: 0,
 *     nModified: 0,
 *     nRemoved: 0,
 *     upserted: [] }
 *
 * @returns {Function} thunk
 */

Model.prototype.insert = function(obj, opts) {
  opts || (opts = {});

  var isArray = Array.isArray(obj);

  if (isArray) {
    obj = obj.map(ensureIsObjectAndHasId);
  } else {
    obj = ensureIsObjectAndHasId(obj);
  }

  var model = this;
  var col = model.$col;

  if (!hasOwn('fullResult', opts)) opts.fullResult = true;

  return function insert(cb) {
    debug('%s.insert(%j, %j)', model.name, obj, opts);
    col.insert(obj, opts, cb);
  }
}

Model.prototype.update = function(selector, cmd, opts) {
  if (!selector) throw new TypeError('missing selector argument');
  if (!isObject(cmd)) throw new TypeError('missing update argument');

  opts || (opts = {});
  if (!hasOwn('multi', opts)) opts.multi = true;

  var model = this;
  var col = model.$col;
  var query = cast(selector);

  if (!hasOwn('fullResult', opts)) opts.fullResult = true;

  return function update(cb) {
    debug('%s.update(%j, %j, %j)', model.name, query, cmd, opts);
    col.update(query, cmd, opts, cb);
  }
}

/**
 * Removes documents which match the given `selector` from the collection.
 *
 * @param {Object|String|ObjectId} selector
 * @param {Boolean} [options.multi] should remove multiple docs? default: true
 * @param {Boolean} [options.fullResult] should respond with verbose cmd output? default: true
 * @returns {Function} thunk
 */

Model.prototype.remove = function(selector, opts) {
  if (!selector) throw new TypeError('missing selector argument');

  opts || (opts = {});

  // we use "multi" for consistency across our other methods
  if (!hasOwn('multi', opts)) opts.multi = true;

  // the driver uses "single" for col.remove()
  hasOwn('single', opts) || (opts.single = !opts.multi);
  delete opts.multi;

  var model = this;
  var col = model.$col;
  var query = cast(selector);

  if (!hasOwn('fullResult', opts)) opts.fullResult = true;

  return function remove(cb) {
    debug('%s.remove(%j, %j)', model.name, query, opts);
    col.remove(query, opts, cb);
  }
}

Model.prototype.aggregate = function(pipeline, opts) {
  if (!Array.isArray(pipeline)) throw new TypeError('pipeline must be an array');

  opts || (opts = {});

  var model = this;
  var col = model.$col;

  pipeline.forEach(function(op) {
    if (!(op && op.$match)) return;
    op.$match = cast(op.$match);
  });

  function aggregate(cb) {
    debug('%s.aggregate(%j, %j)', model.name, pipeline, opts);
    col.aggregate(pipeline, opts, cb);
  }

  aggregate.stream = function() {
    debug('%s.aggregate(%j, %j).stream()', model.name, pipeline, opts);

    // leave original options untouched
    var o = {};
    for (var key in opts) o[key] = opts[key];

    // driver supports node 0.10 style stream
    if (!isObject(o.cursor)) o.cursor = {};
    return col.aggregate(pipeline, o);
  }

  return aggregate;
}

/**
 * Executes a findAndModify command.
 *
 * @param {Object|String|ObjectId} selector
 * @param {Boolean} [options.fullResult] should respond with verbose cmd output? default: false
 * @returns {Function} thunk
 */

Model.prototype.findAndModify = function(selector, cmd, opts) {
  if (!selector) throw new TypeError('missing selector argument');
  if (!isObject(cmd)) throw new TypeError('missing update argument');

  opts || (opts = {});
  if (!hasOwn('new', opts)) opts.new = true;

  var model = this;
  var col = model.$col;
  var query = cast(selector);
  var sort = opts.sort || [];
  var full = opts.fullResult;

  return function findAndModify(cb) {
    debug('%s.findAndModify(%j, %j, %j)', model.name, query, cmd, opts);
    col.findAndModify(query, sort, cmd, opts, function(err, doc, result) {
      if (full) return cb(err, result);
      cb(err, doc);
    });
  }
}

Model.prototype.count = function (selector, opts) {
  opts || (opts = {});

  var model = this;
  var col = model.$col;
  var query = cast(selector);

  return function count(cb) {
    debug('%s.count(%j, %j)', model.name, query, opts);
    col.count(query, opts, cb);
  }
}

// distinct
// mapReduce
// geoNear
// geoSearch
// populate ??

// helpers

function cast(arg) {
  debug('cast %s', arg);

  if (!arg) return {};

  // find(id)
  if (isHexString(arg)) {
    return { _id: new ObjectId(arg) };
  }

  // find({ _id: '54049bff83359f9872f94c19' })
  if (arg._id && isHexString(arg._id)) {
    arg._id = new ObjectId(arg._id);
  }

  if (!isObject(arg)) throw new TypeError('invalid selector');

  return arg instanceof Doc
    ? arg.toJSON()
    : arg;
}

function isHexString(arg) {
  return 24 == arg.length && 'string' == typeof arg;
}

function convert(model, doc) {
  if (!doc) return;
  return model.init(doc);
}

function convertOne(model, cb) {
  return function(err, doc) {
    if (err) return cb(err);
    cb(err, convert(model, doc));
  }
}

function convertAll(model, cb) {
  return function(err, docs) {
    if (err) return cb(err);
    if (!Array.isArray(docs)) return cb(err, []);

    for (var i = 0; i < docs.length; ++i) {
      docs[i] = model.init(docs[i]);
    }

    cb(err, docs);
  }
}

/**
 * insert() helper
 */

function ensureIsObjectAndHasId(o) {
  if (o instanceof Doc) {
    o = o.toJSON();
    delete o.isNew;
  }

  if (isObject(o)) {
    ensureId(o);
    return o;
  }

  throw new TypeError('insert() accepts either a single object or array of objects');
}

function ensureId(doc) {
  if (!hasOwn('_id', doc)) {
    doc._id = new ObjectId;
  }
}

