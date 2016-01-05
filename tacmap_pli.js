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

var express = require('express');
var compression = require('compression');
var url = require('url');
var request = require('request');
var bodyParser = require('body-parser');
var fs = require('fs');
var cesium = require('./geoserver/cesiumserver');
var http = require('http');
var app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));
app.use(compression());
//SOCKET IO
var server = http.createServer(app);
var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8000;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
/** HTTP Services **/
server.listen(server_port, server_ip_address, function () {
    console.log('listening on ' + server_port);
});
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/geoview.html');
});
app.get('/node_modules/*', function (req, res) {
    res.sendFile(__dirname + '/' + req.url);
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

/** SockeIO Services **/
var sio = require('socket.io').listen(server);
sio.serveClient(true);
//The following code implements a peer map service that uses SockeIO namespaces
//to publish and subscribe to position reporting and other data.
//mapviewservers is a collection of map scenarios.  These can be persisted on the server or
//in broswers in order to allow sharing from different devices or browsers.
var mapviews = {};
//networks is a collection of socketIO channels.  Endpoints are added and removed from channels.
var networks = {};
//endpoints is a collection of connected clients.  Information about endpoints can be persisted
//on the server or in broswers in order to allow sharing from different devices or browsers.
var endpoints = {};

/** Global SockeIO Connection **/
sio.of('').on('connection', function (topsocket) {
    topsocket.emit('connection', {message: 'Msg Socket Ready', socketid: topsocket.id});
    topsocket.on('joinNamespace', function (data, callback) {
        console.log("join namespace: " + data.mapvwid);
        sio.of('/' + data.mapvwid)
                .once('connection', function (map_socket) {
                    console.log('user connected to ' + data.mapvwid);
                    socketOps(map_socket);
                });
        callback({namespace: data.mapvwid});
    });
    topsocket.on('initial connection', function (data) {
        console.log("initial connection: " + data.mapview);
        endpoints[data.id] = data;
        mapviews[data.mapview] = data.mapview;
        networks[data.mapview] = {};
        networks[data.mapview][data.network] = data.network;
        //console.log(networks);
        sio.emit('update endpoints', {endpoints: endpoints});
        sio.emit('update networks', {networks: networks});
        sio.emit('update mapviews', {mapviews: mapviews});
        sio.to(data.id).emit('load mapview', data);
    });
// When a Map View is created - another namespace is set up with
// SocketOps functions
    topsocket.on('create mapview', function (data) {
        console.log('create mapview');
        mapviews[data.mapviewid] = data.mapviewid;
        networks[data.mapviewid] = {};
        sio.of('/' + data.mapvwid)
                .once('connection', function (map_socket) {
                    console.log('user connected to ' + data.mapvwid);
                    socketOps(map_socket);
                });
        sio.emit('update mapviews', {mapviews: mapviews});
    });
// Remove a mapview
    topsocket.on('remove mapview', function (data) {
        delete mapviews[data.mapviewid];
        sio.emit('mapview update', {mapviews: mapviews});
    });
// Update a mapview
    topsocket.on('update mapview', function (data) {
        mapviews[data.mapviewid] = data.mapviewid;
        sio.emit('update mapviews', {mapviews: mapviews});
    });
});

var socketOps = function (socket) {
    socket.on('init map', function (data) {
        console.log('init map to ' + data.id + ' ' + data.network + ' ' + data.mapview);
        socket.join(data.network);
        socket.to(data.id).emit('load mapview', data);
    });
    // Disconnect endpoint.  Remove from all lists
    socket.once('disconnect', function () {
        console.log('disconnect ' + socket.id);
        if (typeof endpoints[socket.id] !== 'undefined') {
            if (typeof endpoints[socket.id].mapview !== 'undefined') {
                var mvid = endpoints[socket.id].mapview;
                if (sio.of('/' + mvid).sockets.length !== 1) {
                    delete(mapviews[mvid]);
                    delete(networks[mvid]);
                    delete(endpoints[socket.id]);
                }
                sio.emit('update endpoints', {endpoints: endpoints});
                sio.emit('update networks', {networks: networks});
                sio.emit('update mapviews', {mapviews: mapviews});
            } else {
                delete(endpoints[socket.id]);
            }
        }
//        if (sio.of('/').sockets.length === 0) {
//            mapviews = {};
//            networks = {};
//            endpoints = {};
//        }
    });
    // Change map.
    socket.on('change map', function () {
        if (typeof endpoints[socket.id] !== 'undefined') {
            console.log('change map ' + endpoints[socket.id].mapview);
            if (typeof endpoints[socket.id].mapview !== 'undefined') {
                console.log('disconnect from map ' + mapviews[endpoints[socket.id].mapview]);
                var mvid = endpoints[socket.id].mapview;
                if (sio.of('/' + mvid).sockets.length <= 2) {
                    delete(mapviews[mvid]);
                    delete(networks[mvid]);
                    delete(endpoints[socket.id]);
                }
            } else {
                delete(endpoints[socket.id]);
            }
        }
    });
    // Join a network.
    socket.on('join network', function (data) {
        console.log('join network ' + data.network);
        socket.join(data.network);
    });
    // Leave a network.
    socket.on('leave network', function (data) {
        console.log('leave network ' + data.network);
        socket.leave(data.network);
    });
    // Create a network as a socketIO room
    socket.on('create network', function (data) {
        console.log('create network');
        networks[data.mapviewid][data.netname] = data.netname;
        sio.emit('update networks', {networks: networks});
    });
    // Remove a network 
    socket.on('remove network', function (data) {
        delete networks[data.mapviewid][data.netname];
        sio.emit('update networks', {networks: networks});
    });
    //Relay message to one or all networks
    socket.on('publish msg', function (data) {
        if (typeof data.network !== 'undefined') {
            sio.to(data.netname).emit(data.msg, data.payload);
        } else {
            socket.emit(data.msg, data.payload);
        }
    });
    //Relay message to one or all networks
    socket.on('publish msg to all', function (data) {
        sio.emit(data.msg, data.payload);
    });
};
