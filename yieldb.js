
var mongo = require('mongodb').MongoClient;
var debug = require('debug')('yieldb');
var Db = require('./db');
var Collection = require('./collection');

exports.connect = function*(uri, opts) {
  var nativeDb = yield connectToMongo(uri, opts);

  debug('connected to %s', uri.replace(/\/\/([^@]+)@/, '//{AUTH}@'));

  return yield Db.init(nativeDb);
}

exports.Db = Db;
exports.Collection = Collection;

/**
 * @api private
 */

function connectToMongo(uri, opts) {
  return function(cb) {
    mongo.connect(uri, opts || {}, cb);
  }
}
