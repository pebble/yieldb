# comongo

```js

// need a driver collection
// need a model
// need instances of model (documents)

// yieldable model actions:
  - update
  - insert
  - findAndModify
  - remove
  - find
  - findOne
  - aggregate
  - search

// support _id casting for these methods

// yieldable document actions

  - $set
  - $unset
  - $inc
  - $rename
  - $push
  - $pushAll
  - $pull
  - $pullAll
  - $pop
  - $shift
  - $addToSet
  - $reload
  - $save (like $thunk)

/// nice to have
// alter the mongodb driver to accept a stub object for
// deserializing bson into our model instance (speed nerd)

```
var comongo = require('comongo');

// return an object which wraps the native db and delegates properties/methods
var db = yield comongo.connect(uri);

// add a custom model method
var User = db.model('users')

User.find(id)
User.findOne(id)
User.remove(id)
User.update(id, { $set: .. })
User.insert(docs)
User.findAndModify(id, modifier)
User.remove(id)
User.aggregate()
User.search('test search')

// TODO how to stream find, aggregate, and search results??

var aaron = User.new(obj)
aaron.$set(key, val)
aaron.$push(key, vals)
yield aaron.$save()

var exists = User.init(obj)
exists.$addToSet(key, vals)
yield exists.$save()

////

var db = yield comongo.connect(url);

// auto fetch collections? no. some collection names may collide. avoid it. allow user to do whatever

var User = db.col('users');

User.find(id)
User.find(id).stream()
User.findOne(id)
User.remove(id)
User.update(id, { $set: .. })
User.insert(docs)
User.findAndModify(id, modifier)
User.remove(id)
User.aggregate()
User.aggregate().stream()
User.search('test search')
User.where() // mquery

this.db.User.find(id)
this.db.users().findById(id)

updates: how can we support modifying doc in memory and writing to db?
for now, skip it. not essential. nice to add through an option later

var doc = User.findOne(id);
yield User.update(query, modifier, options);
yield User.update(query, modifier, { doc: doc });
yield User.update(doc, query, modifier, options);

