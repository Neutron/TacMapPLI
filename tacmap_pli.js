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

//mapviewservers is a collection of map scenarios.  These can be persisted on the server or
//in broswers in order to allow sharing from different devices or browsers.
var mapviews = [];
//mapio is a collection of socketIO namespaces.  These are created from browsers and used
//to segregate map scenarios.
var mapio = [];
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

    socket.on('initial connection', function (data) {
        console.log("initial connection: ");
        console.log(data);
        endpoints.push({id:data.endpoint.id,endpoint:data.endpoint});
        networks.push({id:data.endpoint.id,network:data.endpoint.network});
        mapviews.push({id:data.endpoint.id,mapview:data.endpoint.mapview});
        console.log(endpoints);
        console.log(networks);
        console.log(mapviews);
        io.emit('update connections', {endpoints:endpoints,networks:networks,mapviews:mapviews});
    });

    // Add endpoint to a network on a mapview.
    socket.on('endpoint connected', function (data) {
        console.log("endpoint connect: " + data.endpointid);
        endpoints[data.mapviewid][data.netname][data.endpointid] = data.endpointinfo;
        mapio[data.mapviewid].to(data.netname).emit('endpoints connected', {endpoints: endpoints[data.mapviewid][data.netname]});
    });

    socket.on('disconnect', function () {
        var e=endpoints.indexOf(socket.id);
        endpoints.splice(e,1);
        var n=networks.indexOf(socket.id);
        networks.splice(n,1);
        var m=mapviews.indexOf(socket.id);
//        mapviews.splice(m,1);
        console.log(socket.id + " disconnected");
        io.emit('update connections', {endpoints:endpoints,networks:networks,mapviews:mapviews});
    });

    // Initialize a mapview to display a specific set of networks and entities
    // Provides initial mapview area and view information.  A mapview has networks and networks have endpoints
    socket.on('init mapview', function (data) {
        console.log("MapView connect to socket: " + data.socketid + ", mapview:" + data.mapviewid);
        mapviews[data.mapviewid] = {mapview: data.socketid, mapviewid: data.mapviewid, data: data.mapviewdata};
        mapio[data.mapviewid] = io.of('/' + data.mapviewid);
        mapio[data.mapviewid].emit('init server', mapviews[data.mapviewid]);
        mapio[data.mapviewid].on('connection', socketOps);
    });
    // Initialize a network as a socketIO room
    socket.on('create network', function (data) {
        console.log("Network created: " + data.netname + " on " + data.mapviewid);
        networks[data.mapviewid] = [];
        networks[data.mapviewid][data.netname] = data.netinfo;
        endpoints[data.mapviewid] = [];
        endpoints[data.mapviewid][data.netname] = [];
        mapio[data.mapviewid].emit('network created', {networks: networks[data.mapviewid]});
    });
    // Remove a network as a socketIO room
    socket.on('close network', function (data) {
        console.log("Close Network: " + data.netname + " on " + data.mapviewid);
        mapio[data.mapviewid].leave(data.netname);
        networks[data.mapviewid].remove(networks[data.mapviewid][data.netname]);
        endpoints[data.mapviewid][data.netname].remove(endpoints[data.mapviewid][data.netname][data.endpointid]);
        mapio[data.mapviewid].emit('network closed', {network: data.netname, networks: networks[data.mapviewid]});
    });
    // Join endpoint to a network on a mapview.
    socket.on('endpoint join', function (data) {
        console.log(data.endpointid + ' joined ' + data.netname);
        mapio[data.mapviewid].join(data.netname);
        endpoints[data.mapviewid][data.netname][data.endpointid] = data.endpointinfo;
        mapio[data.mapviewid].to(data.netname).emit('endpoint joined', {endpoints: endpoints[data.mapviewid][data.netname]});
    });
    // Disconnect endpoint from a network on a mapview.
    socket.on('endpoint leave', function (data) {
        console.log(data.userid + ' left ' + data.netname + ' on ' + data.mapviewid);
        endpoints[data.mapviewid][data.netname].remove(endpoints[data.mapviewid][data.netname][data.endpointid]);
        mapio[data.mapviewid].leave(data.netname);
        mapio[data.mapviewid].to(data.netname).emit('endpoint left', {endpointid: data.endpointid, endpoints: endpoints[data.mapviewid][data.netname]});
    });
    // Publish a message to a network on a mapview.  These will be processed client side using
    // data.msg.type and data.msg.content information
    // data.type can be: entity, location, mapview, and message.  
    // Information is stored in data.entity, data.location, data.mapview, data.message
    socket.on('publish msg', function (data) {
        console.log('send msg from ' + data.endpointid + ' on ' + data.mapviewid + ' to ' + data.net);
        mapio[data.mapviewid].to(data.netname).emit('msg sent', data);
    });

    // Publish time information to a network on a mapview.
    socket.on('mapview time', function (data) {
        io.emit('set mapview time', data);
    });
};
