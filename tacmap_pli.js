/* 
 * Copyright (C) 2015 jdn
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/* global __dirname, require, process */
(function () {
    "use strict";
    var express = require('express');
    var compression = require('compression');
    var url = require('url');
    var request = require('request');
    var bodyParser = require('body-parser');
    var fs = require('fs');
    var cesium = require('./geoserver/cesiumserver');
    //var http = require('http');
    var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
    var yargs = require('yargs').options({
        'port': {
            'default': server_port,
            'description': 'Port to listen on.'
        },
        'public': {
            'type': 'boolean',
            'description': 'Run a public server that listens on all interfaces.'
        },
        'upstream-proxy': {
            'description': 'A standard proxy server that will be used to retrieve data.  Specify a URL including port, e.g. "http://proxy:8000".'
        },
        'bypass-upstream-proxy-hosts': {
            'description': 'A comma separated list of hosts that will bypass the specified upstream_proxy, e.g. "lanhost1,lanhost2"'
        },
        'help': {
            'alias': 'h',
            'type': 'boolean',
            'description': 'Show this help.'
        }
    });
    var argv = yargs.argv;
    if (argv.help) {
        return yargs.showHelp();
    }
    
    var app = express();
    app.use(bodyParser.json());
    app.use(compression());
    app.use(express.static(__dirname + '/public'));
    
   function getRemoteUrlFromParam(req) {
        var remoteUrl = req.params[0];
        if (remoteUrl) {
            // add http:// to the URL if no protocol is present
            if (!/^https?:\/\//.test(remoteUrl)) {
                remoteUrl = 'http://' + remoteUrl;
            }
            remoteUrl = url.parse(remoteUrl);
            // copy query string
            remoteUrl.search = url.parse(req.url).search;
        }
        return remoteUrl;
    }
   
    var dontProxyHeaderRegex = /^(?:Host|Proxy-Connection|Connection|Keep-Alive|Transfer-Encoding|TE|Trailer|Proxy-Authorization|Proxy-Authenticate|Upgrade)$/i;
    function filterHeaders(req, headers) {
        var result = {};
        // filter out headers that are listed in the regex above
        Object.keys(headers).forEach(function(name) {
            if (!dontProxyHeaderRegex.test(name)) {
                result[name] = headers[name];
            }
        });
        return result;
    }

    var upstreamProxy = argv['upstream-proxy'];
    var bypassUpstreamProxyHosts = {};
    if (argv['bypass-upstream-proxy-hosts']) {
        argv['bypass-upstream-proxy-hosts'].split(',').forEach(function(host) {
            bypassUpstreamProxyHosts[host.toLowerCase()] = true;
        });
    }

    app.get('/proxy/*', function(req, res, next) {
        // look for request like http://localhost:8080/proxy/http://example.com/file?query=1
        var remoteUrl = getRemoteUrlFromParam(req);
        if (!remoteUrl) {
            // look for request like http://localhost:8080/proxy/?http%3A%2F%2Fexample.com%2Ffile%3Fquery%3D1
            remoteUrl = Object.keys(req.query)[0];
            if (remoteUrl) {
                remoteUrl = url.parse(remoteUrl);
            }
        }

        if (!remoteUrl) {
            return res.send(400, 'No url specified.');
        }

        if (!remoteUrl.protocol) {
            remoteUrl.protocol = 'http:';
        }

        var proxy;
        if (upstreamProxy && !(remoteUrl.host in bypassUpstreamProxyHosts)) {
            proxy = upstreamProxy;
        }

        // encoding : null means "body" passed to the callback will be raw bytes

        request.get({
            url : url.format(remoteUrl),
            headers : filterHeaders(req, req.headers),
            encoding : null,
            proxy : proxy
        }, function(error, response, body) {
            var code = 500;

            if (response) {
                code = response.statusCode;
                res.header(filterHeaders(req, response.headers));
            }

            res.send(code, body);
        });
    });

    var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
    var server = app.listen(argv.port, argv.public ? undefined : server_ip_address, function() {
        if (argv.public) {
            console.log('TacMap development server running publicly.  Connect to http://localhost:%d/', server.address().port);
        } else {
            console.log('TacMap development server running locally.  Connect to http://localhost:%d/', server.address().port);
        }
    });

    server.on('error', function (e) {
        if (e.code === 'EADDRINUSE') {
            console.log('Error: Port %d is already in use, select a different port.', argv.port);
            console.log('Example: node server.js --port %d', argv.port + 1);
        } else if (e.code === 'EACCES') {
            console.log('Error: This process does not have permission to listen on port %d.', argv.port);
            if (argv.port < 1024) {
                console.log('Try a port number higher than 1024.');
            }
        }
        console.log(e);
        process.exit(1);
    });

    server.on('close', function() {
        console.log('Cesium development server stopped.');
    });

    process.on('SIGINT', function() {
        server.close(function() {
            process.exit(0);
        });
    });
    
//SOCKET IO
    //var server = http.createServer(app);
    /** HTTP Services **/
//    server.listen(server_port, server_ip_address, function () {
//        console.log('listening on ' + server_port);
//    });
    app.get('/', function (req, res) {
        res.sendFile(__dirname + '/public/geoview.html');
    });
    app.get('node_modules/*', function (req, res) {
        res.sendFile(__dirname + '/node_modules/' + req.url);
    });
    app.get('/json/*', function (req, res) {
        res.sendFile(__dirname + '/' + req.url);
    });
    app.post('/json/*', function (req, res) {
        //console.log(request.body);
        fs.writeFile(__dirname + '/public' + req.url, JSON.stringify(req.body), function () {
            res.end();
        });
    });
    app.put('/json/*', function (req, res) {
        //console.log(req.body);
        fs.writeFile(__dirname + '/public' + req.url, JSON.stringify(req.body), function () {
            res.end();
        });
    });
    app.get('/xml/*', function (req, res) {
        res.sendFile(__dirname + '/' + req.url);
    });
    app.put('/xml/*', function (req, res) {
        console.log("Put " + req.url);
        console.log(req.body);
        fs.writeFile(__dirname + '/' + req.url, req.body, function () {
            res.end();
        });
    });
    app.put('/entity/*'), function (req, res) {
        console.log("Post entity " + req.url);
        console.log(req.body);
        fs.writeFile(__dirname + '/public' + req.url, req.body, function () {
            res.end();
        });
    };

    /** SocketIO Services **/
    var sio = require('socket.io').listen(server);
    sio.serveClient(true);
//The following code implements a peer map service that uses SockeIO namespaces
//to publish and subscribe to position reporting and other data.
//mapviewlistervers is a collection of map scenarios.  These can be persisted on the server or
//in broswers in order to allow sharing from different devices or browsers.
    var mapviewlist = {};
//networklist is a collection of socketIO channels.  Endpoints are added and removed from channels.
    var networklist = {};
//endpointlist is a collection of connected clients.  Information about endpointlist can be persisted
//on the server or in broswers in order to allow sharing from different devices or browsers.
    var endpointlist = {};


    /** Global SockeIO Connection **/

    /** @param topsocket Top level socket connection **/

    sio.of('').on('connection', function (topsocket) {
        topsocket.emit('connection', {message: 'Msg Socket Ready', socketid: topsocket.id});

        /** 
         * Namespaces correspond to Map Views ..
         * @param mapdta {id,netname,mapviewid}
         * @param callback  
         * **/
        topsocket.on('join namespace', function (mapdta, callback) {
            console.log("join namespace: " + mapdta.mapviewid);
            sio.of('/' + mapdta.mapviewid)
                    .once('connection', function (map_socket) {
                        console.log('user connected to ' + mapdta.mapviewid);
                        socketOps(map_socket);
                    });
            callback(mapdta);
        });

        /** @param endpoint {id,netname,mapviewid}**/
        topsocket.on('initial connection', function (endpoint) {
            console.log("initial connection: " + endpoint.mapviewid);
            endpointlist[endpoint.socketid] = endpoint;
            mapviewlist[endpoint.mapviewid] = endpoint.mapviewid;
            networklist[endpoint.networkid] = endpoint.networkid;
            //console.log(networklist);
            sio.emit('update mapviewlist', {mapviewlist: mapviewlist});
            sio.emit('update endpointlist', {endpointlist: endpointlist});
            sio.emit('update networklist', {networklist: networklist});
            sio.emit('load mapview', endpoint);
            //sio.to(endpoint.mapviewid).emit('load mapview', endpoint);
        });
// When a Map View is created - another namespace is set up with
// SocketOps functions.  Each new user has a namespace auomatically assigned
// and will be avalalabe to others to select.
// @todo Implement security to restrict/permit access to Map Views / Namespaces

// Create a mapview
        /** @param data {mapviewid} **/
        topsocket.on('create mapview', function (data) {
            console.log('create mapview');
            mapviewlist[data.name] = data.name;
            networklist[data.name] = {};
            sio.of('/' + data.name)
                    .once('connection', function (map_socket) {
                        console.log('user connected to ' + data.name);
                        socketOps(map_socket);
                    });
            sio.emit('update mapviewlist', {mapviewlist: mapviewlist});
        });
// Remove a mapview
// This will impact others who are connected
// @todo Handle behavior when others connected to Map Views / Namespaces
        /** @param data {mapviewid} **/
        topsocket.on('remove mapview', function (data) {
            delete mapviewlist[data.mapviewid];
            sio.emit('mapview update', {mapviewlist: mapviewlist});
        });
// Update a mapview
        /** @param data {endpointid,mapviewid,newmapviewid} **/
        topsocket.on('update mapview', function (data) {
            mapviewlist[data.mapviewid] = data.newmapview;
            sio.emit('update mapviewlist', {mapviewlist: mapviewlist});
        });
// Rename a mapview
// This will impact others who are connected
// @todo Handle behavior when others connected to Map Views / Namespaces when renamed
        /** @param data {endpointid,mapviewid} **/
        topsocket.on('rename mapview', function (data) {
            delete mapviewlist[data.mapviewid];
            mapviewlist[data.newmapviewid] = data.newmapviewid;
            sio.emit('update mapviewlist', {mapviewlist: mapviewlist});
        });
    });

    var socketOps = function (socket) {
        // Disconnect endpoint.  Remove from all lists
        socket.once('disconnect', function () {
            console.log('disconnect ' + socket.id);
            if (typeof endpointlist[socket.id] !== 'undefined') {
                if (typeof endpointlist[socket.id].mapviewid !== 'undefined') {
                    var mvid = endpointlist[socket.id].mapviewid;
                    if (sio.of('/' + mvid).sockets.length !== 1) {
                        delete(mapviewlist[mvid]);
                        delete(networklist[mvid]);
                        delete(endpointlist[socket.id]);
                    }
                    sio.emit('update endpointlist', {endpointlist: endpointlist});
                    sio.emit('update networklist', {networklist: networklist});
                    sio.emit('update mapviewlist', {mapviewlist: mapviewlist});
                } else {
                    delete(endpointlist[socket.id]);
                }
            }
//        if (sio.of('/').sockets.length === 0) {
//            mapviewlist = {};
//            networklist = {};
//            endpointlist = {};
//        }
        });
        // Change map.
        socket.on('change map', function () {
            if (typeof endpointlist[socket.id] !== 'undefined') {
                console.log('change map ' + endpointlist[socket.id].mapviewid);
                if (typeof endpointlist[socket.id].mapviewid !== 'undefined') {
                    console.log('disconnect from map ' + mapviewlist[endpointlist[socket.id].mapviewid]);
                    var mvid = endpointlist[socket.id].mapviewid;
                    if (sio.of('/' + mvid).sockets.length <= 2) {
                        delete(mapviewlist[mvid]);
                        delete(networklist[mvid]);
                        delete(endpointlist[socket.id]);
                    }
                } else {
                    delete(endpointlist[socket.id]);
                }
            }
        });
        // Join a network.
        socket.on('join network', function (data) {
            console.log('join network ' + data.networkid);
            socket.join(data.networkid);
        });
        // Leave a network.
        socket.on('leave network', function (data) {
            console.log('leave network ' + data.networkid);
            socket.leave(data.networkid);
        });
        // Rename a network.
        socket.on('rename network', function (data) {
            console.log('rename network ' + data.networkid + " to " + data.newnetworkid);
            delete networklist[data.networkid];
            networklist[data.newnetworkid] = data.newnetwork;
            sio.emit('update networklist', {networklist: networklist});
            socket.join(data.newnetworkid);

        });
        // Create a network as a socketIO room
        socket.on('create network', function (data) {
            console.log('create network');
            networklist[data.mapviewid][data.networkid] = data.networkid;
            sio.emit('update networklist', {networklist: networklist});
        });
        // Remove a network 
        socket.on('remove network', function (data) {
            delete networklist[data.mapviewid][data.networkid];
            sio.emit('update networklist', {networklist: networklist});
        });
        //Relay message to one or all networklist

        socket.on('publish msg', function (data) {
            if (typeof data.network !== 'undefined') {
                sio.to(data.netname).emit(data.msg, data.payload);
            } else {
                socket.emit(data.msg, data.payload);
            }
        });
        //Relay message to one or all networklist
        socket.on('publish msg to all', function (data) {
            sio.emit(data.msg, data.payload);
        });

        socket.on('publish view', function (data) {
            console.log("publish view ");
            sio.emit('update view', data);
        });
    };
})();