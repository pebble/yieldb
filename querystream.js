
var Readable = require('stream').Readable;

module.exports = exports = QueryStream;

function QueryStream(cursor, model) {
  if (!(this instanceof QueryStream)) {
    return new QueryStream(cursor, model);
  }

  Readable.call(this);
};

QueryStream.prototype._read = function(doc) {

}
