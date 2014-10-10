# yieldb

Simple, expressive and yieldable MongoDB.

```js
var co = require('co');
var connect = require('yieldb').connect;

co(function*(){
  var db = yield connect(url);

  var User = db.col('users');

  yield User.findOne(id)    // mquery
  yield User.remove(id)     // mquery
  yield User.update(id, { $set: .. })    // mquery
  yield User.findAndModify(id, modifier) // mquery
  yield User.remove(id)     // mquery
  yield User.where()        // mquery
  yield User.distinct(key)  // mquery

  yield User.find(id)       // mquery
  yield User.find(id).stream()

  yield User.insert(docs)   // thunk
  yield User.drop()         // thunk
  yield User.aggregate()    // thunk
  yield User.aggregate().stream()

  yield User.index()        // thunk
  yield User.indexes()      // thunk
})()
```

`yieldb` makes working with [mongodb](https://www.mongodb.org/) and
[co](https://github.com/visionmedia/co/)/[koa](http://koajs.com/) a breeze.

### connect

Connecting to mongodb is easy.

```js
var co = require('co');
var connect = require('yieldb').connect;

co(function*(){
  var db = yield connect(mongodbUri [, options]);
})()
```

Replica-sets, sharding and all the features available through the
[mongodb driver](http://mongodb.github.io/node-mongodb-native/driver-articles/mongoclient.html)
are supported out of the box.

### collections

`yieldb` Collections provide a simple, constistent interface to work with mongodb collections.
Call `db.col(collectionName)` to get a collection.

```js
var co = require('co');
var connect = require('yieldb').connect;

co(function*(){
  var db = yield connect(mongodbUri [, options]);

  // get a collection
  var User = db.col('users');

  // look up a user
  var doc = yield User.findOne(id);
})()
```

Key features:

#### yieldable

Each collection method returns a yieldable. For example:

```
var User = db.col('users');

yield User.insert({ name: 'yieldb' });
var doc = yield User.find({ name: 'yieldb' });
```

#### _id casting

Any collection method which accepts selector arguments will benefit from
auto-casting `_id` hexStrings to `ObjectId`. For example:

```js
var User = db.col('users');
var ObjectId = require('mongodb').ObjectID;

// the following are equivalent
var doc = yield User.findOne('541b432d84dd6253074aabe6');
var doc = yield User.findOne({ _id: '541b432d84dd6253074aabe6' });
var doc = yield User.findOne({ _id: new ObjectId('541b432d84dd6253074aabe6') });
```

#### query building

Where it makes sense, collection methods return an instance of [mquery](https://github.com/aheckmann/mquery).
This means you can use all the query builder helper methods in mquery.

```js
var User = db.col('users');
var docs = yield User.find({ role: 'developer' })
                     .limit(10)
                     .sort({ name: 'desc' })
                     .read('primaryPreferred');
```

_The methods which do not return `mquery` are `insert()` and `drop()`, which wouldn't
make much sense, and `aggregrate()` which we aim to support in the future
(Pull Request welcome)._

#### promises

Since most collection methods return an `mquery` instance, we get `Promise` support
for free. Call the query builders `then()` method to receive a
[bluebird](https://github.com/petkaantonov/bluebird) `Promise`.

```js
db.col('stats').where({ count: { $gt: 100 }})
               .then(JSON.stringify)
               .then(respond)
               .catch(handleError)
```

### collection methods

#### find

Returns a yieldable mquery instance.

```
yield db.col('watches').find(selector, options);
```

#### findOne

Returns a yieldable mquery instance.

```
yield db.col('watches').findOne(selector, options);
```

#### insert

Accepts either a single object or array of objects.
Objects which do not have an `_id` will receive one assigned a new `ObjectId`.
Returns a yieldable thunk.

```
yield db.col('watches').insert(obj, options);
yield db.col('watches').insert([obj1, obj2, ..], options);
```

#### update

Returns a yieldable mquery instance.

```
yield db.col('watches').update(selector, update, options);
```

#### remove

Returns a yieldable mquery instance.

```
yield db.col('watches').remove(selector, options);
```

#### drop

Returns a yieldable thunk.

```
yield db.col('watches').drop();
```

#### aggregate

Accepts an array of pipeline operations and returns a yieldable thunk.

```
yield db.col('watches').aggregate(pipeline);
```

The thunk also has it's own `stream()` method if that's what you're after.

```
yield db.col('watches').aggregate(pipeline).stream();
```

#### findOneAndUpdate

Returns a yieldable mquery instance.

```
yield db.col('watches').findOneAndUpdate(selector, update, options)
```

#### findOneAndRemove

Returns a yieldable mquery instance.

```
yield db.col('watches').findOneAndRemove(selector, options)
```

#### count

Returns a yieldable mquery instance.

```
yield db.col('watches').count(selector, options)
```

#### distinct

Returns a yieldable mquery instance.

```
yield db.col('watches').distinct(key [, query]);
```


#### where

Returns a yieldable mquery instance.

```
yield db.col('watches').where(selector).select('name email')
```

#### index

Creates an index.
Returns a yieldable thunk.

```
yield db.col('watches').index(indexDefinition, options);
```

#### indexes

Retreives an array of all defined indexes for this collection.
Returns a yieldable thunk.

```
var indexes = yield db.col('watches').indexes();
```

### Installation

```
npm install yieldb --save
```

### Development

#### running tests

- `make test` runs tests
- `make test-cov` runs tests + test coverage
- `make open-cov` opens test coverage results in your browser

#### verbose logging

`yieldb` supports the `debug` module for help during development.
Enable verbose logging by setting your `DEBUG` env variable like so:

````
DEBUG=yieldb* npm test
```

## Sponsored by

[Pebble Technology!](https://getpebble.com)

## License

[MIT](https://github.com/pebble/yieldb/blob/master/LICENSE)
