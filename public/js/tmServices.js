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
/* global TacMap, viewer, Cesium, angular, io,  X2JS, LZString, Saxon */
// ***** SERVER SERVICES ******//
/** 
 * @param  $indexedDB
 * @param  $http
 */
TacMap.factory('DbService', function($indexedDB, $http) {
    var dbsvc = {};
    dbsvc.xj = new X2JS();
    dbsvc.dB = $indexedDB;
    dbsvc.map = [];
    //
    dbsvc.loadResources = function(callback) {
        console.log("loadResources");
        dbsvc.dB.openStore('Resources', function(mstore) {
            mstore.getAllKeys().then(function(keys) {
                if (keys.indexOf('resources.json') === -1) {
                    $http.get('xml/resources.xml').then(function(result) {
                        var resrcs = dbsvc.xj.xml_str2json(result.data);
                        dbsvc.dB.openStore('Resources', function(mstore) {
                            mstore.upsert({
                                id: 'resources.json',
                                url: "json/resources.json",
                                data: resrcs
                            }).then($http.put('json/resources.json'));
                            for (var i = 0; i < resrcs.Resources.Resource.length; i++) {
                                dbsvc.loadResource(resrcs.Resources.Resource[i], function(data) {
                                    callback(data);
                                });
                            }
                        });
                    });
                }
                else {
                    mstore.find('resources.json').then(function(resrcs) {
                        for (var i = 0; i < resrcs.data.Resources.Resource.length; i++) {
                            dbsvc.loadResource(resrcs.data.Resources.Resource[i], function(data) {
                                callback(data);
                            });
                        }
                    });
                }
            });
        });
    };
    dbsvc.loadResource = function(rscrc, callback) {
        console.log("loadResource");
        var id = rscrc._id;
        var u = rscrc._url;
        $http.get(u).then(function(result) {
            var mod = result.headers()['last-modified'];
            if (u.substring(u.indexOf('.')) === '.json') {
                dbsvc.openStore('Resources', function(mstore) {
                    mstore.upsert({
                        id: id,
                        url: u,
                        lastmod: mod,
                        data: result.data
                    }).then(function() {
                        callback(result.data);
                    });
                });
            }
            else if (u.substring(u.indexOf('.')) === '.xml') {
                var jdata = dbsvc.xj.xml_str2json(result.data);
                var jname = rscrc._name.replace(' ', '').toLowerCase();
                dbsvc.dB.openStore('Resources', function(mstore) {
                    mstore.upsert({
                        id: id,
                        url: 'json/' + jname + '.json',
                        lastmod: mod,
                        data: jdata
                    }).then(function() {
                        callback(jdata);
                    });
                });
            };
        });
    };
    // Loads latest version of file or updates server based on last modified 
    dbsvc.syncFile = function(storename, url, callback) {
            var filename = url.substring(url.lastIndexOf('/') + 1);
            $http.get(url).then(function(result) {
                var mod = result.headers()['last-modified'];
                dbsvc.dB.openStore(storename, function(store) {
                    store.getAllKeys().then(function(keys) {
                        if (keys.indexOf(filename) === -1) {
                            store.upsert({
                                id: filename,
                                url: url,
                                lastmod: mod,
                                data: result.data
                            });
                            callback(result.data);
                        }
                        else {
                            store.find(filename).then(function(dbrec) {
                                if (dbrec.lastmod !== mod) {
                                    console.log('upsert ' + filename);
                                    store.upsert({
                                        id: filename,
                                        url: url,
                                        lastmod: mod,
                                        data: dbrec.data
                                    }).then(function() {
                                        if (typeof url !== 'undefined') {
                                            $http.put(url, dbrec.data);
                                        }
                                    });
                                    callback(dbrec.data);
                                }
                                else {
                                    callback(resdata);
                                }
                            });

                        }
                    });
                });
            }).error(function() {
                console.log('Error getting resource');
            });
        }
        //
    dbsvc.sortByKey = function(array, key) {
        return array.sort(function(a, b) {
            var x = a[key];
            var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    };
    //
    dbsvc.updateEntityDb = function(mapname, entityId, fieldname, value) {
        //console.log('updateDb ' + entityId + ' map name:' + mapname + ' fieldname:' + fieldname + ' value:' + value);
        dbsvc.dB.openStore("Maps", function(store) {
            store.find(mapname).then(function(map) {
                dbsvc.map = map.data;
                for (var i = 0; i < dbsvc.map.Map.Entities.Entity.length; i++) {
                    if (dbsvc.map.Map.Entities.Entity[i]._id === entityId) {
                        dbsvc.map.Map.Entities.Entity[i][fieldname] = value;
                    }
                }
            }).then(function() {
                store.upsert({
                    id: mapname,
                    data: dbsvc.map
                });
            });
        });
    };
    dbsvc.updateTrackDb = function(mapname, trackId, changes, callback) {
        console.log('updateTrackDb '+mapname);
        //  console.log(changes);
        dbsvc.dB.openStore("Maps", function(store) {
            store.find(mapname).then(function(map) {
                dbsvc.map = map.data;
                for (var i = 0; i < dbsvc.map.Map.Tracks.Track.length; i++) {
                    if (dbsvc.map.Map.Tracks.Track[i]._id === trackId) {
                        for (var c in changes) {
                            dbsvc.map.Map.Tracks.Track[i][c] = changes[c];
                        }
                    }
                }
            }).then(function() {
                //console.log('upsert');
                store.upsert({
                    id: mapname,
                    data: dbsvc.map
                });
                if (typeof(callback) != 'undefined') {
                    callback({
                        id: mapname,
                        data: dbsvc.map
                    });
                }
            });
        });
    };
    
    dbsvc.getGeoFence=function(mapname,gid,callback){
        dbsvc.dB.openStore("Maps", function(store) {
            store.find(mapname).then(function(map) {
                dbsvc.map = map.data;
                for (var i = 0; i < dbsvc.map.Map.GeoFences.GeoFence.length; i++) {
                    if (dbsvc.map.Map.GeoFences.GeoFence[i]._id === gid) {
                        callback(dbsvc.map.Map.GeoFences.GeoFence[i]);
                    }
                }
            });
        });
    };
    
    dbsvc.updateGeoFenceDb = function(mapname, entityId, fieldname, value) {
        //console.log('updateDb ' + entityId + ' map name:' + mapname + ' fieldname:' + fieldname + ' value:' + value);
        dbsvc.dB.openStore("Maps", function(store) {
            store.find(mapname).then(function(map) {
                dbsvc.map = map.data;
                for (var i = 0; i < dbsvc.map.Map.GeoFences.GeoFence.length; i++) {
                    if (dbsvc.map.Map.GeoFences.GeoFence[i]._id === entityId) {
                        dbsvc.map.Map.GeoFences.GeoFence[i][fieldname] = value;
                    }
                }
            }).then(function() {
                store.upsert({
                    id: mapname,
                    data: dbsvc.map
                });
            });
        });
    };
    //
    dbsvc.getKeys = function(storename, callback) {
        dbsvc.dB.openStore(storename, function(store) {
            store.getAllKeys().then(function(keys) {
                callback(keys);
            });
        });
    };
    //
    dbsvc.updateDbFile = function(storename, recordname, data, url, $http) {
        dbsvc.dB.openStore(storename, function(store) {
            store.upsert({
                id: recordname,
                data: data,
                url: url
            }).then(function() {
                if (typeof url !== 'undefined') {
                    $http.put(url, data);
                }
            });
        });
    };
    dbsvc.updateMapFile = function(mapname, data, url) {
        dbsvc.dB.openStore('Maps', function(store) {
            store.upsert({
                id: mapname,
                data: data,
                url: url
            });
        });
    };
    dbsvc.updateMapView = function(mapname, data) {
        dbsvc.dB.openStore('Maps', function(store) {
            store.upsert({
                id: mapname,
                data: data
            });
        });
    };
    dbsvc.getRecord = function(storename, recordname, callback) {
        console.log('getRecord ' + recordname);
        dbsvc.dB.openStore(storename, function(mstore) {
            mstore.getAllKeys().then(function(keys) {
                if (keys.indexOf(recordname) !== -1) {
                    mstore.find(recordname).then(function(rec) {
                        callback(rec);
                    });
                }
                else {
                    callback(null);
                }
            });
        });
    };
    dbsvc.addRecord = function(storename, recordname, recdata) {
        dbsvc.dB.openStore(storename, function(mstore) {
            mstore.upsert({
                id: recordname,
                data: recdata
            });
        });
    };
    dbsvc.updateRecord = function(storename, recordid, recdata, callback) {
        dbsvc.dB.openStore(storename, function(mstore) {
            mstore.upsert({
                id: recordid,
                data: recdata
            }).then(function() {
                if (typeof callback !== 'undefined') {
                    callback({
                        id: recordid,
                        data: recdata
                    });
                }
            });
        });
    };
    dbsvc.deleteRecord = function(storename, recordname, callback) {
        dbsvc.dB.openStore(storename, function(mstore) {
            mstore.delete(recordname).then(function() {
                if (typeof callback !== 'undefined') {
                    callback();
                }
            });
        });
    };
    dbsvc.updateConnection = function(listname, newdata) {
        dbsvc.dB.openStore('User', function(mstore) {
            mstore.upsert({
                id: listname,
                data: newdata
            });
        });
    };

    //
    dbsvc.getUser = function(callback) {
        dbsvc.getRecord("User", "user", callback);
    };

    dbsvc.getMapData = function(mapid, callback) {
        console.log("getMapData");
        dbsvc.getRecord("Maps", mapid, function(mdata) {
            callback(mdata);
        });
    };

    dbsvc.updateMapData = function(map_name, mapdata, callback) {
        //console.log("setUserMapData");
        dbsvc.dB.openStore('Maps', function(store) {
            store.upsert({
                id: map_name,
                data: mapdata
            }).then(function() {
                if (typeof(callback) !== "undefined") {
                    callback({
                        id: map_name,
                        data: mapdata
                    });
                };
            });
        });
    };
    return dbsvc;
});

TacMap.factory('GeoService', function($indexedDB) {
    var geosvc = {};
    geosvc.dB = $indexedDB;
    geosvc.mapid = null;
    geosvc.sdatasources = [];
    geosvc.mapdata = {};
    geosvc.initGeodesy = function(mapid, mapdata, callback) {
        console.log("initGeodesy " + mapid);
        //console.log(mapdata);
        geosvc.mapdata = mapdata;
        geosvc.mapid = mapid;
        geosvc.sdatasources[geosvc.mapid] = new Cesium.CustomDataSource(geosvc.mapid);
        viewer.dataSources.add(geosvc.sdatasources[geosvc.mapid]);
        geosvc.addPolygons(mapdata.Map.Polygons.Polygon);
        geosvc.addEntities(mapdata.Map.Entities.Entity);
        geosvc.addTracks(mapdata.Map.Tracks.Track);
        geosvc.addGeoFences(mapdata.Map.GeoFences.GeoFence);
        viewer.zoomTo(geosvc.sdatasources[geosvc.mapid].entities.getById("Default")).then(function() {
            console.log('map ready');
        });
        if (typeof callback !== 'undefined') {
            callback(mapdata);
        }
    };
    geosvc.updateView = function(mapid, mapdata) {
        console.log("updateView " + mapid);
        //console.log(mapdata);
        geosvc.mapdata = mapdata;
        geosvc.mapid = mapid;
        //geosvc.sdatasources[geosvc.mapid].entities.removeAll();
        geosvc.updatePolygons(geosvc.mapdata.Map.Polygons.Polygon);
        geosvc.updateEntities(geosvc.mapdata.Map.Entities.Entity);
        geosvc.updateTracks(geosvc.mapdata.Map.Tracks.Track);

    };
    geosvc.addEntities = function(entities) {
        //console.log('addEntities ' + entities.length);
        for (var i = 0; i < entities.length; i++) {
            if (entities[i]._location.length > 0) {
                geosvc.addCesiumBillboard(entities[i]);
            }
        }
    };
    geosvc.updateEntities = function(entities) {
        //console.log('addEntities ' + entities.length);
        for (var i = 0; i < entities.length; i++) {
            if (geosvc.sdatasources[geosvc.mapid].entities.getById(entities[i]._id)) {
                geosvc.updateCesiumBillboard(entities[i]);
            }
            else if (entities[i]._location.length > 0) {
                geosvc.addCesiumBillboard(entities[i]);
            }
        }
    };
    geosvc.addTracks = function(entities) {
        //console.log('addEntities ' + entities.length);
        for (var i = 0; i < entities.length; i++) {
            if (entities[i]._location.length > 0) {
                geosvc.addCesiumBillboard(entities[i]);
            }
        }
    };
    geosvc.updateTracks = function(entities) {
        //console.log('addEntities ' + entities.length);
        for (var i = 0; i < entities.length; i++) {
            if (geosvc.sdatasources[geosvc.mapid].entities.getById(entities[i]._id)) {
                geosvc.updateCesiumBillboard(entities[i]);
            }
            else if (entities[i]._location.length > 0) {
                geosvc.addCesiumBillboard(entities[i]);
            }
        }
    };
    geosvc.addPolygons = function(polygons) {
        //console.log('addPolygons ' + polygons.length);
        //console.log(polygons);
        for (var i = 0; i < polygons.length; i++) {
            if (polygons[i]._points.length > 0) {
                geosvc.addCesiumPolygon(polygons[i]);
            }
        }
    };
    geosvc.updatePolygons = function(polygons) {
        //console.log('addPolygons ' + polygons.length);
        //console.log(polygons);
        for (var i = 0; i < polygons.length; i++) {
            if (geosvc.sdatasources[geosvc.mapid].entities.getById(polygons[i]._id)) {
                geosvc.updateCesiumPolygon(polygons[i]);
            }
            else if (polygons[i]._points.length > 0) {
                geosvc.addCesiumPolygon(polygons[i]);
            }
        }
    };
    geosvc.addGeoFences = function(geofences) {
        for (var i = 0; i < geofences.length; i++) {
            console.log(geofences[i]._id);
            if (geosvc.sdatasources[geosvc.mapid].entities.getById(geofences[i]._id)) {
                geosvc.updateCesiumPolyline(geofences[i]._id,geofences[i]);
            }
            else {
                //geosvc.addCesiumPoint(geofences[i], 'RED');
                if (geofences[i]._points.length > 0) {
                    geosvc.addCesiumPolyline(geofences[i]);
                }
            }

        }
    };
    geosvc.updateGeoFences = function(geofences) {
        for (var i = 0; i < geofences.length; i++) {
            if (geofences[i]._points.length > 0) {
                geosvc.addCesiumPolyline(geofences[i]);
            }
        }
    };
    geosvc.addCesiumPolygon = function(poly) {
        //console.log('addPolygon');
        var loc = poly._points;
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
    geosvc.updateCesiumPolygon = function(poly) {
        //console.log('addPolygon');
        var loc = poly._points;
        //console.log(loc);
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        //Cartesian wants long, lat
        var polyg = geosvc.sdatasources[geosvc.mapid].entities.getById(poly._id);
        polyg.name = poly._name;
        polyg.polygon.hierarchy = Cesium.Cartesian3.fromDegreesArray(loc.reverse());
        polyg.polygon.outlineColor = Cesium.Color[poly._color];

    };
    geosvc.addCesiumPolyline = function(poly) {
         console.log('addCesiumPolyline ' + poly._id);
        var loc = poly._points;
        if (!angular.isArray(loc)) {
            loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        }
        //console.log(loc);
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

    geosvc.updateCesiumPolyline = function(id,poly) {
         console.log('updateCesiumPolyline ' + poly._id);
        geosvc.sdatasources[geosvc.mapid].entities.removeById(id);
        var loc = poly._points;
        if (!angular.isArray(loc)) {
            loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        }
        //console.log(loc);
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
    geosvc.addCesiumBillboard = function(entity) {
        //console.log("Add billboard");
        var loc = entity._location;
        var w = 40;
        var h = 25;
        if (entity._width) {
            w = entity._width;
        }
        if (entity._height) {
            h = entity._height;
        }
        if (!Array.isArray(loc)) {
            loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        }
        geosvc.sdatasources[geosvc.mapid].entities.add({
            id: entity._id,
            name: entity._name,
            position: Cesium.Cartesian3.fromDegrees(loc[1], loc[0]),
            billboard: {
                image: entity._icon,
                width: w,
                height: h
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
    geosvc.updateCesiumBillboard = function(entity) {
        //console.log("Update billboard");
        var loc = entity._location;
        var w = 40;
        var h = 25;
        if (entity._width) {
            w = entity._width;
        }
        if (entity._height) {
            h = entity._height;
        }
        if (!Array.isArray(loc)) {
            loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        }
        var bbd = geosvc.sdatasources[geosvc.mapid].entities.getById(entity._id);
        bbd.name = entity._name;
        bbd.position = Cesium.Cartesian3.fromDegrees(loc[1], loc[0]);
        bbd.billboard.image = entity._icon;
        bbd.billboard.width = w;
        bbd.billboard.height = h;
        bbd.label.text = entity._name;
    };
    geosvc.addCesiumPoint = function(entity, color) {
        console.log("Add point " + geosvc.mapid + ", " + entity._id + ", " + entity._location);
        var loc = entity._location;
        //loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        var e=geosvc.sdatasources[geosvc.mapid].entities.getById(entity._id);
        if (typeof e !=="undefined"){
           geosvc.sdatasources[geosvc.mapid].entities.removeById(entity._id);
           geosvc.addCesiumPoint(entity, color);
        }
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
    geosvc.addCesiumEllipsoid = function(entity) {
        console.log("Add elipsoid");
        var loc = entity._location;
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        geosvc.sdatasources[geosvc.mapid].entities.add({
            id: entity._id,
            name: entity._name,
            position: geosvc.Cart3.fromDegrees(loc[1], loc[0]),
            ellipsoid: {
                radii: Cesium.Cartesian3(10.0, 10.0, 10.0),
                material: Cesium.Color.BLUE.withAlpha(0.5)
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
    geosvc.removeEntity = function(entityid) {
        geosvc.sdatasources[geosvc.mapid].entities.removeById(entityid);
    };

    //
    //Experimental - store Cesium Data
    geosvc.storeMapData = function(storename, mapid, data) {
        geosvc.compress(data, function(cmp) {
            geosvc.dB.openStore(storename, function(mstore) {
                mstore.upsert({
                    id: mapid,
                    data: cmp
                });
            });
        });
    };
    geosvc.retrieveMapData = function(storename, mapid, data, callback) {
        geosvc.dB.openStore(storename, function(mstore) {
            mstore.find(mapid).then(function(cdata) {
                geosvc.decompress(cdata, function(dcmp) {
                    callback(dcmp);
                });
            });
        });
    };
    geosvc.compress = function(udata, callback) {
        var c = LZString.compressToUTF16(udata);
        callback(c);
    };
    geosvc.decompress = function(cdata, callback) {
        var d = LZString.decompressFromUTF16(cdata);
        callback(d);
    };
    //Experimental - share views
    geosvc.initViewListener = function(viewname, SocketService) {
        viewer.scene.screenSpaceCameraController.inertiaSpin = 0;
        viewer.scene.screenSpaceCameraController.inertiaTranslate = 0;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0;
        viewer.scene.camera.moveEnd.addEventListener(function() {
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
            SocketService.publishView(viewname, vw);
        });
    };
    geosvc.stopViewListener = function() {
        viewer.scene.camera.moveEnd.destroy();
    };
    geosvc.getView = function() {
        return ({
            position: viewer.scene.camera.position.clone,
            direction: viewer.scene.camera.direction.clone,
            up: viewer.scene.camera.up.clone,
            right: viewer.scene.camera.right.clone,
            transform: viewer.scene.camera.transform.clone
        });
    };
    geosvc.setView = function(vwdata) {
        viewer.scene.camera.position = vwdata.position;
        viewer.scene.camera.direction = vwdata.direction;
        viewer.scene.camera.up = vwdata.up;
        viewer.scene.camera.right = vwdata.right;
        viewer.scene.camera.transform = vwdata.transform;
        //viewer.scene.camera.frustum = vwdata.frustum;
    };

    return geosvc;
});

TacMap.factory('MsgService', function($indexedDB, $http) {
    var msgsvc = {};
    //msgsvc.xj = new X2JS();
    msgsvc.postMsg = function(url, data) {
        console.log("postMsg");
        //console.log(url);
        //console.log(data);
        //var url2="http://10.111.50.40:8080"+url;
       // var xmlAsStr = msgsvc.xj.json2xml_str(data);
        console.log(data);
        $http.post(url, data).success(function(response) {
            console.log("Msg POST success");
        }).error(function(err) {
            console.log("failure " + err);
        });
        /* $http.post(url2, data).success(function(response) {
             console.log("success");
         }).error(function(err) {
             console.log("failure " + err);
         });*/
    }
    msgsvc.mtfMsg = function() {
    }
    return msgsvc;
})

TacMap.factory('SocketService', function() {
    var scktsvc = {};
    scktsvc.serverid;
    scktsvc.mapid;
    scktsvc.namespace;
    scktsvc.scktid = "";
    //scktsvc.socket is used at the global level
    scktsvc.socket = io.connect(window.location.host);
    //scktsvc.map_socket is used at the namespace level
    scktsvc.map_socket;
    //Initializes MapView as Namespace on SocketIO server
    //Connects to Namespace, and passes fucntion that notifies all that connected.
    scktsvc.initMapView = function(ep) {
        console.log('initMapView ' + ep.user_id);
        scktsvc.scktid = ep.socketid;
        scktsvc.socket.emit('join namespace', ep, function(endpoint) {
            console.log('join namespace ' + endpoint.user_id);
            scktsvc.map_socket = io.connect(window.location.host + '/' + endpoint.user_id);
            scktsvc.map_socket.once('connect', function() {
                console.log('joined namespace ' + endpoint.user_id);
                scktsvc.socket.emit('initial connection', ep);
            });
        });
    };
    scktsvc.setMapView = function(ep) {
        console.log("setMapView " + ep.map_id);
        scktsvc.socket.emit('join namespace', ep, function(endpoint) {
            console.log('join namespace ' + ep.map_id);
            scktsvc.map_socket = io.connect(window.location.host + '/' + ep.map_id);
            scktsvc.map_socket.once('connect', function() {
                console.log('joined namespace ' + ep.map_id);
                scktsvc.socket.emit('initial connection', ep);
            });
        });
    };
    scktsvc.createNet = function(mapviewid, networkid, networkaddress) {
        console.log('createNet ' + mapviewid + ": " + networkid);
        if (typeof scktsvc.map_socket !== 'undefined') {
            scktsvc.map_socket.emit('create network', {
                map_id: mapviewid,
                network_id: networkid,
                network_address: networkaddress,
            });
        }
    };
    scktsvc.deleteNet = function(mapviewid, networkid) {
        console.log('deleteNet ' + mapviewid + ": " + networkid);
        if (typeof scktsvc.map_socket !== 'undefined') {
            scktsvc.map_socket.emit('remove network', {
                map_id: mapviewid,
                network_id: networkid
            });
        }
    };
    scktsvc.createMap = function(mapname, mapdata) {
        console.log('createMap ' + mapname);
        scktsvc.socket.emit('create map', {
            "name": mapname
        });
    };
    scktsvc.joinNet = function(id, netname) {
        console.log('joinNet ' + id + ', ' + netname);
        //scktsvc.map_socket.join(netname);
        scktsvc.map_socket.emit('join network', {
            map_id: id,
            network_id: netname
        });
    };
    scktsvc.leaveNet = function(id, netname) {
        console.log('leaveNet ' + id + ', ' + netname);
        if (typeof scktsvc.map_socket !== 'undefined') {
            scktsvc.map_socket.emit('leave network', {
                map_id: id,
                network_id: netname
            });
        }
    };
    //This provide socket message to be published from server
    scktsvc.publishMsg = function(pubmsg, data, networkid) {
        if (typeof networkid !== 'undefined') {
            //publish to net
            scktsvc.map_socket.to(networkid).emit('publish msg', {
                scktmsg: pubmsg,
                data: data
            });
        }
        else {
            //publish to all
            scktsvc.map_socket.emit('publish msg to all', {
                scktmsg: pubmsg,
                data: data
            });
        }
    };
    // Create a mapview that other nodes can 
    /*    scktsvc.createMap = function(networkid, mapdata) {
            if (typeof networkid !== 'undefined') {
                //publish to net
                scktsvc.map_socket.to(networkid).emit('create map', mapdata);
            }
            else {
                //publish to all
                scktsvc.map_socket.emit('create map', mapdata);
            }
        };*/
    scktsvc.publishMap = function(map) {
        //scktsvc.map_socket = io.connect(window.location.host + '/' +mapviewid);
        scktsvc.map_socket.emit('publish map', map);
    };
    scktsvc.requestMaps = function() {
        //scktsvc.map_socket = io.connect(window.location.host + '/' +mapviewid);
        scktsvc.map_socket.emit('request maps');
    };
    scktsvc.syncTracks = function(tracklist) {
        scktsvc.map_socket.emit('Sync Tracks', {
            scktid: scktsvc.scktid,
            tracks: tracklist
        });
    };
    return scktsvc;
});

TacMap.factory('XSLService', function() {
    var xslsvce = {};
    xslsvce.saxonloaded = false;
    xslsvce.xslproc = [];

    xslsvce.onSaxonLoad = function() {
        console.log('saxon loaded');
        xslsvce.saxonloaded = true;
    };

    xslsvce.initXSL = function(name, xsl) {
        xslsvce.xslproc[name] = Saxon.newXSLT20Processor(Saxon.parseXML(xsl));
    }

    xslsvce.doXSL = function(name, xmlsrc, params) {
        for (var p = 0; p < params.length; p++) {
            xslsvce.xslproc[name].setParameter(null, params[p].name, params[p].value);
        }
        var result = xslsvce.xslproc[name].transformToFragment(Saxon.parseXML(xmlsrc));
        return Saxon.serializeXML(result);
    }
    return xslsvce;
})

TacMap.factory('DlgBx', function($window, $q) {
    var dlg = {};
    dlg.alert = function(title, message) {
        var defer = $q.defer();
        $window.swal({
            title: title,
            text: message,
            allowOutsideClick: false,
            type: 'warning',
            width: 300

        });
        defer.resolve();
        return (defer.promise);
    };
    dlg.prompt = function(title, message, defaultValue) {
        var defer = $q.defer();
        // The native prompt will return null or a string.
        var response = $window.swal({
            title: title,
            text: message,
            input: 'text',
            allowOutsideClick: false,
            type: 'info',
            inputValue: defaultValue,
            width: 300
        });
        if (response === null) {
            defer.reject();
        }
        else {
            defer.resolve(response);
        }
        return (defer.promise);
    };
    dlg.confirm = function(title, message) {
        var defer = $q.defer();
        // The native confirm will return a boolean.
        $window.swal({
            title: title,
            text: message,
            allowOutsideClick: false,
            type: 'warning',
            showCancelButton: true,
            width: 300
        }).then(function(isConfirm) {
            if (isConfirm) {
                defer.resolve(true);
            }
            else if (isConfirm === false) {
                defer.resolve(false);
            }
        });
        return (defer.promise);
    };
    dlg.select = function(title, message, list) {
        var defer = $q.defer();
        // The native prompt will return null or a string.
        var response = $window.swal({
            title: title,
            text: message,
            allowOutsideClick: false,
            input: 'select',
            inputOptions: list,
            inputPlaceholder: 'Admin',
            showCancelButton: false,
            width: 300
        });

        if (response === null) {
            defer.reject();
        }
        else {
            defer.resolve(response);
        }
        return (defer.promise);
    }
    return dlg;
});
