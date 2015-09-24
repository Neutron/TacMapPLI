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

app.post('/entity/*'),function(req,res){
    console.log("Post entity " + req.url);
    console.log(req.body);
    fs.writeFile(__dirname + '/public' + req.url, req.body, function () {
        res.end();
    });
}

var server = http.createServer(app);
var io = require('socket.io').listen(server);
var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8000
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'
server.listen(server_port, server_ip_address, function () {
    console.log('listening on ' + server_port);
});
//
var mapid = "Default Map";
var mapdata = [];
var servers = [];
var users = [];
var allconnections = [];
var mapRunning = false;

io.on('connection', function (socket) {

    allconnections.push(socket);

    socket.on('disconnect', function () {
        var i = allconnections.indexOf(socket);
        console.log(i.id + " disconnected");
        delete allconnections[i];
    });
    // Use socket to communicate with this particular user only, sending it it's own id
    socket.emit('connection', {message: 'Msg Socket Ready', socketid: socket.id});

    socket.on('server connected', function (data) {
        console.log("server connect to socket: " + data.socketid + ", map:" + data.mapid);
        servers.push({server: data.socketid});
        if (mapid === "Default Mission") {
            mapdata = data.mapdata;
            io.emit('init server', {target: "server", mapid: data.mapid, mapdata: mapdata});
        } else {
            io.emit('init server', {target: "server", mapid: mapid, mapdata: mapdata});
        }
        if (mapRunning) {
            io.emit('start map');
        }
    });
    socket.on('user connected', function (data) {
        console.log("users connect: " + data.id + " set map: " + mapid);
        users.push({user: data.id});
        io.emit('user connected', {mapid: mapid, mapdata: mapdata});
    });
    socket.on('send msg', function (data) {
        console.log('send msg from ' + data.message.user + ' to ' + data.net);
        socket.to(data.net).emit('msg sent', data);
    });
    socket.on('user join', function (data) {
        //console.log(data.userid + ' joined ' + data.netname);
        socket.join(data.netname);
        io.emit('user joined', {userid: data.userid, netname: data.netname});
    });
    socket.on('server join', function (data) {
        //console.log(data.serverid + ' joined ' + data.netname);
        socket.join(data.netname);
        io.emit('server joined', {serverid: data.serverid, netname: data.netname});
    });
    socket.on('server leave', function (data) {
        // console.log(data.serverid + ' left ' + data.netname);
        socket.leave(data.netname);
        io.emit('server left', {serverid: data.serverid, netname: data.netname});
    });
    socket.on('user leave', function (data) {
        //console.log(data.userid + ' left ' + data.netname);
        socket.leave(data.netname);
        io.emit('user left', {userid: data.userid, netname: data.netname});
    });
    socket.on('add entity', function (data) {
        console.log("emit add entity: " + data._id);
        io.emit('add entity', data);
    });
    socket.on('set map', function (data) {
        console.log("set map: " + data.mapid);
        mapid = data.mapid;
        mapdata = data.mapdata;
        io.emit('set map', {target: "user", mapid: mapid, mapdata: mapdata});
    });
    socket.on('map running', function () {
        mapRunning = true;
        io.emit('start map');
    });
    socket.on('map stopped', function () {
        mapRunning = false;
        io.emit('stop map');
    });
    socket.on('map time', function (data) {
        io.emit('set time',data);
    });
});
