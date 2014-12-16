
/**
 * To run:
 *
 *   MONGO_URI=mongodb://localhost/test node --harmony-generators index.js
 */

var co = require('co');
var app = require('./app');
var mongo = require('yieldb');

module.exports = start;

function* start () {
  app.context.db = yield mongo.connect(process.env.MONGO_URI);

  var port = process.env.PORT;
  var server = app.listen(port);

  server.on('listening', function() {
    var add = server.address();
    console.log('server listening on http://%s:%d', add.address, add.port);
  });

  return server;
}

if (!module.parent) {
  co(start);
}
