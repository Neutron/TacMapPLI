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
/* global TacMap, TacMapUnit, viewer, Cesium, DbService, angular, scktsvc, io, $indexedDB, $scope */
// ***** SERVER SERVICES ******//
TacMap.factory('DbService', function ($indexedDB) {
    var dbsvc = {
    };
    dbsvc.xj = new X2JS();
    dbsvc.dB = $indexedDB;
    dbsvc.map = [];
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
                    $http.put(url, data);
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
    dbsvc.getRecord = function (storename, recordname, callback) {
        console.log('getRecord ' + recordname);
        dbsvc.dB.openStore(storename, function (mstore) {
            mstore.getAllKeys().then(function (keys) {
//                console.log(keys);
                if (keys.indexOf(recordname) !== -1) {
                    mstore.find(recordname).then(function (rec) {
 //                       console.log(rec);
                        callback(rec.data);
                    });
                } else {
                    callback(null);
                }
            });
        });
    };
    dbsvc.addRecord = function (storename, recordname, recdata) {
        dbsvc.dB.openStore(storename, function (mstore) {
            mstore.upsert({
                name: recordname, data: recdata
            });
        });
    };
    dbsvc.updateRecord = function (storename, recordname, recdata, callback) {
        dbsvc.dB.openStore(storename, function (mstore) {
            mstore.upsert({
                name: recordname, data: recdata
            }).then(function () {
                if (typeof callback !== 'undefined') {
                    callback();
                }
            });
        });
    };
    dbsvc.deleteRecord = function (storename, recordname, callback) {
        dbsvc.dB.openStore(storename, function (mstore) {
            mstore.delete(recordname).then(function () {
                if (typeof callback !== 'undefined') {
                    callback();
                }
            });
        });
    };
    dbsvc.updateConnection = function (listname, newdata) {
        dbsvc.dB.openStore('User', function (mstore) {
            mstore.upsert({name: listname, data: newdata});
        });
    };
    return dbsvc;
});
TacMap.factory('GeoService', function () {
    var geosvc = {
    };
    geosvc.mapid = null;
    geosvc.sdatasources = [];
    geosvc.initGeodesy = function (mapid, mapdata, callback) {
        console.log("initGeodesy " + mapid);
        geosvc.mapid = mapid;
        geosvc.sdatasources[geosvc.mapid] = new Cesium.CustomDataSource(geosvc.mapid);
        viewer.dataSources.add(geosvc.sdatasources[geosvc.mapid]);
        geosvc.addPolygons(mapdata.Map.Polygons.Polygon);
        geosvc.addEntities(mapdata.Map.Entities.Entity);
        geosvc.addTracks(mapdata.Map.Tracks.Track);
        geosvc.addGeoFences(mapdata.Map.GeoFences.GeoFence);
        viewer.zoomTo(geosvc.sdatasources[geosvc.mapid].entities.getById("Default")).then(function () {
            console.log('map ready');
            callback();
        });
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
    geosvc.initViewListener = function (userid, viewname, SocketService) {
        viewer.scene.screenSpaceCameraController.inertiaSpin = 0;
        viewer.scene.screenSpaceCameraController.inertiaTranslate = 0;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0;
        viewer.scene.camera.moveEnd.addEventListener(function () {
            // Publish view when the camera stops moving
            var vw = {
                position: viewer.scene.camera.position.clone,
                direction: viewer.scene.camera.direction.clone,
                up: viewer.scene.camera.up.clone,
                right: viewer.scene.camera.right.clone,
                transform: viewer.scene.camera.transform
                        //frustum: geosvc.camera.frustum.clone()
            };
            // console.log(vw);
            SocketService.publishView(userid, viewname, vw);
        });
    };
    geosvc.stopViewListener = function () {
        viewer.scene.camera.moveEnd.destroy();
    };
    geosvc.getView = function () {
        return({
            position: viewer.scene.camera.position.clone,
            direction: viewer.scene.camera.direction.clone,
            up: viewer.scene.camera.up.clone,
            right: viewer.scene.camera.right.clone,
            transform: viewer.scene.camera.transform.clone
        });
    };
    geosvc.setView = function (vwdata) {
        viewer.scene.camera.position = vwdata.position;
        viewer.scene.camera.direction = vwdata.direction;
        viewer.scene.camera.up = vwdata.up;
        viewer.scene.camera.right = vwdata.right;
        viewer.scene.camera.transform = vwdata.transform;
        //viewer.scene.camera.frustum = vwdata.frustum;
    };
    return geosvc;
});
TacMap.factory('SocketService', function () {
    var scktsvc = {
    };
    scktsvc.serverid;
    scktsvc.mapid;
    //scktsvc.socket is used at the global level
    scktsvc.socket = io.connect(window.location.host);
    //scktsvc.map_socket is used at the namespace level
    scktsvc.map_socket;
    scktsvc.initMapView = function (mapview, user) {
        console.log('initMapView ' + mapview);
        scktsvc.socket.emit('joinNamespace', {mapvwid: mapview}, function (data) {
            console.log('join namespace ' + data.namespace);
            scktsvc.map_socket = io.connect(window.location.host + '/' + data.namespace);
            scktsvc.map_socket.once('connect', function () {
                console.log('joined namespace ' + data.namespace);
                scktsvc.socket.emit('initial connection', user);
            });
        });
    };
    scktsvc.setMapView = function (mapview) {
        console.log('setMapView ' + mapview);
        scktsvc.socket.emit('joinNamespace', {mapvwid: mapview}, function (data) {
            console.log('join namespace ' + data.namespace);
            scktsvc.map_socket = io.connect(window.location.host + '/' + data.namespace);
            scktsvc.map_socket.once('connect', function () {
                console.log('joined namespace ' + data.namespace);
                //scktsvc.map_socket.emit('initial connection', user);
            });
        });
    };
    scktsvc.createNet = function (mapviewid, netname) {
        console.log('createNet ' + mapviewid + ": " + netname);
        if (typeof scktsvc.map_socket !== 'undefined') {
            scktsvc.map_socket.emit('create network', {mapviewid: mapviewid, netname: netname});
        }
    };
    scktsvc.deleteNet = function (mapviewid, netname) {
        console.log('deleteNet ' + mapviewid + ": " + netname);
        if (typeof scktsvc.map_socket !== 'undefined') {
            scktsvc.map_socket.emit('remove network', {mapviewid: mapviewid, netname: netname});
        }
    };
    scktsvc.createMap = function (mapname) {
        console.log('createMap ' + mapname);
        scktsvc.socket.emit('create mapview', {mapviewid: mapname});
    };
    scktsvc.changeMap = function (mapname) {
        if (typeof scktsvc.map_socket !== 'undefined') {
            console.log('disconnect from ' + mapname);
            scktsvc.map_socket.emit('change map', null);
        }
    };
    scktsvc.joinNet = function (id, netname) {
        console.log('joinNet ' + id + ', ' + netname);
        //scktsvc.map_socket.join(netname);
        scktsvc.map_socket.emit('join network', {mapviewid: id, network: netname});
    };
    scktsvc.leaveNet = function (id, netname) {
        console.log('leaveNet ' + id + ', ' + netname);
        if (typeof scktsvc.map_socket !== 'undefined') {
            scktsvc.map_socket.emit('leave network', {mapviewid: id, network: netname});
        }
    };
    //This published provided socket message from client
    scktsvc.publish = function (pubmsg, data, networkid) {
        if (typeof networkid !== 'undefined') {
            //publish to net
            scktsvc.map_socket.to(networkid).emit(pubmsg, data);
        } else {
            //publish to all             scktsvc.socket.emit(pubmsg, data);
        }
    };
    //This provide socket message to be published from server
    scktsvc.publishMsg = function (pubmsg, data, networkid) {
        if (typeof networkid !== 'undefined') {
            //publish to net
            scktsvc.map_socket.to(networkid).emit('publish msg', {msg: pubmsg, payload: data});
        } else {
            //publish to all
            scktsvc.map_socket.emit('publish msg to all', {msg: pubmsg, payload: data});
        }
    };
    // Create a mapview that other nodes can 
    scktsvc.createMapView = function (data, networkid) {
        if (typeof networkid !== 'undefined') {
            //publish to net
            scktsvc.map_socket.to(networkid).emit('create mapview', data);
        } else {
//publish to all
            scktsvc.map_socket.emit('create mapview', data);
        }
    };
    scktsvc.publishView = function (userid, mapview, vwdata) {
        scktsvc.map_socket = io('/' + mapview);
        scktsvc.map_socket.emit('update view', {userid: userid, viewdata: vwdata});
    };
    return scktsvc;
});
TacMap.factory('DlgBx', function ($window, $q) {
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