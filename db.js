
var Model = require('./model');
var debug = require('debug')('comongo:db');

module.exports = Db;

/**
 * Represents the database
 *
 * @api private
 */

function Db(db) {
  this.$db = db;

  // TODO delegate?
  this.name = db.databaseName;
}

/**
 * Returns a thunk which closes the database
 *
 * @returns {thunk}
 * @api public
 */

Db.prototype.close = function() {
  debug('close()');
  var db = this.$db;
  return function(cb) {
    debug('closing');
    db.close(cb);
  }
}

/**
 * Creates a model for the collection with the give `name`.
 *
 * @param {String} name The name of the collection
 * @api public
 */

Db.prototype.model = function model(name) {
  return new Model(this, name);
}

// TODO delegate some native db methods / properties

