
/**
 * Copyright 2013, 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modifications copyright (C) 2016 Sense Tecnic Systems, Inc.
 * 
 **/

/**
 *
 * Node for setting up connection to FRED
 * Based on Node-RED core websocket node
 * 
 */

var p = require('./package.json');

module.exports = function(RED) {
  "use strict";
  var ws = require("ws");
  var inspect = require("util").inspect;
  var FRED_UNAUTHORIZED_ERROR = 'unexpected server response (401)';

  // A node red node that is either a FRED client or server
  function FredEndpointNode(n) {
    RED.nodes.createNode(this,n);
    var node = this;

    // Store local copies of the node configuration (as defined in the .html)
    node.isServer = (n.type === 'fred-server');
    node.private = n.private || false;
    node.endpoint = n.endpoint;
    node.fredUsername = n.username;

    // note - credentials are not passed in with config
    node.fredAPIKey = node.credentials?node.credentials.apikey : null;

    node.wholemsg = (n.wholemsg === "true");

    node._inputNodes = [];    // collection of nodes that want to receive events
    node._clients = {};

    if (node.isServer) {
      if (node.private) {
        node.path = "__"+node.endpoint;
      } else {
        node.path = "/public/__"+node.endpoint;
      }
    } else {
      node.path = p.config.fredHost;    // change host in the package for testing
      if (!node.private) {
        node.path = node.path + "/public/" + node.fredUsername + "/__" + node.endpoint;
      } else {
        node.path = node.path + "/api/__" + node.endpoint;
      }
    }

    node.closing = false;
    node.unauthorized = false;

    function startconn() {    // Connect to remote endpoint
      var opts = {};

      if (node.fredUsername && node.fredAPIKey) {
        opts = {
          headers: {
            "X-Auth-User": node.fredUsername,
            "X-Auth-Key": node.fredAPIKey
          }
        };
      }
      var socket = new ws(node.path, opts);
      node.server = socket; // keep for closing
      handleConnection(socket);
    }

    function handleConnection(/*socket*/socket) {
      var id = (1+Math.random()*4294967295).toString(16);
      if (node.isServer) { 
        node._clients[id] = socket; 
        node.emit('opened',Object.keys(node._clients).length); 
      }

      socket.on('open',function() {
        if (!node.isServer) {
          node.emit('opened','');
        }
      });
      socket.on('close',function() {
        if (node.isServer) { 
          delete node._clients[id]; 
          node.emit('closed',Object.keys(node._clients).length); 
        } else { 
          node.emit('closed'); 
        }
        if (!node.closing && !node.isServer && !node.unauthorized) { // don't reconnect if server returns 401 unauthorized
          if (node.tout) { 
            clearTimeout(node.tout); 
          }
          node.emit('reconnecting');
          node.tout = setTimeout(function(){ startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
        }
      });
      socket.on('message',function(data,flags) {
        node.handleEvent(id,socket,'message',data,flags);
      });
      socket.on('error', function(err) {
        node.emit('erro', err.message);

        if (!node.closing && !node.isServer && !node.unauthorized) {
          if (err.message === FRED_UNAUTHORIZED_ERROR) {
            node.unauthorized = true; // don't reconnect again if server returns 401 unauthorized
          }
          if (node.tout) { 
            clearTimeout(node.tout); 
          }
          node.emit('reconnecting');
          node.tout = setTimeout(function(){ startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
        }
      });
    }

    // we need the fred username in order to proxy the web socket request, can't do anything without it
    if (!node.fredUsername && !node.isServer) {
      node.error(RED._("fred.errors.missing-username"));
      return; // this will be caught in FredEndpointNode.prototype.broadcast and message will be shown on the node
    }

    if (node.isServer) {
      var path = RED.settings.httpNodeRoot || "/";
      path = path + (path.slice(-1) == "/" ? "":"/") + (node.path.charAt(0) == "/" ? node.path.substring(1) : node.path);

      // Workaround https://github.com/einaros/ws/pull/253
      // Listen for 'newListener' events from RED.server
      node._serverListeners = {};

      var storeListener = function(/*String*/event,/*function*/listener){
        if(event == "error" || event == "upgrade" || event == "listening"){
          node._serverListeners[event] = listener;
        }
      }

      RED.server.addListener('newListener',storeListener);

      // Create a WebSocket Server
      node.server = new ws.Server({
        server:RED.server,
        path:path,
        // Disable the deflate option due to this issue
        //  https://github.com/websockets/ws/pull/632
        // that is fixed in the 1.x release of the ws module
        // that we cannot currently pickup as it drops node 0.10 support
        perMessageDeflate: false
      });

      // Workaround https://github.com/einaros/ws/pull/253
      // Stop listening for new listener events
      RED.server.removeListener('newListener',storeListener);

      node.server.on('connection', handleConnection);
    }
    else {
      node.closing = false;
      startconn(); // start outbound connection
    }

    node.on("close", function() {
      // Workaround https://github.com/einaros/ws/pull/253
      // Remove listeners from RED.server
      if (node.isServer) {
        var listener = null;
        for (var event in node._serverListeners) {
          if (node._serverListeners.hasOwnProperty(event)) {
            listener = node._serverListeners[event];
            if (typeof listener === "function") {
              RED.server.removeListener(event,listener);
            }
          }
        }
        node._serverListeners = {};
        node.server.close();
        node._inputNodes = [];
      }
      else {
        node.closing = true;
        node.server.close();
        if (node.tout) { 
          clearTimeout(node.tout); 
        }
      }
    });
  }
  RED.nodes.registerType("fred-server",FredEndpointNode);

  RED.nodes.registerType("fred-client",FredEndpointNode, {
    credentials: {
      apikey: {type:"text"}
    }
  });

  FredEndpointNode.prototype.registerInputNode = function(/*Node*/handler) {
    this._inputNodes.push(handler);
  }

  FredEndpointNode.prototype.removeInputNode = function(/*Node*/handler) {
    this._inputNodes.forEach(function(node, i, inputNodes) {
      if (node === handler) {
        inputNodes.splice(i, 1);
      }
    });
  }

  FredEndpointNode.prototype.handleEvent = function(id,/*socket*/socket,/*String*/event,/*Object*/data,/*Object*/flags){
    var msg;
    if (this.wholemsg) {
      try {
        msg = JSON.parse(data);
      }
      catch(err) {
        msg = { payload:data };
      }
    } else {
      msg = {
        payload:data
      };
    }
    msg._session = {type:"websocket",id:id};
    for (var i = 0; i < this._inputNodes.length; i++) {
      this._inputNodes[i].send(msg);
    }
  }

  FredEndpointNode.prototype.broadcast = function(data) {
    try {
      if(this.isServer) {
        for (var i = 0; i < this.server.clients.length; i++) {
          this.server.clients[i].send(data);
        }
      }
      else {
        if (this.server) {
          this.server.send(data);
        } else {
          if (!this.fredUsername) {
            this.emit('erro', RED._("fred.errors.missing-username")); 
          } else {
            this.emit('erro', RED._("fred.errors.connect-error")); 
          }
        }        
      }
    }
    catch(e) { // swallow any errors
      this.warn("ws:"+i+" : "+e);
    }
  }

  FredEndpointNode.prototype.reply = function(id,data) {
    var session = this._clients[id];
    if (session) {
      try {
        session.send(data);
      }
      catch(e) { // swallow any errors
      }
    }
  }

  function FredInNode(n) {
    RED.nodes.createNode(this,n);
    this.server = (n.client)?n.client:n.server;
    var node = this;
    this.serverConfig = RED.nodes.getNode(this.server);
    if (this.serverConfig) {
      this.serverConfig.registerInputNode(this);
      // TODO: nls
      this.serverConfig.on('opened', function(n) { 
        node.status({fill:"green",shape:"dot",text:"connected "+n}); 
      });
      this.serverConfig.on('erro', function(err) { 
        if (err) {
          node.error(RED._("fred.errors.connect-error")+inspect(err));
          node.status({fill:"red",shape:"ring",text:err});
        }
        else {
          node.status({fill:"red",shape:"ring",text:"error"}); 
        }
      });
      this.serverConfig.on('closed', function() { 
        if (node.serverConfig && node.serverConfig.unauthorized) {
          node.status({fill: "red",shape:"dot",text:"unauthorized"});
        } else if (node.serverConfig && !node.serverConfig.username) {
          node.status({fill: "red",shape:"dot",text: RED._("fred.errors.missing-username")});
        } else {
          node.status({fill:"red",shape:"ring",text:"disconnected"});   
        }
      });
      this.serverConfig.on('reconnecting', function() {
        node.status({fill:"grey",shape:"ring",text:"reconnecting"});
      });
    } else {
      this.error(RED._("fred.errors.missing-conf"));
    }

    this.on('close', function() {
      node.serverConfig.removeInputNode(node);
    });

  }
  RED.nodes.registerType("fred in",FredInNode);

  function FredOutNode(n) {
    RED.nodes.createNode(this,n);
    var node = this;
    this.server = (n.client)?n.client:n.server;
    this.serverConfig = RED.nodes.getNode(this.server);

    if (!this.serverConfig) {
      this.error(RED._("fred.errors.missing-conf"));
    }
    else {
      // TODO: nls
      this.serverConfig.on('opened', function(n) { 
        node.status({fill:"green",shape:"dot",text:"connected "+n}); 
      });
      this.serverConfig.on('erro', function(err) { 
        if (err) {
          node.error(RED._("fred.errors.connect-error")+inspect(err));
          node.status({fill:"red",shape:"ring",text:err}); 
        }
        else {
          node.status({fill:"red",shape:"ring",text:"error"}); 
        }
      });
      this.serverConfig.on('closed', function() { 
        if (node.serverConfig && node.serverConfig.unauthorized) {
          node.status({fill: "red",shape:"dot",text:"unauthorized"});
        } else if (node.serverConfig && !node.serverConfig.username) {
          node.status({fill: "red",shape:"dot",text: RED._("fred.errors.missing-username")});
        } else {
          node.status({fill:"red",shape:"ring",text:"disconnected"});   
        }        
      });
      this.serverConfig.on('reconnecting', function() {
        console.log("CHECK2")
        node.status({fill:"grey",shape:"ring",text:"reconnecting"});
      });
    }
    this.on("input", function(msg) {
      var payload;
      if (this.serverConfig.wholemsg) {
        delete msg._session;
        payload = JSON.stringify(msg);
      } else if (msg.hasOwnProperty("payload")) {
        if (!Buffer.isBuffer(msg.payload)) { // if it's not a buffer make sure it's a string.
          payload = RED.util.ensureString(msg.payload);
        }
        else {
          payload = msg.payload;
        }
      }
      if (payload) {
        if (msg._session && msg._session.type == "websocket") {
          node.serverConfig.reply(msg._session.id,payload);
        } else {
          node.serverConfig.broadcast(payload,function(error){
            if (!!error) {
              node.warn(RED._("fred.errors.send-error")+inspect(error));
            }
          });
        }
      }
    });
  }
  RED.nodes.registerType("fred out",FredOutNode);
}
