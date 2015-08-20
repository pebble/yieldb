'use strict';

var mquery = require('mquery');
var assert = require('assert');
var helper = require('../helper');
var m = require('../');

// patch mocha to accept generators
require('co-mocha');

// default test database
var uri = process.env.YIELDB_TEST_URI;
if (!(typeof uri === 'string' && uri.length)) {
  throw new Error('Missing YIELDB_TEST_URI environment variable');
}

describe('yieldb', function() {
  describe('exposes', function() {
    it('Db', function(done) {
      assert.equal('function', typeof m.Db);
      done();
    });

    it('Collection', function(done) {
      assert.equal('function', typeof m.Collection);
      done();
    });

    it('mongodb', function(done) {
      assert(m.mongodb);
      done();
    });

    it('mquery', function(done) {
      assert(m.mquery);
      done();
    });
  });

  describe('connect()', function() {
    it('is a GeneratorFunction', function(done) {
      assert.equal('GeneratorFunction', m.connect.constructor.name);
      done();
    });

    it('connects to mongodb when yielded', function*() {
      var db = yield m.connect(uri);
      assert(db);
    });
  });

  describe('Collection', function() {
    describe('without overriding mquery.Promise', function() {
      testCollections();
    });

    describe('with overriding mquery.Promise', function() {
      var orig;

      function before() {
        orig = m.mquery.Promise;
        m.mquery.Promise = Promise;
      }

      function after() {
        m.mquery.Promise = orig;
      }

      testCollections(before, after);
    });
  });

  function testCollections(bf, af) {
    var db;
    var User;
    var Dropper;
    var name = 'users';
    var lastOfUs;

    before(function*() {
      if (bf) bf();

      db = yield m.connect(uri);
      User = db.col(name);
      Dropper = db.col('droppers');

      // use underlying driver for creation

      lastOfUs = (yield function(cb) {
        User.col.insert({ name: 'Last Of Us' }, cb);
      })[0];

      yield function(cb) {
        User.col.insert({ name: 'Zelda' }, cb);
      };
    });

    after(function*() {
      if (af) af();

      yield function(cb) {
        User.col.drop(cb);
      };
    });

    it('requires a collection name', function(done) {
      assert.throws(function() {
        db.col();
      }, /must be a string/);
      done();
    });

    it('can be called without the `new` keyword', function(done) {
      var c1 = m.Collection(db, 'asdf');
      assert(c1 instanceof m.Collection);
      done();
    });

    it('returns the same collection object if called twice w same name',
    function(done) {
      var c1 = db.col('asdf');
      var c2 = db.col('asdf');
      assert.strictEqual(c1, c2);
      done();
    });

    it('has a name', function(done) {
      assert.equal(name, User.name);
      done();
    });

    describe('#find()', function() {

      it('returns an mquery', function(done) {
        var query = User.find();
        assert(query instanceof mquery);
        done();
      });

      it('responds with an array', function*() {
        var arr = yield User.find();
        assert(Array.isArray(arr));
        assert.equal(2, arr.length);
      });

      it('does not throw an error when no doc is found', function*() {
        var arr = yield User.find({ asdf: 'asdf098' });
        assert(Array.isArray(arr));
        assert.equal(0, arr.length);
      });

      it('accepts a selector', function*() {
        var res = yield {
          zero: User.find({ x: 1 }),
          one: User.find({ name: 'Last Of Us' })
        };

        assert.equal(0, res.zero.length);
        assert.equal(1, res.one.length);
      });

      it('accepts options', function*() {
        var arr = yield User.find({}, { select: { _id: 0 } });
        assert.equal(2, arr.length);
        arr.forEach(function(doc) {
          assert(doc.name);
          assert(!doc.isNew);
          assert(!doc._id);
        });
      });

      describe('casts', function() {
        it('hexstring args to { _id: ObjectId(hexstring) }', function*() {
          var arr = yield User.find(String(lastOfUs._id));
          assert.equal(1, arr.length);
          assert.equal('Last Of Us', arr[0].name);
        });

        it('hexstring _id to ObjectId(hexstring)', function*() {
          var arr = yield User.find({ _id: String(lastOfUs._id) });
          assert.equal(1, arr.length);
          assert.equal('Last Of Us', arr[0].name);
        });

        it('ObjectId args to { _id: args }', function*() {
          var arr = yield User.find(lastOfUs._id);
          assert.equal(1, arr.length);
          assert.equal('Last Of Us', arr[0].name);
        });
      });

      describe('.stream()', function() {
        it('returns a stream', function(done) {
          var err = null;
          var docs = [];

          var stream = User.find().stream();

          stream.on('data', function(doc) {
            docs.push(doc);
          });

          stream.on('error', function(error) {
            err = error;
          });

          stream.on('close', function() {
            if (err) return done(err);
            assert.equal(2, docs.length);
            done();
          });
        });
      });
    });

    describe('#findOne()', function() {
      it('returns an mquery', function(done) {
        var query = User.findOne();
        assert(query instanceof mquery);
        done();
      });

      it('responds with a single doc', function*() {
        var doc = yield User.findOne();
        assert(doc);
        assert(!Array.isArray(doc));
        assert(Object.keys(doc).length);
        assert(doc._id);
      });

      it('does not throw an error when no doc is found', function*() {
        var doc = yield User.findOne({ asdf: 'asdf098' });
        assert.equal(undefined, doc);
      });

      it('accepts a selector', function*() {
        var res = yield {
          zero: User.findOne({ x: 1 }),
          one: User.findOne({ name: 'Last Of Us' })
        };

        assert(!res.zero);
        assert(res.one);
      });

      it('accepts options', function*() {
        var doc = yield User.findOne({}, { select: '-_id' });
        assert(doc);
        assert(doc.name);
        assert(!doc.isNew);
        assert(!doc._id);
      });

      describe('casts', function() {
        it('hexstring args to { _id: ObjectId(hexstring) }', function*() {
          var doc = yield User.findOne(String(lastOfUs._id));
          assert(doc);
          assert.equal('Last Of Us', doc.name);
        });

        it('hexstring _id to ObjectId(hexstring)', function*() {
          var doc = yield User.findOne({ _id: String(lastOfUs._id) });
          assert(doc);
          assert.equal('Last Of Us', doc.name);
        });

        it('ObjectId args to { _id: args }', function*() {
          var doc = yield User.findOne(lastOfUs._id);
          assert(doc);
          assert.equal('Last Of Us', doc.name);
        });
      });
    });

    describe('#insert()', function() {
      var id = 'insert-returns-a-promise';

      before(function*() {
        yield User.remove({ id: id });
      });

      it('returns a thunk', function(done) {
        var fn = User.insert({});
        assert.equal('function', typeof fn);
        done();
      });

      it('returns a promise', function(done) {
        var p = User.insert({ id: id });
        p.then(win, done);
        function win(res) {
          done();
        }
      });

      describe('arguments', function() {
        describe('throws', function() {
          it('when nothing is passed', function*() {
            assert.throws(function() {
              User.insert();
            });
          });
          it('when undefined is passed', function*() {
            assert.throws(function() {
              User.insert(undefined);
            });
          });
          it('when null is passed', function*() {
            assert.throws(function() {
              User.insert(null);
            });
          });
          it('when function is passed', function*() {
            assert.throws(function() {
              User.insert(function() {});
            });
          });
          it('when array containing non-objects is passed', function*() {
            assert.throws(function() {
              User.insert([null]);
            });
          });
        });
      });

      describe('with single docs', function() {
        var name = 'supports single docs';
        var original = { name: name };
        var res;
        var doc;

        before(function*() {
          res = yield User.insert(original);
          if (Array.isArray(res)) res = res[0];

          doc = yield User.findOne(original);
        });

        it('works', function*() {
          assert.equal(doc.name, name);
        });

        it('returns the result doc', function*() {
          assert(res);
          assert.equal(1, res.ok);
        });

        describe('if missing _id', function() {
          it('receives an _id set to an ObjectId', function*() {
            assert(original._id);
            var found = yield User.findOne(original._id);
            assert.equal(name, found.name);
          });
        });

        it('accepts options', function*() {
          var res = yield User.insert(
            { acceptsOptions: true }
          , { fullResult: false }
          );

          assert(res);
          assert(1, res.length);
        });
      });

      describe('with multiple docs', function() {
        var res;
        var docs;
        var originals;
        var count = 2;

        before(function*() {
          originals = [];

          for (var i = 0; i < count; ++i) {
            var name = 'supports multi docs: ' + i;
            originals.push({ name: name });
          }

          res = yield User.insert(originals);
          if (Array.isArray(res)) res = res[0];

          docs = yield User.find({ $or: originals });
        });

        it('works', function*() {
          assert.equal(2, docs.length);
        });

        it('returns the result of the operation', function*() {
          assert(res);
          assert.equal(1, res.ok);
        });

        it('accepts options', function*() {
          var res = yield User.insert(
            [{ acceptsOptions: true }, { acceptsOptions: true }]
          , { fullResult: false }
          );

          assert(Array.isArray(res));
          assert.equal(2, res.length);
        });

        describe('if missing _id', function() {
          it('receive an _id set to an ObjectId', function*() {
            originals.forEach(function(doc) {
              assert(doc._id);
            });
          });
        });
      });
    });

    describe('#update()', function() {
      it('returns an mquery', function(done) {
        var query = User.update({}, {});
        assert(query instanceof mquery);
        done();
      });

      describe('arguments', function() {
        describe('selector', function() {
          it('is required', function*() {
            assert.throws(function() {
              User.update(null, {});
            }, /missing selector/);
          });
        });
        describe('update', function() {
          it('is required', function*() {
            assert.throws(function() {
              User.update({});
            }, /missing update/);
          });
        });
      });

      describe('options', function() {
        describe('multi', function() {
          var docs = [];
          var count = 3;

          before(function*() {
            for (var i = 0; i < count; ++i) {
              docs.push({ updateMulti: true, _id: i });
            }

            yield User.insert(docs);
          });

          it('defaults to true', function*() {
            yield User.update({ updateMulti: true }, { $addToSet: { x: ':)' } });

            var found = yield User.find({ updateMulti: true });

            assert.equal(count, found.length);

            found.forEach(function(doc) {
              assert.equal(':)', doc.x);
            });
          });

          it('can be overridden', function*() {
            var query = { updateMulti: true };
            var update = { $set: { i: 'changed' } };
            var opts = { multi: false };
            yield User.update(query, update, opts);

            var found = yield User.find({ updateMulti: true });
            var updated = 0;

            found.forEach(function(doc) {
              if (doc.i === 'changed') updated++;
            });

            assert.equal(1, updated);
          });
        });

        describe('fullResult', function() {
          var docs = [];
          var count = 3;

          before(function*() {
            for (var i = 0; i < count; ++i) {
              docs.push({ test: 'fullResult' });
            }

            yield User.insert(docs);
          });

          it('can be overridden', function*() {
            var res = yield User.update(
              { test: 'fullResult' },
              { $set: { x: 1 } },
              { fullResult: false }
            );
            assert.equal(3, res);
          });
        });
      });

      describe('casts', function() {
        it('hexstring args to { _id: ObjectId(hexstring) }', function*() {
          var res = yield User.update(String(lastOfUs._id), { $set: { rating: 5 } });
          if (Array.isArray(res)) res = res[0];
          assert.equal(1, res.n);

          var doc = yield User.findOne(lastOfUs._id);
          assert.equal(5, doc.rating);
        });

        it('hexstring _id to ObjectId(hexstring)', function*() {
          yield User.update({ _id: String(lastOfUs._id) }, { $set: { rating: 4 } });
          var doc = yield User.findOne(lastOfUs._id);
          assert.equal(4, doc.rating);
        });

        it('ObjectID args to { _id: args }', function*() {
          yield User.update(lastOfUs._id, { $set: { rating: 3 } });
          var doc = yield User.findOne(lastOfUs._id);
          assert.equal(3, doc.rating);
        });
      });

      it('returns the result of the operation', function*() {
        var selector = { _id: 'update returns the result of the op' };
        var res = yield User.update(selector, { $set: { x: 1 } });
        assert(res);
        if (Array.isArray(res)) res = res[0];
        assert.equal(0, res.n);
        assert.equal(true, res.ok);
      });
    });

    describe('#remove()', function() {
      it('returns an mquery', function(done) {
        var query = User.remove({ _id: '#remove' });
        assert(query instanceof mquery);
        done();
      });

      describe('arguments', function() {
        describe('selector', function() {
          it('is required', function*() {
            assert.throws(function() {
              User.remove();
            }, /missing selector/);
          });
        });
      });

      describe('option', function() {
        describe('of multi', function() {
          it('defaults to true', function*() {
            var name = '#remove defaults true';
            var docs = [{ n: name }, { n: name }];
            yield User.insert(docs);
            yield User.remove({ n: name });
            assert.equal(0, (yield User.find({ n: name })).length);
          });

          it('can be overridden', function*() {
            var name = '#remove defaults overridden';
            var docs = [{ n: name }, { n: name }];
            yield User.insert(docs);
            yield User.remove({ n: name }, { multi: false });
            assert.equal(1, (yield User.find({ n: name })).length);
          });
        });

        describe('of fullResult', function() {
          it('defaults to true', function*() {
            var name = '#remove fullResult true';
            var docs = [{ n: name }, { n: name }];
            yield User.insert(docs);
            var res = yield User.remove({ n: name });
            assert(res);
            if (Array.isArray(res)) res = res[0];
            assert.equal(true, res.ok);
            assert.equal(2, res.n);
          });

          it('can be overridden', function*() {
            var name = '#remove fullResult override';
            var docs = [{ n: name }, { n: name }];
            yield User.insert(docs);
            var res = yield User.remove({ n: name }, { fullResult: false });
            assert.equal(2, res);
          });
        });
      });

      describe('casts', function() {
        var doc1 = { name: '#remove 1' };
        var doc2 = { name: '#remove 2' };
        var doc3 = { name: '#remove 3' };

        before(function*() {
          yield User.insert(doc1);
          yield User.insert(doc2);
          yield User.insert(doc3);
        });

        it('hexstring args to { _id: ObjectId(hexstring) }', function*() {
          var id = String(doc1._id);
          var res = yield User.remove(id);
          if (Array.isArray(res)) res = res[0];
          assert.equal(1, res.n);

          var doc = yield User.findOne(id);
          assert.equal(null, doc);
        });

        it('hexstring _id to ObjectId(hexstring)', function*() {
          var id = String(doc2._id);
          var res = yield User.remove({ _id: id });
          if (Array.isArray(res)) res = res[0];
          assert.equal(1, res.n);

          var doc = yield User.findOne(id);
          assert.equal(null, doc);
        });

        it('ObjectId args to { _id: args }', function*() {
          var id = doc3._id;
          var res = yield User.remove(id);
          if (Array.isArray(res)) res = res[0];
          assert.equal(1, res.n);

          var doc = yield User.findOne(id);
          assert.equal(null, doc);
        });
      });
    });

    describe('#aggregate()', function() {

      var inserted = [
        { aggregate: true, x: 0 },
        { aggregate: true, x: 1 },
        { aggregate: true, x: 2 }
      ];

      before(function*() {
        yield User.insert(inserted);
      });

      it('returns a thunk', function(done) {
        var fn = User.aggregate([]);
        assert.equal('function', typeof fn);
        done();
      });

      it('returns a promise', function(done) {
        var p = User.aggregate([{ $match: { aggregate: true } }]);
        p.then(win, done);
        function win(arr) {
          assert(Array.isArray(arr));
          assert.equal(inserted.length, arr.length);
          done();
        }
      });

      it('responds with an array', function*() {
        var arr = yield User.aggregate([{ $match: { aggregate: true } }]);
        assert(Array.isArray(arr));
        assert.equal(inserted.length, arr.length);
      });

      it('does not throw an error when no docs are found', function*() {
        var arr = yield User.aggregate([{ $match: { asdf: 'asdf098' } }]);
        assert(Array.isArray(arr));
        assert.equal(0, arr.length);
      });

      it('accepts a pipeline array', function*() {
        var res = yield {
          zero: User.aggregate([
            { $match: { aggregate: true } },
            { $match: { x: { $lt: 0 } } }
          ]),
          one: User.aggregate([{ $match: { aggregate: true } }, { $limit: 1 }])
        };

        assert.equal(0, res.zero.length);
        assert.equal(1, res.one.length);
      });

      describe('casts', function() {
        it('hexstring args to { _id: ObjectId(hexstring) }', function*() {
          var id = String(lastOfUs._id);
          var arr = yield User.aggregate([{ $match: id }]);
          assert.equal(1, arr.length);
          assert.equal('Last Of Us', arr[0].name);
        });

        it('hexstring _id to ObjectId(hexstring)', function*() {
          var id = String(lastOfUs._id);
          var arr = yield User.aggregate([{ $match: { _id: id } }]);
          assert.equal(1, arr.length);
          assert.equal('Last Of Us', arr[0].name);
        });

        it('ObjectId _id to { _id: args }', function*() {
          var arr = yield User.aggregate([{ $match: lastOfUs._id }]);
          assert.equal(1, arr.length);
          assert.equal('Last Of Us', arr[0].name);
        });
      });

      describe('.stream()', function() {
        it('returns a stream', function(done) {
          var err = null;
          var docs = [];

          var stream = User.aggregate([{ $match: { aggregate: true } }]).stream();
          stream.on('readable', function() {
            var doc;
            while ((doc = stream.read()) !== null) {
              docs.push(doc);
            }
          });

          stream.on('error', function(error) {
            err = error;
          });

          stream.on('end', function() {
            if (err) return done(err);
            assert.equal(3, docs.length);
            done();
          });
        });

        it('accepts options', function(done) {
          var err = null;
          var docs = [];

          var stream = User.aggregate(
            [{ $match: { aggregate: true } }],
            { cursor: { batchSize: 4 } }
          ).stream();

          stream.on('readable', function() {
            var doc;
            while ((doc = stream.read()) !== null) {
              docs.push(doc);
            }
          });

          stream.on('error', function(error) {
            err = error;
          });

          stream.on('end', function() {
            if (err) return done(err);
            assert.equal(3, docs.length);
            done();
          });
        });
      });

      describe('arguments', function() {
        describe('pipeline', function() {
          it('is required', function*() {
            assert.throws(function() {
              User.aggregate();
            }, /pipeline must be an array/);
          });
        });
      });
    });

    describe('#findOneAndUpdate()', function() {
      var inserted = [
        { findOneAndUpdate: true },
        { findOneAndUpdate: true }
      ];

      before(function*() {
        yield User.insert(inserted);
      });

      it('returns an mquery', function(done) {
        var query = User.findOneAndUpdate({}, {});
        assert(query instanceof mquery);
        done();
      });

      it('responds with a single doc', function*() {
        var query = { findOneAndUpdate: true };
        var update = { $set: { color: 'green' } };
        var doc = yield User.findOneAndUpdate(query, update);
        assert(doc);
        assert.equal('green', doc.color);
      });

      it('does not throw an error when no doc is found', function*() {
        var query = { findOneAndUpdate: true, asdf: '3hfa' };
        var update = { $set: { color: 'green' } };
        var doc = yield User.findOneAndUpdate(query, update);
        assert.equal(null, doc);
      });

      describe('casts', function() {
        it('hexstring args to { _id: ObjectId(hexstring) }', function*() {
          var id = String(lastOfUs._id);
          var doc = yield User.findOneAndUpdate(id, {
            $set: { findAndModified: 5 }
          });
          assert(doc);
          assert.equal('Last Of Us', doc.name);
        });

        it('hexstring _id to ObjectId(hexstring)', function*() {
          var id = String(lastOfUs._id);
          var doc = yield User.findOneAndUpdate({ _id: id }, {
            $unset: { findAndModified: true }
          });
          assert(doc);
          assert.equal('Last Of Us', doc.name);
        });

        it('ObjectId args to { _id: args }', function*() {
          var doc = yield User.findOneAndUpdate(lastOfUs._id, {
            $set: { findAndModified: 5 }
          });
          assert(doc);
          assert.equal('Last Of Us', doc.name);
        });
      });

      describe('arguments', function() {
        describe('options', function() {
          describe('new', function() {
            it('defaults to true', function*() {
              var query = { findOneAndUpdate: true };
              var update = { $set: { color: 'blue' } };
              var doc = yield User.findOneAndUpdate(query, update);
              assert(doc);
              assert.equal('blue', doc.color);
            });
            it('can be overridden', function*() {
              var query = { findOneAndUpdate: true };
              var update = { $set: { color: 'red' } };
              var opts = { new: false };
              var doc = yield User.findOneAndUpdate(query, update, opts);
              assert(doc);
              assert(doc.color !== 'red');
            });
          });
        });
      });
    });

    describe('#findOneAndRemove()', function() {
      var inserted = [
        { findOneAndRemove: true },
        { findOneAndRemove: true }
      ];

      before(function*() {
        yield User.insert(inserted);
      });

      it('returns an mquery', function(done) {
        var query = User.findOneAndRemove({}, {});
        assert(query instanceof mquery);
        done();
      });

      it('responds with a single doc', function*() {
        var doc = yield User.findOneAndRemove({ findOneAndRemove: true });
        assert(doc);
        var remaining = yield User.count({ findOneAndRemove: true });
        assert.equal(1, remaining);
      });

      it('does not throw an error when no doc is found', function*() {
        var doc = yield User.findOneAndRemove({
          findOneAndRemove: true,
          asdf: '3hfa'
        });
        assert.equal(null, doc);
      });

      describe('casts', function() {
        it('hexstring args to { _id: ObjectId(hexstring) }', function*() {
          var id = String(lastOfUs._id);
          var doc = yield User.findOneAndRemove(id);
          assert(doc);
          assert.equal('Last Of Us', doc.name);
          yield User.insert(doc);
        });

        it('hexstring _id to ObjectId(hexstring)', function*() {
          var id = String(lastOfUs._id);
          var doc = yield User.findOneAndRemove({ _id: id });
          assert(doc);
          assert.equal('Last Of Us', doc.name);
          yield User.insert(doc);
        });

        it('ObjectId _id to { _id: args }', function*() {
          var doc = yield User.findOneAndRemove(lastOfUs._id);
          assert(doc);
          assert.equal('Last Of Us', doc.name);
          yield User.insert(doc);
        });
      });
    });

    describe('#count()', function() {
      it('returns an mquery', function(done) {
        var query = User.count();
        assert(query instanceof mquery);
        done();
      });

      it('responds with a number', function*() {
        yield User.insert([{ counter: 'fun' }, { counter: 'stuff' }]);
        var count = yield User.count({ counter: { $exists: true } });
        assert.equal(2, count);
      });

      it('accepts a selector', function*() {
        var count = yield User.count({ counter: 'stuff' });
        assert.strictEqual(1, count);
      });

      it('accepts options', function*() {
        var count = yield User.count({}, { skip: 100 });
        assert.strictEqual(0, count);
      });

      describe('casts', function() {
        it('hexstring args to { _id: ObjectId(hexstring) }', function*() {
          var count = yield User.count(String(lastOfUs._id));
          assert.strictEqual(1, count);
        });

        it('hexstring _id to ObjectId(hexstring)', function*() {
          var count = yield User.count({ _id: String(lastOfUs._id) });
          assert.strictEqual(1, count);
        });

        it('ObjectId args to { _id: args }', function*() {
          var count = yield User.count(lastOfUs._id);
          assert.strictEqual(1, count);
        });
      });
    });

    describe('#drop()', function() {
      it('returns a thunk', function*() {
        var fn = Dropper.drop({});
        assert.equal('function', typeof fn);
      });

      it('deletes all collection contents', function*() {
        yield Dropper.insert({ hi: 'there' });
        assert.strictEqual(1, yield Dropper.count());
        yield Dropper.drop();
        assert.strictEqual(0, yield Dropper.count());
      });

      it('returns a promise', function(done) {
        var fn = Dropper.insert({ large: 'r than life' });
        fn(function(err) {
          if (err) return done(err);
          var p = Dropper.drop({});
          p.then(win, done);
          function win(res) {
            assert(res);
            done();
          }
        });
      });

    });

    describe('#distinct()', function() {
      var doc1 = { distinct: 'pebble' };
      var doc2 = { distinct: 'steel', m: true };

      before(function*() {
        yield User.insert([doc1, doc2]);
      });

      it('returns an mquery', function(done) {
        var query = User.distinct('key');
        assert(query instanceof mquery);
        done();
      });

      it('requires a key string', function() {
        var tests = [{}, Math, Math.max, [], undefined, null, 3, /asdf/];

        tests.forEach(function(test) {
          assert.throws(function() {
            User.distinct(test);
          });
        });
      });

      it('responds with an array', function*() {
        var distinct = yield User.distinct('distinct');
        distinct.sort();

        assert.deepEqual(['pebble', 'steel'], distinct);
      });

      it('accepts a selector', function*() {
        var distinct = yield User.distinct('distinct', { m: true });
        assert.strictEqual(1, distinct.length);
        assert.equal('steel', distinct[0]);
      });

      describe('casts', function() {
        it('hexstring args to { _id: ObjectId(hexstring) }', function*() {
          var distinct = yield User.distinct('distinct', String(doc1._id));
          assert.equal('pebble', distinct[0]);
        });

        it('hexstring _id to ObjectId(hexstring)', function*() {
          var distinct = yield User.distinct('distinct', { _id: String(doc1._id) });
          assert.equal('pebble', distinct[0]);
        });

        it('ObjectId args to { _id: args }', function*() {
          var distinct = yield User.distinct('distinct', doc1._id);
          assert.equal('pebble', distinct[0]);
        });
      });
    });

    describe('#indexes()', function() {
      it('returns a thunk', function*() {
        var fn = User.indexes();
        assert.equal('function', typeof fn);
      });

      it('returns a promise', function(done) {
        var p = User.indexes();
        p.then(win, done);
        function win(res) {
          assert(Array.isArray(res));
          assert.equal(1, res.length);
          done();
        }
      });

      it('responds with an array', function*() {
        var info = yield User.indexes();
        assert(Array.isArray(info));
        assert.equal(1, info.length);
      });

      it('accepts options', function*() {
        var info = yield User.indexes({ full: false });
        assert(typeof info === 'object' && info != null);
        assert('_id_' in info);
      });
    });

    describe('#index()', function() {
      it('returns a thunk', function(done) {
        var fn = User.index({ name: 1 });
        assert.equal('function', typeof fn);
        done();
      });

      it('returns a promise', function(done) {
        var p = User.index({ x: 1 });
        p.then(win, done);
        function win(res) {
          assert(res);
          done();
        }
      });

      it('requires an index definition', function(done) {
        assert.throws(function() {
          User.index();
        }, /missing/);
        done();
      });

      it('accepts options', function*() {
        var name = 'asdfjak3ld';

        var def = {};
        def[name] = 1;

        yield User.index(def, { sparse: true });
        var info = yield User.indexes();

        var indexName = name + '_1';

        var exists = info.some(function(index) {
          return index.name === indexName && !!index.sparse;
        });

        assert(exists);
      });
    });

    describe('#dropIndex()', function() {
      it('returns a thunk', function(done) {
        var fn = User.dropIndex({ name: 1 });
        assert.equal('function', typeof fn);
        done();
      });

      it('returns a promise', function(done) {
        var p = User.dropIndex({ x: 1 });
        p.then(win, done);
        function win(res) {
          assert(res);
          done();
        }
      });

      it('requires an index definition', function() {
        assert.throws(function() {
          User.dropIndex();
        }, /invalid index definition/);
      });

      it('accepts string input', function*() {
        var name = 'qwertyui';
        var def = {};
        def[name] = 1;

        yield User.index(def, { sparse: true });
        var info = yield User.indexes();
        assert.equal(3, info.length);

        var indexDefString = name + '_1';
        yield User.dropIndex(indexDefString);
        info = yield User.indexes();
        assert.equal(2, info.length);
      });

      it('accepts object input', function*() {
        var name = 'asdfghjk';
        var def = {};
        def[name] = 1;

        yield User.index(def, { sparse: true });
        var info = yield User.indexes();
        assert.equal(3, info.length);

        var indexDefObject = def;
        yield User.dropIndex(indexDefObject);
        info = yield User.indexes();
        assert.equal(2, info.length);
      });

      it('rejects non-string, non-objects', function*() {
        var invalids = [
          null,
          undefined,
          [],
          Math.max,
          NaN,
          394
        ];

        invalids.forEach(function(invalid) {
          assert.throws(function() {
            User.dropIndex(invalid);
          }, /invalid index definition/);
        });
      });
    });

    describe('#where()', function() {
      it('returns an mquery', function(done) {
        var query = User.where('x');
        assert(query instanceof mquery);
        done();
      });
    });

    describe('#setOptions', function() {
      it('sets default options for all queries', function(done) {
        var C = db.col('options');
        C.setOptions({ maxTime: 500 });
        var query = C.find();
        assert.equal(500, query.options.maxTimeMS);
        done();
      });
    });

    /*
    describe('#mapReduce', function() {
      // casting

    });
    describe('#geoNear', function() {
      // casting

    });
    describe('#geoSearch', function() {
      // casting

    });
    */
  }

  describe('Db', function() {
    var db;

    before(function*() {
      db = yield m.connect(uri);
    });

    describe('close()', function() {
      it('returns a thunk', function*() {
        assert('function', typeof db.close());
      });

      it('returns a promise', function*() {
        assert('function', typeof db.close().then);
      });

      describe('promise resolver fn', function() {
        var database;
        before(function*() {
          database = yield m.connect(uri);
        });

        it('executes when promise is immediately resolved', function(done) {
          // https://github.com/pebble/yieldb/issues/11

          var resolved = false;
          database.close().then(function() {
            resolved = true;
          }, done);

          setTimeout(function() {
            assert(resolved, 'resolve fn did not fire');
            done();
          }, 5);
        });
      });
    });

    describe('col()', function() {
      it('returns a collection', function*() {
        var name = 'users';
        var user = db.col(name);
        assert(user instanceof m.Collection);
        assert.equal(name, user.name);
      });
    });

    describe('listCollections()', function() {
      it('returns a thunk', function*() {
        assert('function', typeof db.listCollections());
      });

      it('returns a promise', function*() {
        assert('function', typeof db.listCollections().then);
      });

      it('list collection names', function*() {
        var db = yield m.connect(uri);

        var X = db.col('x');
        yield [ X.insert({ pebble: true }) ];

        var names = yield db.listCollections();
        yield X.drop();

        assert.equal(2, names.length);
        names = names.map(function(col) {
          return col.name.replace(db.db.databaseName + '.', '');
        }).sort();
        assert.deepEqual(['system.indexes', 'x'], names);
      });
    });

    describe('drop()', function() {
      it('returns a thunk', function*() {
        assert('function', typeof db.drop());
      });

      it('returns a promise', function*() {
        assert('function', typeof db.drop().then);
      });

      it('deletes all database contents', function*() {
        var db = yield m.connect(uri);

        var X = db.col('x');
        var Y = db.col('y');

        yield [ X.insert({ pebble: true }), Y.insert({ pebble: true }) ];
        yield db.drop();

        var count = yield [ X.count(), Y.count() ];
        assert.strictEqual(0, count[0] + count[1]);
      });
    });

    describe('serverStatus()', function() {
      it('returns a thunk', function*() {
        assert('function', typeof db.serverStatus());
      });

      it('returns a thunk', function*() {
        assert('function', typeof db.serverStatus().then);
      });

      it('executes a serverStatus command', function*() {
        var res = yield db.serverStatus();
        assert(res.host);
      });
    });

    describe('ping()', function() {
      it('returns a thunk', function*() {
        assert('function', typeof db.ping());
      });

      it('returns a promise', function*() {
        assert('function', typeof db.ping().then);
      });

      it('executes a ping command', function*() {
        var res = yield db.ping();
        assert.equal(1, res.ok);
      });
    });
  });

  describe('helper.js', function() {
    describe('cast', function() {
      it('disallows non-hexstrings and object arguments', function(done) {
        var tests = [
          function() {},
          3,
          'asdf'
        ];

        tests.forEach(function(test) {
          assert.throws(function() {
            helper.cast(test);
          }, /invalid selector/);
        });

        done();
      });
    });

    describe('makeThen()', function() {
      it('returns function', function(done) {
        var fn = helper.makeThen();
        assert.equal('function', typeof fn);
        done();
      });

      describe('creates a function which when executed', function() {
        it('runs the function originally passed', function(done) {
          var ran = false;
          var fn = helper.makeThen(function() {
            ran = true;
          });

          fn();
          assert(ran);
          done();
        });

        it('returns a promise', function(done) {
          var fn = helper.makeThen(function() {});
          var p = fn();
          assert.equal('function', typeof p.then);
          done();
        });
      });

    });
  });

});
