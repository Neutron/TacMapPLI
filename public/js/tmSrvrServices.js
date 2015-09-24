/* global TacMapServer, TacMapUnit */
// ***** SERVER SERVICES ******//
TacMapServer.factory('DbService', function ($indexedDB) {
    var dbsvc = {
    };
    dbsvc.xj = new X2JS();
    dbsvc.dB = $indexedDB;
    dbsvc.syncResource = function ($scope, $http, mapid, url, stctl, GeoService) {
        console.log("syncResource " + mapid)
        $http.get(url).success(function (resdata, status, headers) {
            var mod = headers()[ 'last-modified'];
            var filename = url.substring(url.lastIndexOf('/') + 1);
            var jdata = dbsvc.xj.xml_str2json(resdata);
            var mname = jdata.Map._name;
            var jname = mname.replace(' ', '').toLowerCase();
            if (mname!=='Default Map'){
                stctl.maplist.push({
                    id: mapid, name: mname, url: 'json/' + jname + '.json'
                });
            }
            dbsvc.dB.openStore('Maps', function (mstore) {
                mstore.upsert({
                    name: mname, url: 'json/' + jname + '.json', data: jdata
                }).then(function () {
                    dbsvc.dB.openStore('Resources', function (store) {
                        store.getAllKeys().then(function (keys) {
                            if (keys.indexOf(filename) === -1) {
                                store.upsert({
                                    name: filename, url: url, lastmod: mod, data: resdata
                                });
                            } else {
                                store.find(filename).then(function (dbrec) {
                                    if (dbrec.lastmod !== mod) {
                                        console.log('upsert ' + filename);
                                        store.upsert({
                                            name: filename, url: url, lastmod: mod, data: resdata
                                        });
                                    }
                                });
                            }
                        });
                        if (filename === 'DefaultMap.xml') {
                            console.log('init geo');
                            stctl.map = jdata;
                            GeoService.initGeodesy($scope, jdata.Map._name, jdata);
                        }
                        ;
                    });
                });
            });

        }).error(function () {
            console.log('Error getting resource');
        });
    };
    return dbsvc;
});
TacMapServer.factory('GeoService', function () {
    var geosvc = {
    };
    geosvc.entities = [];
    geosvc.mapid = null;
    geosvc.sdatasources = [];
    geosvc.initGeodesy = function ($scope, mapid, mapdata) {
        console.log("initGeodesy " + mapid);
        geosvc.mapid = mapid;
        geosvc.sdatasources[geosvc.mapid] = new Cesium.CustomDataSource(geosvc.mapid);
        viewer.dataSources.add(geosvc.sdatasources[geosvc.mapid]);
        geosvc.addPolygons(mapdata.Map.Polygons.Polygon);
        geosvc.addEntities(mapdata.Map.Entities.Entity);
        geosvc.addTracks(mapdata.Map.Tracks.Track);
        geosvc.addGeoFences(mapdata.Map.GeoFences.GeoFence);
        viewer.zoomTo(geosvc.sdatasources[geosvc.mapid].entities.getById("Default"));
    };
    geosvc.addEntities = function (entities) {
        //console.log('addEntities ' + entities.length);
        for (i = 0; i < entities.length; i++) {
            if (entities[i]._location.length > 0) {
                geosvc.addCesiumBillboard(entities[i]);
            }
        }
    };
    geosvc.addTracks = function (entities) {
        //console.log('addEntities ' + entities.length);
        for (i = 0; i < entities.length; i++) {
            if (entities[i]._location.length > 0) {
                geosvc.addCesiumBillboard(entities[i]);
            }
        }
    };
    geosvc.addPolygons = function (polygons) {
        //console.log('addPolygons ' + polygons.length);
        //console.log(polygons);
        for (i = 0; i < polygons.length; i++) {
            if (polygons[i]._locations.length > 0) {
                geosvc.addCesiumPolygon(polygons[i]);
            }
        }
    };
    geosvc.addGeoFences = function (geofences) {
        for (i = 0; i < geofences.length; i++) {
            if (geofences[i]._points.length > 0) {
                geosvc.addCesiumPolyline(geofences[i]);
            }
        }
    };
    geosvc.addCesiumPolygon = function (poly) {
        //console.log('addPolygon');
        var loc = poly._locations;
        //console.log(loc);
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        //Cartesian wants long, lat
        geosvc.sdatasources[geosvc.mapid].entities.add({
            id: poly._id,
            name: poly._name,
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(loc.reverse()),
                outline: true,
                outlineColor: Cesium.Color[poly._color],
                outlineWidth: 2,
                fill: false
            }
        });
    };
    geosvc.addCesiumPolyline = function (poly) {
        //console.log('addCesiumPolyline');
        var loc = poly._points;
        //console.log(loc);
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        //Cartesian wants long, lat
        geosvc.sdatasources[geosvc.mapid].entities.add({
            id: poly._id,
            name: poly._name,
            polyline: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(loc.reverse()),
                outline: true,
                outlineColor: Cesium.Color[poly._color],
                outlineWidth: 2,
                fill: false
            }
        });
    };
    geosvc.addCesiumBillboard = function (entity) {
        console.log("Add billboard");
        var loc = entity._location;
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        geosvc.sdatasources[geosvc.mapid].entities.add({
            id: entity._id,
            name: entity._name,
            position: Cesium.Cartesian3.fromDegrees(loc[1], loc[0]),
            billboard: {
                image: entity._icon,
                width: 40,
                height: 25
            },
            label: {
                text: entity._name,
                font: '10pt monospace',
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, 15)
            }
        });
    };
    geosvc.addCesiumPoint = function (entity, color) {
        console.log("Add point " + geosvc.mapid + ", " + entity._id + ", " + entity._location);
        var loc = entity._location;
        //loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        geosvc.sdatasources[geosvc.mapid].entities.add({
            id: entity._id,
            name: entity._name,
            position: Cesium.Cartesian3.fromDegrees(loc[1], loc[0]),
            point: {
                pixelSize: 5,
                color: Cesium.Color[color],
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2
            },
            label: {
                text: entity._name,
                font: '10pt monospace',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, 15)
            }
        });
        if (entity.polypoints) {
            geosvc.addStoredWaypoints(entity);
        }
    };
    geosvc.addCesiumEllipsoid = function (entity) {
        console.log("Add elipsoid");
        var loc = entity._location;
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        geosvc.sdatasources[geosvc.mapid].entities.add({
            id: entity._id,
            name: entity._name,
            position: Cesium.Cartesian3.fromDegrees(loc[1], loc[0]),
            ellipsoid: {
                radii: new Cesium.Cartesian3(10.0, 10.0, 10.0),
                material: Cesium.Color.BLUE.withAlpha(0.5),
            },
            label: {
                text: entity._name,
                font: '10pt monospace',
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, 15)
            }
        });
        if (entity.polypoints) {
            geosvc.addStoredWaypoints(entity);
        }
    };
    return geosvc;
});
TacMapServer.factory('MsgService', function () {
    var msgsvc = {
    };
    msgsvc.serverid;
    msgsvc.mapid;
    msgsvc.connected = false;
    msgsvc.sending = false;
    msgsvc.lastSendingTime = 0;
    msgsvc.users = [];
    msgsvc.socket = io();
    // Sends a message
    msgsvc.setMap = function (name, mapdata) {
        msgsvc.socket.emit('set map', {
            mapid: name, mapdata: mapdata
        });
    };
    msgsvc.sendMessage = function (msg) {
        var message = msg;
        console.log("sendMessage");
        //console.log("sendMessage from "+message.user+" to "+message.to+" at "+message.time+" posrep: "+message.position[0]+", "+message.position[1]);
        // if there is a non-empty message and a socket connection
        if (message && msgsvc.connected) {
            // tell server to execute 'new message' and send along one parameter
            msgsvc.socket.emit('send msg', {
                message: message
            });
        }
    };
    msgsvc.connectServer = function (data, sname, mapjson) {
        console.log(data.message + " " + data.socketid);
        msgsvc.connected = true;
        msgsvc.mapid = sname;
        //console.log(mapjson);
        msgsvc.socket.emit('server connected', {
            message: 'server', socketid: data.socketid, mapid: msgsvc.mapid, mapdata: mapjson
        });
    };
    msgsvc.disconnectServer = function (data) {
        console.log("Server Disconnected " + data.socketid);
        msgsvc.connected = false;
        msgsvc.socket.emit('server disconnected', {
            message: 'server', socketid: data.socketid, map: msgsvc.mapid
        });
    };
    return msgsvc;
});
TacMapServer.factory('DlgBx', function ($window, $q) {
    var dlg = {
    };
    dlg.alert = function alert(message) {
        var defer = $q.defer();
        $window.alert(message);
        defer.resolve();
        return (defer.promise);
    };
    dlg.prompt = function prompt(message, defaultValue) {
        var defer = $q.defer();
        // The native prompt will return null or a string.
        var response = $window.prompt(message, defaultValue);
        if (response === null) {
            defer.reject();
        } else {
            defer.resolve(response);
        }
        return (defer.promise);
    };
    dlg.confirm = function confirm(message) {
        var defer = $q.defer();
        // The native confirm will return a boolean.
        if ($window.confirm(message)) {
            defer.resolve(true);
        } else {
            defer.reject(false);
        }
        return (defer.promise);
    };
    return dlg;
});