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
var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
/** HTTP Services **/
server.listen(server_port, server_ip_address, function () {
    console.log('listening on ' + server_port);
});
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
     * @param endpoint {id,netname,mapviewid}
     * @param callback  
     * **/
    topsocket.on('join namespace', function (endpoint, callback) {
        console.log("join namespace: " + endpoint.mapviewid);
        sio.of('/' + endpoint.mapviewid)
                .once('connection', function (map_socket) {
                    console.log('user connected to ' + endpoint.mapviewid);
                    socketOps(map_socket);
                });
        callback({namespace: endpoint.mapviewid});
    });
    
    /** @param endpoint {id,netname,mapviewid}**/
    topsocket.on('initial connection', function (endpoint) {
        console.log("initial connection: " + endpoint.mapviewid);
        endpointlist[endpoint.socketid] = endpoint;
        mapviewlist[endpoint.mapviewid] = endpoint.mapviewid;
        networklist[endpoint.mapviewid] = {};
        networklist[endpoint.mapviewid][endpoint.networkid] = endpoint.networkid;
        //console.log(networklist);
        sio.emit('update mapviewlist', {mapviewlist: mapviewlist});
        sio.emit('update endpointlist', {endpointlist: endpointlist});
        sio.emit('update networklist', {networklist: networklist});
        sio.emit('load mapview', endpoint);
        //sio.to(endpoint.mapviewid).emit('load mapview', endpoint);
    });
// When a Map View is created - another namespace is set up with
// SocketOps functions

// Create a mapview
    /** @param data {mapviewid} **/
    topsocket.on('create mapview', function (data) {
        console.log('create mapview');
        mapviewlist[data.mapviewid] = data.mapviewid;
        networklist[data.mapviewid] = {};
        sio.of('/' + data.mapviewid)
                .once('connection', function (map_socket) {
                    console.log('user connected to ' + data.mapviewid);
                    socketOps(map_socket);
                });
        sio.emit('update mapviewlist', {mapviewlist: mapviewlist});
    });
// Remove a mapview
/** @param data {mapviewid} **/
    topsocket.on('remove mapview', function (data) {
        delete mapviewlist[data.mapviewid];
        sio.emit('mapview update', {mapviewlist: mapviewlist});
    });
// Update a mapview
/** @param data {endpointid,mapviewid} **/
    topsocket.on('update mapview', function (data) {
        mapviewlist[data.mapviewid] = data.mapviewid;
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
};
