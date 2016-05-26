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
    var tm = {};
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
        Object.keys(headers).forEach(function (name) {
            if (!dontProxyHeaderRegex.test(name)) {
                result[name] = headers[name];
            }
        });
        return result;
    }

    var upstreamProxy = argv['upstream-proxy'];
    var bypassUpstreamProxyHosts = {};
    if (argv['bypass-upstream-proxy-hosts']) {
        argv['bypass-upstream-proxy-hosts'].split(',').forEach(function (host) {
            bypassUpstreamProxyHosts[host.toLowerCase()] = true;
        });
    }

    app.get('/proxy/*', function (req, res, next) {
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
            url: url.format(remoteUrl),
            headers: filterHeaders(req, req.headers),
            encoding: null,
            proxy: proxy
        }, function (error, response, body) {
            var code = 500;
            if (response) {
                code = response.statusCode;
                res.header(filterHeaders(req, response.headers));
            }

            res.send(code, body);
        });
    });
    var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
    var server = app.listen(argv.port, argv.public ? undefined : server_ip_address, function () {
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
    server.on('close', function () {
        console.log('Cesium development server stopped.');
    });
    process.on('SIGINT', function () {
        server.close(function () {
            process.exit(0);
        });
    });
//SOCKET IO

    /**
     * @param req Request
     * @param res Result
     * **/
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
//
//maps is a json object containing  map scenarios.  These can be persisted on the server or
//in broswers in order to allow sharing from different devices or browsers.
    tm.maps = {};
//networks is a json object containing  socketIO channels.  Endpoints are added and removed from channels.
    tm.networks = {};
//endpoints is a json object containing of connected clients.  Information about endpointlist can be persisted
//on the server or in broswers in order to allow sharing from different devices or browsers.
    tm.endpoints = {};
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
            console.log("join namespace: " + mapdta.id);
            sio.of('/' + mapdta.id)
                    .once('connection', function (map_socket) {
                        console.log('user connected to ' + mapdta.id);
                        socketOps(map_socket);
                    });
            callback(mapdta);
        });
        /** @param endpoint {id,netname,mapviewid}**/
        topsocket.on('initial connection', function (endpoint) {
            console.log("initial connection: " + endpoint.id);
            endpoints.push({endpoint: endpoint});
            maps.push({map: [{id: endpoint.map_id, name: endpoint.map_id, url: 'json/' + endpoint.map_id + '.json', data: {}}]});
            networks.push({network: [{id: endpoint.network_id, map_id: endpoint.map_id}]});
            sio.emit('update maps', maps);
            sio.emit('update endpoints', endpoints);
            sio.emit('update networks', networks);
            sio.emit('load map', endpoint);
            //sio.to(endpoint.mapviewid).emit('load mapview', endpoint);
        });
// When a Map View is created - another namespace is set up with
// SocketOps functions.  Each new user has a namespace auomatically assigned
// and will be avalalabe to others to select.
// @todo Implement security to restrict/permit access to Map Views / Namespaces

// Create a mapview
        /** @param mapdata {map_id,name,data} **/
        topsocket.on('create map', function (mapdata) {
            console.log('create map');
            maps.push({map: [{id: mapdata.map_id, name: mapdata.name, url: 'json/' + mapdata.map_id + '.json', data: mapdata.data}]});
            sio.of('/' + mapdata.id)
                    .once('connection', function (map_socket) {
                        console.log('user connected to ' + mapdata.id);
                        socketOps(map_socket);
                    });
            sio.emit('update maps', maps);
        });
// Remove a mapview
// This will impact others who are connected
// @todo Handle behavior when others connected to Map Views / Namespaces
        /** @param mapdata {id,name,url,data} **/
        topsocket.on('remove map', function (mapdata) {
            tm.removeMap(mapdata, function (nm) {
                maps = nm;
                sio.emit('update maps', maps);
            });
        });
// Update a mapview
        /** @param mapdata {id,name,url,data} **/
        topsocket.on('update map', function (mapdata) {
            tm.updateMap(mapdata, function (nm) {
                maps = nm;
                sio.emit('update maps', maps);
            });
        });
// Rename a mapview
// This will impact others who are connected
// @todo Handle behavior when others connected to Map Views / Namespaces when renamed
        /** @param mapdata {id,name,url,data} **/
        topsocket.on('rename map', function (mapdata) {
            tm.renameMap(mapdata, function (nm) {
                maps = nm;
                sio.emit('update maps', maps);
            });
        });
        
         //Publish mapdata for persistence on server
        topsocket.on('publish map', function (map) {
            console.log("publish map " + map.id);
            tm.updateMap(map, function (nm) {
                maps = nm;
                sio.emit('update maps', maps);
            });
        });
        
        topsocket.on('request maps', function () {
            console.log("load maps");
            sio.emit('update maps', maps);
        });
    });
    var socketOps = function (socket) {
        // Disconnect endpoint.  Remove from all lists
        socket.once('disconnect', function () {
            console.log('disconnect ' + socket.id);
            tm.removeEndpoint({socket_id: socket.id}, function (ep) {
                endpoints = ep;
                sio.emit('update endpoints', endpoints);
            });
        });
        // Join a network.
        socket.on('join network', function (netdata) {
            console.log('join network ' + netdata.network_id);
            socket.join(netdata.network_id);
        });
        // Leave a network.
        socket.on('leave network', function (netdata) {
            console.log('leave network ' + netdata.network_id);
            socket.leave(netdata.network_id);
        });
        // Rename a network.
        socket.on('rename network', function (netdata) {
            console.log('rename network ' + netdata.network_id + " to " + netdata.newnetwork_id);
            tm.renameNetwork(netdata, function (nw) {
                networks = nw;
                socket.join(netdata.newnetworkid);
                sio.emit('update networks', networks);
            });
        });
        // Create a network as a socketIO room
        socket.on('create network', function (netdata) {
            console.log('create network');
            networks.push({network: [{id: netdata.network_id, map_id: netdata.map_id}]});
            sio.emit('update networks', networks);
        });
        // Remove a network 
        socket.on('remove network', function (netdata) {
            tm.removeNetwork(netdata, function (nw) {
                networks = nw;
                socket.join(netdata.newnetworkid);
                sio.emit('update networks', networks);
            });
        });
        //
        //Publish message to single socketid, or to one or all network
        socket.on('publish msg', function (msg) {
            if (typeof msg.data.destination !== 'undefined') {
                sio.to(msg.data.destination.socketid).emit(msg.scktmsg, msg.data);
            } else if (typeof msg.data.network !== 'undefined') {
                sio.to(msg.data.network.id).emit(msg.scktmsg, msg.data);
            } else {
                socket.emit(msg.scktmsg, msg.data);
            }
        });
        //
        tm.removeMap = function (mapdata, callback) {
            var nm = {};
            for (var m in maps.map) {
                if (m.id !== mapdata.id) {
                    nm.push(m);
                }
            }
            callback(nm);
        };
        tm.updateMap = function (mapdata, callback) {
            var nm = {};
            for (var m in maps.map) {
                if (m.id === mapdata.id) {
                    nm.push(mapdata);
                } else {
                    nm.push(m);
                }
            }
            callback(nm);
        };
        tm.renameMap = function (mapdata, callback) {
            var nw = {};
            for (var m in maps.map) {
                if (m.id === mapdata.id) {
                    m.name = mapdata.name;
                    nm.push(m);
                } else {
                    nm.push(m);
                }
            }
            callback(nw);
        };
        // 
        tm.removeNetwork = function (netdata, callback) {
            var nw = {};
            for (var n in networks.network) {
                if (n.id !== netdata.id) {
                    nw.push(n);
                }
            }
            callback(nw);
        };
        tm.updateNetwork = function (netdata, callback) {
            var nw = {};
            for (var n in networks.network) {
                if (n.id === netdata.id) {
                    nw.push(netdata);
                } else {
                    nw.push(n);
                }
            }
            callback(nw);
        };
        tm.renameNetwork = function (netdata, callback) {
            var nw = {};
            for (var n in networks.network) {
                if (n.id === netdata.network_id) {
                    n.id = netdata.newnetwork_id;
                    nw.push(n);
                } else {
                    nw.push(n);
                }
            }
            callback(nw);
        };
        //
        tm.removeEndpoint = function (epdata, callback) {
            var ep = {};
            for (var e in endpoints.endpoint) {
                if (e.socket_id !== epdata.socket_id) {
                    ep.push(e);
                } else {
                    tm.removeMap({map_id: e.map_id}, function (nm) {
                        maps = nm;
                        sio.emit('update maps', maps);
                    });
                    tm.removeNetwork({network_id: e.network_id}, function (nw) {
                        networks = nw;
                        sio.emit('update maps', networks);
                    });
                }
            }
            callback(ep);
        };
    };
})();