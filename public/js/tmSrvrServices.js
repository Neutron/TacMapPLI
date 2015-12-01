/** 
 * Copyright (C) 2015 JD NEUSHUL
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
 **/
/* global TacMapServer, TacMapUnit, viewer, Cesium */
// ***** SERVER SERVICES ******//
TacMapServer.factory('DbService', function ($indexedDB) {
    var dbsvc = {
    };
    dbsvc.xj = new X2JS();
    dbsvc.dB = $indexedDB;
    dbsvc.map = [];
    dbsvc.initMaps = function ($scope, $http, stctl, GeoService) {
        dbsvc.dB.openStore('Resources', function (mstore) {
            mstore.getAllKeys().then(function (keys) {
                if (keys.indexOf('maps.json') === -1) {
                    $http.get('xml/maps.xml').success(function (resdata, status, headers) {
                        var maps = dbsvc.xj.xml_str2json(resdata);
                        for (i = 0; i < maps.Maps.Map.length; i++) {
                            var u = maps.Maps.Map[i]._url;
                            var n = maps.Maps.Map[i]._name;
                            if (u.substring(u.indexOf('.')) === '.xml') {
                                dbsvc.syncResource($scope, $http, maps.Maps.Map[i]._id, maps.Maps.Map[i]._url, stctl, GeoService);
                            } else {
                                $http.get(u).success(function (jsondata, status, headers) {
                                    var jsmod = headers()[ 'last-modified'];
                                    dbsvc.dB.openStore('Maps', function (mstore) {
                                        mstore.upsert({
                                            name: n, url: u, lastmod: jsmod, data: jsondata
                                        });
                                        $http.post("/json/maps.json", angular.toJson(stctl.sortByKey(stctl.maplist, 'id')));
                                    });
                                });
                            }
                        }
                    });
                } else {
                    mstore.find('maps.json').then(function (dbrec) {
                        var maps = dbrec.data;
                        stctl.maplist = dbrec.data;
                        stctl.loadMap({id: 0, name: 'Default Map'});
                    });
                }
            });
        });
    };
    dbsvc.syncResource = function ($scope, $http, mapid, url, stctl, GeoService) {
        console.log("syncResource " + mapid);
        $http.get(url).success(function (resdata, status, headers) {
            var mod = headers()[ 'last-modified'];
            var filename = url.substring(url.lastIndexOf('/') + 1);
            var jdata = dbsvc.xj.xml_str2json(resdata);
            var mname = jdata.Map._name;
            var jname = mname.replace(' ', '').toLowerCase();
            if (mname !== 'Default Map') {
                stctl.maplist.push({
                    id: mapid, name: mname, url: 'json/' + jname + '.json'
                });
            }
            dbsvc.dB.openStore('Maps', function (mstore) {
                mstore.upsert({
                    name: mname, url: 'json/' + jname + '.json', lastmod: mod, data: jdata
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
                            //console.log('init geo');
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
    dbsvc.updateEntityDb = function (mapname, entityId, fieldname, value) {
        console.log('updateDb ' + entityId + ' map name:' + mapname + ' fieldname:' + fieldname + ' value:' + value);
        dbsvc.dB.openStore("Maps", function (store) {
            store.find(mapname).then(function (map) {
                dbsvc.map = map.data;
                for (i = 0; i < dbsvc.map.Map.Entities.Entity.length; i++) {
                    if (dbsvc.map.Map.Entities.Entity[i]._id === entityId) {
                        dbsvc.map.Map.Entities.Entity[i][fieldname] = value;
                    }
                }
            }).then(function () {
                store.upsert({
                    name: mapname, data: dbsvc.map
                });
            });
        });
    };
    dbsvc.updateDbFile = function (storename, recordname, data, url, $http) {
        dbsvc.dB.openStore(storename, function (store) {
            store.upsert({
                name: recordname, data: data
            }).then(function () {
                if (typeof url !== 'undefined') {
                    $http.put('/json/maps.json', data);
                }
            });
        });
    };
    dbsvc.updateMapFile = function (mapname, data) {
        dbsvc.dB.openStore('Maps', function (store) {
            store.upsert({
                name: mapname, data: data
            });
        });
    };
    return dbsvc;
});
TacMapServer.factory('GeoService', function () {
    var geosvc = {
    };
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
        var loc = poly._points;
        if (!angular.isArray(loc)) {
            loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        }
        //Cartesian wants long, lat
        geosvc.sdatasources[geosvc.mapid].entities.add({
            id: poly._id,
            name: poly._name,
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(loc.reverse()),
                width: 1,
                material: Cesium.Color[poly._color]
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
    geosvc.removeEntity = function (entityid) {
        geosvc.sdatasources[geosvc.mapid].entities.removeById(entityid);
    };
    return geosvc;
});
TacMapServer.factory('MsgService', function () {
    var msgsvc = {
    };
    msgsvc.serverid;
    msgsvc.mapid;
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
    msgsvc.joinUser = function () {

    };
    msgsvc.publishMsg = function (endpointid, mapviewid, networkid, msgtype, msg) {
        var message = msg;
        console.log("sendMessage");
        if (message && msgsvc.connected) {
            msgsvc.socket.emit('publish msg', {
                endpointid: endpointid, mapviewid: mapviewid, networkid: networkid, type: 'message', message: msg
            });
        }
    };
    msgsvc.publishView = function (endpointid, mapviewid, networkid, vwdata) {
        var message = msg;
        console.log("sendMessage");
        if (message && msgsvc.connected) {
            // tell server to execute 'new message' and send along one parameter
            msgsvc.socket.emit('publish msg', {
                endpointid: endpointid, mapviewid: mapviewid, networkid: networkid, type: 'view', mapview: vwdata
            });
        }
    };
    msgsvc.publishLocation = function (endpointid, mapviewid, networkid, location) {
        var message = msg;
        console.log("sendMessage");
        if (message && msgsvc.connected) {
            // tell server to execute 'new message' and send along one parameter
            msgsvc.socket.emit('publish msg', {
                endpointid: endpointid, mapviewid: mapviewid, networkid: networkid, type: 'location', location: location
            });
        }
    };
    msgsvc.publishEntity = function (entity) {
        var message = msg;
        console.log("sendMessage");
        if (message && msgsvc.connected) {
            // tell server to execute 'new message' and send along one parameter
            msgsvc.socket.emit('publish msg', entity);
        }
    };
    msgsvc.connectServer = function (data, sname) {
        console.log(data.message + " " + data.socketid);
        msgsvc.mapid = sname;
        msgsvc.socket.emit('initial connection', {
            endpointid: data.socketid
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