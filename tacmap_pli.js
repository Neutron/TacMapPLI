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
//
var http = require('http');

var app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));
app.use(compression());

//SOCKET IO
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8000;
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
server.listen(server_port, server_ip_address, function () {
    console.log('listening on ' + server_port);
});
//

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/geoview.html');
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
app.post('/entity/*'), function (req, res) {
    console.log("Post entity " + req.url);
    console.log(req.body);
    fs.writeFile(__dirname + '/public' + req.url, req.body, function () {
        res.end();
    });
};

//The following code implements a peer map service that uses SockeIO namespaces
//to publish and subscribe to position reporting and other data.

//mapio is a collection of socketIO namespaces.  These are created from browsers and used
//to segregate map scenarios.
var mapio = [];
//mapviewservers is a collection of map scenarios.  These can be persisted on the server or
//in broswers in order to allow sharing from different devices or browsers.
var mapviews = [];
//networks is a collection of socketIO channels.  Endpoints are added and removed from channels.
var networks = [];
//endpoints is a collection of connected clients.  Information about endpoints can be persisted
//on the server or in broswers in order to allow sharing from different devices or browsers.
var endpoints = [];


io.on('connection', function (socket) {
    endpoints[socket.id] = [];
    socketOps(socket);
});

var socketOps = function (socket) {

    // Use socket to communicate with an endpoint, sending it it's own id and current data resource ids.
    socket.emit('connection', {message: 'Msg Socket Ready', socketid: socket.id});
    // Initial connection.  Create namespace and room for each endpoint.
    socket.on('initial connection', function (data) {
        console.log("initial connection: ");
        endpoints.push({id: data.endpoint.id, endpoint: data.endpoint});
        networks.push({id: data.endpoint.id, network: data.endpoint.network});
        mapviews.push({id: data.endpoint.id, mapview: data.endpoint.mapview});
        //Set up socket namespace corresponding to mapview. Map vies correspond to socketIO namespaces.
        mapio[data.mapview.id] = io.of('/' + data.endpoint.mapview.id);
        //Join connectoin to own network.  Networks correspond to socketIO rooms.
        mapio[data.mapview.id].join(data.endpoint.network);
        //Update all sockets with names of endpoints, maps and rooms.
        io.emit('update connections', {endpoints: endpoints, networks: networks, mapviews: mapviews});
    });
    // Disconnect endpoint.  Remove from all lists
    socket.on('disconnect', function () {
        var e = endpoints.indexOf(socket.id);
        endpoints.splice(e, 1);
        var n = networks.indexOf(socket.id);
        networks.splice(n, 1);
        var m = mapviews.indexOf(socket.id);
        mapviews.splice(m, 1);
        console.log(socket.id + " disconnected");
        io.emit('update connections', {endpoints: endpoints, networks: networks, mapviews: mapviews});
    });
    // Join a network.
    socket.on('join network', function (data) {
        mapio[data.mapviewid].join(data.network);
    });
    // Leave a network.
    socket.on('leave network', function (data) {
        mapio[data.mapviewid].leave(data.network);
    });
    //Relay message to one or all networks
    socket.on('publish msg', function (data) {
        if (typeof data.network !== 'undefined') {
            mapio[data.mapview.id].to(data.netname).emit(data.msg, data.payload);
        } else {
            mapio[data.mapview.id].emit(data.msg, data.payload);
        }
    });
    //Relay message to one or all networks
    socket.on('publish msg to all', function (data) {
        io.emit(data.msg, data.payload);
    });
    // Publish a mapview
    socket.on('create mapview', function (data) {
        mapviews.push({id: data.id, mapview: data.mapview});
        //set up socket namespace corresponding to new mapview
        mapio[data.mapview.id] = io.of('/' + data.mapview.id);
        io.emit('mapview update', {mapviews: mapviews});
    });
    // Remove a mapview
    socket.on('remove mapview', function (data) {
        var n = mapviews.indexOf(data.id);
        mapviews.splice(n, 1);
        io.emit('mapview update', {mapviews: mapviews});
    });
    // Update a mapview
    socket.on('update mapview', function (data) {
        mapviews[data.id].mapview = data.mapview;
        io.emit('mapview update', {mapviews: mapviews});
    });
    // Create a network as a socketIO room
    socket.on('create network', function (data) {
        networks.push({id: data.network.id, network: data.network.name});
        io.emit('update networks', {networks: networks});
    });
    // Remove a network 
    socket.on('remove network', function (data) {
        var n = networks.indexOf(data.id);
        networks.splice(n, 1);
        io.emit('update networks', {networks: networks});
    });
};
