
var debug = require('debug')('comongo:document');
var update = require('mongo-query');
var assert = require('assert');
var eql = require('mongo-eql');

module.exports = Document;

/**
 * Constructor
 *
 * @param {Model} model
 * @api private
 */

function Document(model) {
  this.isNew = true;
  this.$model = model;
  this.$saving = false;
  this.$_thunk = undefined;
  this.$cmd = {};
}

/**
 * Create a document from a plain object (usually from the db).
 * Does not mark dirty.
 *
 * @param {Object} obj
 * @api private
 */

Document.prototype.$init = function(obj) {
  debug('$init %j', obj);

  if (obj) {
    var keys = Object.keys(obj);
    var key;

    for (var i = 0; i < keys.length; ++i) {
      key = keys[i];
      if ('$' == key[0]) continue;
      if ('isNew' == key) continue;
      else this[key] = obj[key];
    }
  }

  this.isNew = false;
}

/**
 * Sets `path` to the given `val`.
 *
 * @param {String} path
 * @param {mixed} val
 * @returns {thunk}
 */

Document.prototype.$set = function(path, val) {
  debug('$set', path, val);
  assert.equal('string', typeof path, 'path must be a string');

  if ('undefined' == typeof val) {
    return this.$unset(path);
  }

  var op = {};
  op[path] = val;
  update(this, null, { $set: op });

  this.$cmd.$set || (this.$cmd.$set = {});
  this.$cmd.$set[path] = val;

  return this.$thunk();
}

/**
 * Removes `path` from the document.
 *
 * @param {String} path
 * @returns {thunk}
 */

Document.prototype.$unset = function(path) {
  debug('$unset', path);
  assert.equal('string', typeof path, 'path must be a string')

  var op = {};
  op[path] = 1;
  update(this, null, { $unset: op });

  this.$cmd.$unset || (this.$cmd.$unset = {});
  this.$cmd.$unset[path] = 1;

  return this.$thunk();
}

/**
 * Increments `path` by `amount`.
 *
 * @param {String} path
 * @param {Number} amount
 * @returns {thunk}
 */

Document.prototype.$inc = function(path, amount) {
  debug('$inc', path, amount);
  assert.equal('string', typeof path, 'path must be a string')

  var op = {};
  op[path] = amount;
  update(this, null, { $inc: op });

  this.$cmd.$inc || (this.$cmd.$inc = {});
  this.$cmd.$inc[path] = amount;

  return this.$thunk();
}

/**
 * Renames `oldPath` to `newPath`.
 *
 * @param {String} oldPath
 * @param {String} newPath
 * @returns {thunk}
 */

Document.prototype.$rename = function(oldPath, newPath) {
  debug('$rename', oldPath, newPath);
  assert.equal('string', typeof oldPath, 'oldPath must be a string')
  assert.equal('string', typeof newPath, 'newPath must be a string')

  var op = {};
  op[oldPath] = newPath;
  update(this, null, { $rename: op });

  this.$cmd.$rename || (this.$cmd.$rename = {});
  this.$cmd.$rename[oldPath] = newPath;

  return this.$thunk();
}

/**
 * Specifies a mongodb $push for the given `path` and `val`.
 *
 * @param {String} path
 * @param {mixed} val
 * @returns {thunk}
 */

Document.prototype.$push = function(path, val) {
  debug('$push', path, val);
  assert.equal('string', typeof path, 'path must be a string')

  var op = {};
  op[path] = val;
  update(this, null, { $push: op });

  this.$cmd.$push || (this.$cmd.$push = {});
  this.$cmd.$push[path] = val;

  // TODO $each, $position, $slice, $sort ?

  return this.$thunk();
}

/**
 * Specifies a mongodb $pushAll for the given `path` and `vals`.
 *
 * @param {String} path
 * @param {Array} vals
 * @returns {thunk}
 */

Document.prototype.$pushAll = function(path, vals) {
  debug('$pushAll', path, vals);
  assert.equal('string', typeof path, 'path must be a string')
  assert(Array.isArray(vals), 'vals must be an array');

  if (this[path] && !Array.isArray(this[path])) {
    throw new TypeError(path + ' is already set to a non-array.');
  }

  var op = {};
  op[path] = vals;
  update(this, null, { $pushAll: op });

  this.$cmd.$pushAll || (this.$cmd.$pushAll = {});
  this.$cmd.$pushAll[path] || (this.$cmd.$pushAll[path] = []);
  ary = this.$cmd.$pushAll[path];
  ary.push.apply(ary, vals);

  return this.$thunk();
}

/**
 * Specifies a mongodb $pull for the given `path` and `val`.
 *
 * @param {String} path
 * @param {mixed} val
 * @returns {thunk}
 */

Document.prototype.$pull = function(path, val) {
  debug('$pull', path, val);
  assert.equal('string', typeof path, 'path must be a string')

  var op = {};
  op[path] = val;
  update(this, null, { $pull: op })

  this.$cmd.$pull || (this.$cmd.$pull = {});
  this.$cmd.$pull[path] || (this.$cmd.$pull[path] = val);

  return this.$thunk();
}

/**
 * Specifies a mongodb $pullAll for the given `path` and `vals`.
 *
 * @param {String} path
 * @param {Array} vals
 * @returns {thunk}
 */

Document.prototype.$pullAll = function(path, vals) {
  debug('$pullAll', path, vals);
  assert.equal('string', typeof path, 'path must be a string')
  assert(Array.isArray(vals), 'vals must be an array');

  var op = {};
  op[path] = vals;
  update(this, null, { $pullAll: op })

  this.$cmd.$pullAll || (this.$cmd.$pullAll = {});
  this.$cmd.$pullAll[path] || (this.$cmd.$pullAll[path] = []);
  var ary = this.$cmd.$pullAll[path];
  ary.push.apply(ary, vals);

  return this.$thunk();
}

/**
 * Specifies a mongodb $pop for the given `path`.
 *
 * @param {String} path
 * @param {Number} [val] either 1 (default) or -1
 * @returns {thunk}
 */

Document.prototype.$pop = function(path, val) {
  debug('$pop', path, val);
  assert.equal('string', typeof path, 'path must be a string')

  if ('undefined' == typeof val) val = 1;

  if (!(1 === val || -1 === val)) {
    throw new Error('$pop only supports 1 or -1');
  }

  if (this[path] && !Array.isArray(this[path])) {
    throw new TypeError(path + ' is already set to a non-array.');
  }

  var op = {};
  op[path] = val;
  update(this, null, { $pop: op });

  this.$cmd.$pop || (this.$cmd.$pop = {});
  this.$cmd.$pop[path] = val;

  return this.$thunk();
}

/**
 * Adds unique `vals` to the array at the given `path`
 *
 * @returns {thunk}
 */

Document.prototype.$addToSet = function(path, vals) {
  debug('$addToSet', path, vals);
  assert.equal('string', typeof path, 'path must be a string')
  assert(Array.isArray(vals), 'vals must be an array');

  if (this[path] && !Array.isArray(this[path])) {
    throw new TypeError(path + ' is already set to a non-array.');
  }

  // TODO use mongo-query once addToSet works better

  this.$cmd.$addToSet || (this.$cmd.$addToSet = {});
  this.$cmd.$addToSet[path] || (this.$cmd.$addToSet[path] = { $each: [] });
  var ary = this.$cmd.$addToSet[path].$each;
  ary.push.apply(ary, vals);

  // add unique vals to our local array
  this[path] || (this[path] = []);
  ary = this[path];

  for (var i = 0; i < vals.length; ++i) {
    var val = vals[i];
    var found = false;

    // if any incoming val equals val, skip it. else add it
    for (var j = 0; j < ary.length; ++j) {
      if (eql(ary[j], val)) {
        found = true;
        break;
      }
    }

    if (!found) ary.push(val);
  }

  return this.$thunk();
}

/**
 * Reloads this session from the db
 *
 *   yield session.$reload()
 *
 * @returns {thunk}
 */

Document.prototype.$reload = function() {
  debug('$reload');

  var doc = this;
  return function(cb) {
    doc.$model.$col.findOne({ _id: doc._id }, function(err, obj) {
      if (err) return cb(err);

      if (null == obj) {
        var msg = 'could not $reload: { _id: '+String(doc._id)+' } not found in db';
        return cb(new Error(msg));
      }

      doc.$become(obj, true);
      cb(null, doc);
    });
  }
}

/**
 * JSON.stringify() helper
 *
 * @returns {Object}
 */

Document.prototype.toJSON = function() {
  var keys = Object.keys(this);
  var i = keys.length;
  var ret = {};
  var key;

  while (i--) {
    key = keys[i];
    if ('$' == key[0]) continue;
    ret[key] = this[key];
  }

  return ret;
}

/**
 * Determines if this document has pending changes
 * @returns {Boolean}
 * @api public
 */

Document.prototype.$isDirty = function() {
  debug('$isDirty');
  return Object.keys(this.$cmd).length > 0;
}

/**
 * Changes this document into the passed `obj` (erases
 * current key/vals).
 *
 * @param {Object} obj The object to which this document will transition.
 * @api public
 */

Document.prototype.$become = function(obj, memoryOnly) {
  debug('$become %s %j', memoryOnly, obj);
  var op = {};
  var unset = op.$unset = {};
  var set = op.$set = {};

  // remove current vals
  var keys = Object.keys(this);
  var i = keys.length;
  var key;

  while (i--) {
    key = keys[i];
    if ('$' == key[0]) continue;
    if ('isNew' == key) continue;
    unset[key] = 1;
  }

  // apply the new values
  keys = Object.keys(obj);
  i = keys.length;

  while (i--) {
    key = keys[i];
    if ('$' == key[0]) continue;
    if ('isNew' == key) continue;
    delete unset[key];
    set[key] = obj[key];
  }

  if (memoryOnly) {
    update(this, null, { $unset: unset });
    update(this, null, { $set: set });
    return;
  }

  keys = Object.keys(unset);
  i = keys.length;
  while (i--) this.$unset(keys[i], unset[keys[i]]);

  keys = Object.keys(set);
  i = keys.length;
  while (i--) this.$set(keys[i], set[keys[i]]);
}

/**
 * Returns a thunk, which when executed, runs the pending commands.
 *
 *   yield doc.$save()
 *   // or
 *   var fn = doc.$save()
 *   fn(callback)
 *
 * @api public
 */

Document.prototype.$save = function() {
  var doc = this;
  return this.$_thunk || (this.$_thunk = function(cb){
    assert('function' == typeof cb, 'cb must be a function');

    debug('saving', doc._id);

    if (doc.$saving)
      return cb(new Error('The doc is already being saved'));

    doc.$saving = true;

    var wasNew = doc.isNew;
    doc.isNew = false;

    var update = doc.$cmd;
    var query = { _id: doc._id };
    var opts = { upsert: true };

    debug('saving %j', update);

    doc.$model.$col.update(query, update, opts, function(err) {
      doc.$saving = false;

      if (err) {
        doc.isNew = wasNew;
        return cb(err);
      }

      doc.$cmd = {};
      cb(null, this);
    });
  });
}

/**
 * Reads better for internal return values.
 *
 *     return this.$thunk
 *     // vs
 *     return this.$save
 *
 * @api private
 */

Document.prototype.$thunk = Document.prototype.$save;
