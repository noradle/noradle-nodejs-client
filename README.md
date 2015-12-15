introduce
==========

[noradle-nodejs-client][] use [noradle-protocol][] to connect to [noradle-dispatcher][], 
access [oracle plsql servlet][noradle-oracle-server].

it support the following noradle modules:

* [noradle-http]
* [noradle-ndbc]
* [noradle-fcgi]

  [noradle-nodejs-client]: https://github.com/noradle/noradle-nodejs-client
  [noradle-protocol]: https://github.com/noradle/noradle-protocol
  [noradle-dispatcher]: https://github.com/noradle/noradle-dispatcher
  [noradle-http]: https://github.com/noradle/noradle-http
  [noradle-ndbc]: https://github.com/noradle/noradle-ndbc
  [noradle-fcgi]: https://github.com/noradle/noradle-fcgi
  [noradle-oracle-server]: https://github.com/noradle/noradle-oracle-server

let client to connect to dispatcher
========================================

```
var DBDriver = require('noradle-nodejs-client').DBDriver;
var dbPool = DBDriver.connect([port, ip], {cid:"xxx", passwd:"xxx"});
```

* first parameter for DBDriver.connect is the same as node's socket.connect(),
  id can be [port], [port,ip] or [path].
* secondary parameter for noradle.DBDriver.connect is client's client id and password for dispatcher

Use internal rudimentary API to access ORACLE
=============================================

it's like a node http request API with a db-driver like find free path to server beforehand.

```javascript

dbPool.findFree(env, db_selector, function(err, oraReq){
  // env: identifier or marker for the request for logger or monitor
  // db_selector: when dispatcher hold OSP from RAC/DG instances, specify the selection rule
  // when dbPool find a free access slot, findFree callback will be called with a new oraReq instance
  if (err) {
    // basically, there are no error for dbPool.findFree
    console.error(err);
    return;
  }
  oraReq
    .init('DATA', '')
    .addHeader('uid', 'kaven276')
    .addHeaders({dbu:'demo',prog:'show_user_name_b'}, 'x$')
    .write(body)
    .on('response', onResponse)
    .on('error', onError)
    .end(onResponse)
  ;
  // .addHeader(s) can add name/value(s) pair that can be got by pl/sql r.getx series API
  // .write(body) data will fill pl/sql package variable rb.blob_entity
  // .end(onResponse) can is just .on('response', onRepsonse).end() combined
  // any exception for the request/response cycle will emit error
  // any pl/sql servlet call must have x$dbu,x$prog headers to specify which PL/SQL procedure to execute
  function onResponse(oraRes) {
     console.log(oraRes.status, oraRes.headers);
     oraRes.on('data', function(data){
       ...
     }
     oraRes.on('end', function(){
       ...
     }
  }
  function onError(error){
    ...
  });
```
