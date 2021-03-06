/**
 * Created by cuccpkfs on 15-5-12.
 */
"use strict";

var now;
function getNow(){
  if (now) {
    return now;
  } else {
    setInterval(function(){
      now = Date.now();
    }, 100);
    return now = Date.now();
  }
};

var util = require("util")
  , events = require("events")
  , reqCnt = 0
  , debug = require('debug')('noradle:steps')
  , writeFrame = require('noradle-protocol').frame.writeFrame
  , C = require('noradle-protocol').constant
  ;

function split2nvs(lines){
  var nvs = {}, nv, setCookies = false;
  for (var i = 0, len = lines.length - 2; i < len; i++) {
    nv = lines[i].split(': ');
    if (setCookies) {
      setCookies.push(nv[1]);
    } else if (nv[0] === 'Set-Cookie') {
      nvs['Set-Cookie'] = setCookies = [nv[1]];
    } else {
      nvs[nv[0]] = nv[1];
    }
  }
  return nvs;
};

function Request(slotID, stream, env){
  events.EventEmitter.call(this);
  this._buf = [];
  this.headerSent = false;
  this.quitting = false;
  this.error = false;
  this.follows = [];
  this.slotID = slotID;
  this.stream = stream;
  this.env = env;
  this.reqCnt = ++reqCnt;
  //this.stime = getNow();
}
util.inherits(Request, events.EventEmitter);

Request.prototype.init = function(protocol, hprof){
  console.log('\n\n', protocol, hprof);
  var idx = 0;
  if (protocol) {
    this._buf.push('b$protocol', protocol);
  }
  if (hprof) {
    this._buf.push('b$hprof', +hprof);
  }
  return this;
};

Request.prototype.addHeaders = function(obj, pre, encode){
  var buf = this._buf
    , core = arguments.length >= 2
    ;
  pre = pre || '';
  for (var n in obj) {
    if (obj.hasOwnProperty(n) && n.substr(0, 2) !== '__' && (core || n.charAt(1) !== '$')) {
      var v = obj[n];
      if (v instanceof Array) {
        buf.push('*' + pre + n, v.length);
        if(encode) {
          v = v.map(function(v){ return encodeURIComponent(v); });
        }
        Array.prototype.push.apply(buf, v);
      } else if (v !== undefined) {
        buf.push(pre + n, encode ? encodeURIComponent(v) : v);
      }
    }
  }
  return this;
};

Request.prototype.addHeader = function(name, value, encode){
  this._buf.push(name, encode ? encodeURIComponent(value) : value );
  return this;
};

Request.prototype._sendHeaders = function(){
  if (this.headerSent) return;
  writeFrame(this.stream, this.slotID, C.HEAD_FRAME, 0, new Buffer(this._buf.join('\r\n') + '\r\n\r\n\r\n'));
  this.headerSent = true;
  return this;
};

Request.prototype.write = function(chunk){
  this._sendHeaders();
  if (!chunk) return this;
  writeFrame(this.stream, this.slotID, C.BODY_FRAME, 0, chunk);
  debug(this.reqCnt, this.env, 'header sent');
  return this;
};

/**
 * send fin frame for the request
 * @param cb onResponse(status, headers) when response header is received
 */
Request.prototype.end = function(cb){
  var req = this, res, status, headers, session;
  req.addListener('response', cb);
  this._sendHeaders();
  // mark zero-length frame for end of request
  writeFrame(this.stream, this.slotID, C.END_FRAME, 0, null);
  this.on('frame', function(head, slotID, type, flag, len, body){
    switch (type) {
      case C.HEAD_FRAME:
        var lines = body.toString('utf8').split('\r\n')
        debug('response head', lines);
        status = parseInt(lines.shift().split(' ')[1]);
        headers = split2nvs(lines);
        res = new Response(status, headers);
        req.emit('response', res);
        break;
      case C.SESSION_FRAME:
        debug('response session, %s', body.toString('utf8'));
        var lines = body.toString('utf8').split('\r\n');
        lines.pop();
        session = split2nvs(lines);
        res.emit('session', session);
        break;
      case C.END_FRAME:
        debug('all response received');
        if (!req.error) res.emit('end', []);
        return;
      case C.ERROR_FRAME:
        debug('error received', body.toString());
        req.error = true;
        req.emit('error', body);
        return;
      default:
        // C.BODY_FRAME, C.CSS_FRAME
        debug('response body, %s', body && body.length);
        res.emit('data', body, type);
    }
  });
};

function Response(status, headers, cached){
  events.EventEmitter.call(this);
  this.status = status;
  this.headers = headers;
  this.cached = cached;
}
util.inherits(Response, events.EventEmitter);

exports.Request = Request;
exports.Response = Response;
