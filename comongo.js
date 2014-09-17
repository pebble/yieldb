
var mongo = require('mongodb').MongoClient;
var Db = require('./db');
var Model = require('./model');
var Document = require('./doc');

var comongo = module.exports;

comongo.connect = function(uri) {
  return function(cb) {
    mongo.connect(uri, function(err, db) {
      if (err) return cb(err);
      cb(null, new Db(db));
    })
  }
}

comongo.Db = Db;
comongo.Model = Model;
comongo.Document = Document;
