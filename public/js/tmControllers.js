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
/* global resources, TacMap, Cesium, scene, angular, stctl, viewer, usrctl,$scope,DbService, SocketService, GeoService, DlgBx */
// ***** CONTROLLERS ******//
// userCtl handles initial user registraton and persists user data
TacMap.controller('userCtl', function ($scope, DbService, SocketService, GeoService, DlgBx) {
    var usrctl = this;
    usrctl.endpoint = {};
    usrctl.map = "";
    //UI Views
    usrctl.msgLog = "views/msgLog.html";
    usrctl.mapStore = "views/mapStore.html";
    usrctl.userProfile = "views/userProfile.html";
    usrctl.mapEntities = "views/mapEntities.html";
    usrctl.editprofile = false;
    usrctl.editProfile = function (ep) {
        usrctl.currmap = ep.mapview;
        usrctl.currnet = ep.network;
        usrctl.editprofile = true;
    };
    usrctl.cancelEdit = function () {
        usrctl.editprofile = false;
    };
    usrctl.saveProfile = function () {
        DbService.updateRecord('User', 'user', usrctl.user);
        //Update namespace if mapview name changed
        if (usrctl.currnet !== usrctl.user.endpoint.network) {
            SocketService.deleteNet(usrctl.currmap, usrctl.currnet);
            SocketService.createNet(usrctl.mselected, usrctl.user.endpoint.network);
            if (usrctl.currmap !== usrctl.user.endpoint.mapview) {
                SocketService.changeMap(usrctl.currmap);
                SocketService.initMapView(usrctl.user.endpoint.mapview, usrctl.user);
                usrctl.mselected = usrctl.user.endpoint.mapview;
            }
        } else if (usrctl.currmap !== usrctl.user.endpoint.mapview) {
            SocketService.changeMap(usrctl.currmap);
            SocketService.initMapView(usrctl.user.endpoint.mapview, usrctl.user);
            usrctl.mselected = usrctl.user.endpoint.mapview;
        }
        usrctl.editprofile = false;
    };
    usrctl.registerEndpoint = function (data) {
        DbService.getRecord('User', 'user', function (usr) {
            // console.log(usr);
            if (usr === null) {
                DlgBx.prompt("Enter User Name: ", data.socketid).then(function (uname) {
                    usrctl.endpoint.id = $scope.socketID;
                    usrctl.endpoint.name = uname;
                    usrctl.endpoint.network = uname + '-Net';
                    usrctl.endpoint.mapview = uname + '-Map';
                    usrctl.map = usrctl.endpoint.mapview;
                    DbService.addRecord('User', 'user', usrctl.endpoint);
                    console.log('User registered');
                    //console.log(user.endpoint.mapview.viewdata);
                    //Initialize namespace for current mapview.
                    SocketService.initMapView(usrctl.endpoint);
                });
            } else {
                usrctl.endpoint = usr;
                usrctl.endpoint.id = $scope.socketID;
                SocketService.initMapView(usrctl.endpoint);
            }
        });
    };
    usrctl.sortByKey = function (array, key) {
        return array.sort(function (a, b) {
            var x = a[key];
            var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    };
    //Sorts list by key name    
    SocketService.socket.on('connection', function (data) {
        $scope.socketID = data.socketid;
        console.log('map connect ' + $scope.socketID);
        usrctl.registerEndpoint(data);
    });
    SocketService.socket.on('update endpoints', function (data) {
        console.log('update endpoints');
        usrctl.endpoints = data.endpoints;
        //console.log(usrctl.endpoints);
        DbService.updateRecord('User', 'endpoints', data.endpoints);
    });
});
//storeCtl handles persistnce of data in browser IndexedDB and on a node.js server
TacMap.controller('storeCtl', function ($scope, $http, DbService, GeoService, SocketService, DlgBx) {
    var stctl = this;
    stctl.import = false;
    //List of maps saved to IndexedDB
    stctl.maplist = [{name: 'Default Map'}];
    //Writes Map Data to Server as JSON File
    stctl.exportMap = function () {
        console.log("exportMap");
        DlgBx.prompt("Enter Export Save As Name:", stctl.mselected).then(function (newname) {
            if (newname === 'Default Map') {
                DlgBx.alert("You Can't' Overwrite the Default Map");
            } else {
                var overwrite = null;
                for (n = 0; n < stctl.maplist.length; n++) {
                    if (newname === stctl.maplist[n].map) {
                        overwrite = stctl.maplist[n].map;
                    }
                }
                if (overwrite !== null) {
                    DlgBx.confirm("This Action will Overwrite Map", overwrite).then(function (yes) {
                        if (yes) {
                            console.log("Export " + overwrite);
                            DbService.dB.openStore("Maps", function (store) {
                                store.find(overwrite).then(function (scen) {
                                    var map = scen.data;
                                    //console.log(map);
                                    $http.put("/json/" + overwrite.replace(' ', '') + '.json', map);
                                });
                            });
                        }
                    });
                } else {
                    console.log("Export " + newname);
                    DbService.dB.openStore("Maps", function (store) {
                        store.find(stctl.mselected).then(function (scen) {
                            var map = scen.data;
                            $http.post("/json/" + newname.replace(' ', '') + '.json', map).success(function () {
                                console.log("Saved " + newname + " to /json/" + newname.replace(' ', '') + ".json");
                                stctl.maplist.push({
                                    name: newname.replace(' ', '')
                                });
                                DbService.updateDbFile('Resources', 'maps.json', stctl.maplist, "/json/maps.json", $http);
                            });
                        });
                    });
                }
            }
            stctl.import = false;
        });
    };
    //Get map data file from node.js server and save to indexedDB
    stctl.getFile = function (savedmap) {
        console.log("Get File: " + savedmap.name + ", " + savedmap.url);
        $http.get(savedmap.url).success(function (sdata) {
            DlgBx.prompt("Enter Save As Name or Overwrite", savedmap.name).then(function (newname) {
                if (newname === "Default Map") {
                    DlgBx.alert("You Can't' Overwrite the Default Map");
                } else {
                    var overwrite = null;
                    var overwriteid = null;
                    for (i = 0; i < stctl.maplist.length; i++) {
                        if (newname === stctl.maplist[i].value) {
                            overwrite = stctl.maplist[i].value;
                            console.log(overwrite);
                            overwriteid = stctl.maplist[i].value;
                            break;
                        }
                    }
                    if (overwrite !== null) {
                        console.log(overwrite);
                        DlgBx.confirm("This Action will Overwrite Map " + overwrite).then(function (yes) {
                            if (yes) {
                                stctl.currmapData = sdata;
                                stctl.overwriteMap(overwrite);
                            }
                        });
                    } else {
                        console.log("Save " + newname);
                        stctl.currmapData = sdata;
                        DbService.dB.openStore("Maps", function (store) {
                            store.insert({
                                name: newname, data: sdata
                            }).then(function () {
                                stctl.maplist.push({
                                    name: newname
                                });
                                stctl.currmap = {
                                    name: newname
                                };
                                stctl.loadMap(savedmap);
                            });
                        });
                    }
                }
            });
        });
    };
    //Saves changes to loaded map to indexedDB
    stctl.updateMap = function () {
        DbService.dB.openStore("Maps", function (store) {
            store.upsert({
                name: stctl.mselected, data: mapctl.map
            });
        });
    };
    stctl.overwriteMap = function (mapid) {
        console.log("overwriteMap: " + mapid);
        DbService.dB.openStore("Maps", function (store) {
            store.find(mapid).then(function () {
                store[ "delete"](mapid).then(function () {
                    store.insert({
                        name: mapid, data: stctl.currmapData
                    });
                });
            });
        });
    };
    stctl.deleteMap = function (currentmap) {
        if (stctl.mselected === 'Default Map') {
            DlgBx.alert("Can't delete Default Map");
        } else {
            DlgBx.confirm("Confirm deletion of Map: " + currentmap.name).then(function (yes) {
                console.log("Confirm response: " + stctl.mselected);
                if (yes && stctl.mselected !== 'Default Map') {
                    console.log("Delete from Idb: " + currentmap.name);
                    DbService.dB.openStore("Maps", function (store) {
                        store[ "delete"](currentmap.name);
                    });
                    var na = [];
                    for (i = 0; i < stctl.maplist.length; i++) {
                        if (stctl.maplist[i].name !== currentmap.name) {
                            na.push(stctl.maplist[i]);
                        }
                    }
                    stctl.maplist = na;
                    stctl.loadMap(stctl.maplist[0]);
                    DbService.updateDbFile('Resources', 'maps.json', stctl.maplist, "/json/maps.json", $http);
                }
            });
        }
    };
    //Saves current map to IndexedDB and node.js server with new name ensuring no duplicate name
    stctl.saveMap = function (currentmap) {
        console.log("saveMap");
        DlgBx.prompt("Enter Save As Name or Overwrite", currentmap.name).then(function (newname) {
            var overwrite = null;
            for (n = 0; n < stctl.maplist.length; n++) {
                if (newname === stctl.maplist[n].name) {
                    overwrite = stctl.maplist[n].name;
                }
            }
            if (overwrite !== null) {
                DlgBx.confirm("This Action will Overwrite Map", overwrite).then(function (yes) {
                    if (yes) {
                        console.log("Save " + overwrite);
                        stctl.overwriteMap(overwrite);
                        stctl.currmap = currentmap;
                        stctl.loadMap({
                            name: overwrite
                        });
                    }
                });
            } else {
                console.log("Save " + newname);
                stctl.copyMap(stctl.mselected, newname);
                stctl.maplist.push({
                    name: newname
                });
                stctl.currmap = currentmap;
                stctl.loadMap(stctl.maplist[stctl.maplist.length - 1]);
                DbService.updateDbFile('Resources', 'maps.json', stctl.maplist, "/json/maps.json", $http);
            }
        });
    };
    //Copies current map assuming name already deconflicted
    stctl.copyMap = function (currentmap, newmapid) {
        DbService.dB.openStore("Maps", function (store) {
            store.find(currentmap).then(function (map) {
                store.insert({
                    name: newmapid, url: map.url, data: map.data
                });
            });
        });
    };
    //Loads map data from IndexedDB and calls GeoService to initialize Cesium View
    stctl.loadMap = function (nextmap) {
        console.log("loadMap " + nextmap.name);
        //console.log("Current Map:" + stctl.currmap.value);
        $scope.netselected = [];
        viewer.dataSources.remove(GeoService.sdatasources[stctl.mselected]);
        DbService.dB.openStore("Maps", function (store) {
            store.find(nextmap.name).then(function (sc) {
                if (typeof sc.data !== 'undefined') {
                    stctl.currmapData = sc.data;
                    GeoService.initGeodesy(nextmap.name, sc.data);
                    stctl.currmap = nextmap;
                }
            });
        });
        stctl.mselected = nextmap.name;
    };
    //Loads XML defined maps from node.js server, checks if indexedDB storage is current and
    //updates if necessary
    stctl.initMaps = function () {
        DbService.dB.openStore('Resources', function (mstore) {
            mstore.getAllKeys().then(function (keys) {
                if (keys.indexOf('maps.json') === -1) {
                    $http.get('xml/maps.xml').success(function (resdata, status, headers) {
                        var maps = DbService.xj.xml_str2json(resdata);
                        for (i = 0; i < maps.Maps.Map.length; i++) {
                            var u = maps.Maps.Map[i]._url;
                            var n = maps.Maps.Map[i]._name;
                            if (u.substring(u.indexOf('.')) === '.xml') {
                                stctl.syncResource(maps.Maps.Map[i]._url, function (jdata) {
                                    if (jdata.Map._name !== 'Default Map') {
                                        stctl.maplist.push({
                                            name: jdata.Map._name
                                        });
                                    }
                                    if (jdata.Map._name === 'Default Map') {
                                        //console.log('init geo');
                                        stctl.currmapData = jdata;
                                        GeoService.initGeodesy(jdata.Map._name, jdata);
                                    }
                                });
                            } else {
                                $http.get(u).success(function (jsondata, status, headers) {
                                    var jsmod = headers()[ 'last-modified'];
                                    stctl.dB.openStore('Maps', function (mstore) {
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
                        stctl.maplist = dbrec.data;
                        stctl.loadMap({name: 'Default Map'});
                    });
                }
            });
        });
    };
    //Compares last modified dates between server file and indexedDb file
    //updates indexeDB and passes current data to callback function
    stctl.syncResource = function (url, callback) {
        //console.log("syncResource " + mapid);
        $http.get(url).success(function (resdata, status, headers) {
            var mod = headers()[ 'last-modified'];
            var filename = url.substring(url.lastIndexOf('/') + 1);
            var jdata = DbService.xj.xml_str2json(resdata);
            var mname = jdata.Map._name;
            var jname = mname.replace(' ', '').toLowerCase();
            DbService.dB.openStore('Maps', function (mstore) {
                mstore.upsert({
                    name: mname, url: 'json/' + jname + '.json', lastmod: mod, data: jdata
                }).then(function () {
                    DbService.dB.openStore('Resources', function (store) {
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
                        callback(jdata);
                    });
                });
            });
        }).error(function () {
            console.log('Error getting resource');
        });
    };
    stctl.mapSelected = function (m) {
        return stctl.mselected === m;
    };
    //Deletes data stores in Browser IndexedDB
    stctl.clearDb = function () {
        console.log("Clear DB");
        DlgBx.confirm("Confirm Deletion of Local Data").then(function () {
            viewer.dataSources.remove(GeoService.sdatasources[stctl.mselected]);
            viewer.dataSources.remove(GeoService.ppdatasources[stctl.mselected]);
            DbService.dB.openStore('Resources', function (store) {
                store.clear();
            });
            DbService.dB.openStore('Map', function (store) {
                store.clear();
            });
        });
    };
    //Initializes map when socket connection reported by server
    SocketService.socket.on('connection', function () {
        stctl.initMaps();
    });
});
//mapCtl handles creation, editing and display of Map Views
//Map Views contain polygons, tracks, geofences, etc.
TacMap.controller('mapCtl', function ($scope, DbService, GeoService, SocketService, DlgBx) {
    var mapctl = this;
    var ellipsoid = scene.globe.ellipsoid;
    mapctl.mselected = 'Default Map';
    mapctl.currmap = [];
    mapctl.currmapData = [];
    mapctl.mapviews = {};
    mapctl.trackselected = null;
    mapctl.geofenceselected = null;
    mapctl.currmap = [];
    mapctl.editgeofencechecked = false;
    mapctl.editlocchecked = false;
    mapctl.import = false;
    mapctl.maps = [];
    mapctl.entities = [];
    mapctl.tracks = [];
    mapctl.geofences = [];
    mapctl.loc = [];
    mapctl.mapid = "";
    mapctl.mousepos = {};
    mapctl.lftClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    mapctl.lftClickHandler.setInputAction(function (mouse) {
        mapctl.mousepos = mouse.position;
        var pickedObject = scene.pick(mouse.position);
        if (typeof pickedObject !== 'undefined') {
            if (Cesium.defined(pickedObject) && pickedObject.id.billboard || pickedObject.id.ellipsoid || pickedObject.id.point) {
                mapctl.selectTrack(pickedObject.id);
            } else {
                mapctl.trackselected = null;
                mapctl.geofenceselected = null;
                mapctl.editlocchecked = false;
                mapctl.loc = [];
                $scope.$apply();
            }
        } else {
            mapctl.trackselected = null;
            mapctl.geofenceselected = null;
            mapctl.editlocchecked = false;
            mapctl.loc = [];
            $scope.$apply();
        }
    },
            Cesium.ScreenSpaceEventType.LEFT_CLICK);
    mapctl.rtClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    mapctl.rtClickHandler.setInputAction(function (mouse) {
        mapctl.mousepos = mouse.position;
        var cartesian = viewer.camera.pickEllipsoid(mouse.position, ellipsoid);
        if (mapctl.editlocchecked && cartesian && mapctl.trackselected !== null) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            mapctl.setLocation(mapctl.trackselected, Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
        } else if (mapctl.editlocchecked && cartesian && mapctl.trackselected === null) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            mapctl.addTrack(Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
        } else if (mapctl.editgeofencechecked && cartesian && mapctl.geofenceselected === null) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            mapctl.addGeoFence(Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
        } else if (mapctl.editgeofencechecked && cartesian && mapctl.geofenceselected !== null) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            mapctl.addGeoFencePoint(mapctl.geofenceselected._id, Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
        }
    },
            Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    //Saves loaded map to IndexedDb with new name and updates map list
    mapctl.addMap = function (maplist, mapname) {
        if (typeof maplist[mapname] !== 'undefined') {
            DlgBx.alert('Duplicate Value .. Try Again');
        } else if (mapname.length !== 0) {
            console.log("Save " + mapname);
            DbService.dB.openStore("Maps", function (store) {
                store.insert({
                    name: mapname, data: stctl.currmapData
                });
            });
            mapctl.currmap = mapname;
            DbService.updateDbFile('Resources', 'maps.json', maplist, "/json/maps.json", $http);
            SocketService.createMap(mapname);
            mapctl.maptxt = "";
        }
    };
    mapctl.selectTrack = function (u, zoomto) {
        mapctl.trackselected = GeoService.sdatasources[mapctl.mapid].entities.getById(u._id);
        mapctl.loc = mapctl.getLoc(mapctl.trackselected);
        if (zoomto) {
            GeoService.sdatasources[mapctl.mapid].selectedEntity = mapctl.trackselected;
            viewer.selectedEntity = mapctl.trackselected;
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(mapctl.loc[1], mapctl.loc[0], 10000.0),
                duration: 1
            });
        } else {
            $scope.$apply();
        }
    };
    mapctl.selectGeoFence = function (u, zoomto) {
        //console.log("selectTrack");
        mapctl.geofenceselected = GeoService.sdatasources[mapctl.mapid].entities.getById(u._id);
        mapctl.loc = mapctl.getLoc(mapctl.geofenceselected);
        if (zoomto) {
            GeoService.sdatasources[mapctl.mapid].selectedEntity = mapctl.geofenceselected;
            viewer.selectedEntity = mapctl.geofenceselected;
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(mapctl.loc[1], mapctl.loc[0], 10000.0),
                duration: 1
            });
        } else {
            $scope.$apply();
        }
    };
    mapctl.selectPolygon = function (p, zoomto) {
        mapctl.polyselected = GeoService.sdatasources[mapctl.mapid].entities.getById(p._id);
        mapctl.polyselectedid = mapctl.polyselected._id;
        mapctl.loc = mapctl.getLoc(mapctl.polyselected);
        if (zoomto) {
            GeoService.sdatasources[mapctl.mapid].selectedEntity = mapctl.polyselected;
            viewer.selectedEntity = mapctl.polyselected;
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(mapctl.loc[1], mapctl.loc[0], 10000.0),
                duration: 1
            });
        } else {
            $scope.$apply();
        }
    };
    mapctl.getLoc = function (entity) {
        var cartesian = entity.position.getValue();
        var cartographic = ellipsoid.cartesianToCartographic(cartesian);
        var latitudeString = Cesium.Math.toDegrees(cartographic.latitude);
        var longitudeString = Cesium.Math.toDegrees(cartographic.longitude);
        entity.description = "Location: " + latitudeString + ", " + longitudeString;
        return ([latitudeString, longitudeString]);
    };
    mapctl.setLocation = function (entity, lat, lng) {
        if (typeof entity._id !== 'undefined') {
            GeoService.sdatasources[mapctl.mapid].entities.getById(entity._id).position = Cesium.Cartesian3.fromDegrees(lng, lat);
            DbService.updateEntityDb(mapctl.mapid, entity._id, '_location', lat + "," + lng);
            mapctl.selectTrack(entity);
        } else {
            mapctl.addTrack(lat, lng);
        }
    };
    mapctl.newTrack = function (mapid) {
        console.log('newTrack in' + mapid);
        mapctl.mapid = mapid;
        mapctl.editlocchecked = true;
        mapctl.trackselected = null;
    };
    mapctl.addTrack = function (lat, lng) {
        console.log("addTrack");
        DlgBx.prompt("No Track Selected .. Enter Name to Create Track", "").then(function (trackname) {
            var overwrite = null;
            for (n = 0; n < mapctl.tracks.length; n++) {
                if (trackname === mapctl.tracks[n]._name) {
                    overwrite = mapctl.tracks[n]._name;
                }
            }
            if (overwrite !== null) {
                DlgBx.alert("Track name exists");
            } else {
                console.log("Create track " + trackname);
                var trck = {
                    "_map": mapctl.mapid,
                    "_id": trackname + "_Track",
                    "_name": trackname,
                    "_type": "track",
                    "_location": [lat, lng]
                };
                mapctl.tracks.push(trck);
                mapctl.trackselected = trck;
                GeoService.addCesiumPoint(trck, 'BLUE');
                DbService.updateEntityDb(mapctl.mapid, trackname, '_location', lat + "," + lng);
                mapctl.selectTrack(trck, true);
            }
        });
    };
    mapctl.newGeofence = function (mapid) {
        console.log('new GeoFence in' + mapid);
        mapctl.mapid = mapid;
        mapctl.editgeofencechecked = true;
        mapctl.geofenceselected = null;
    };
    mapctl.addGeoFence = function (lat, lng) {
        console.log("addPolyline");
        DlgBx.prompt("No GeoFence Selected .. Enter Name to Create new GeoFence", "").then(function (geofencename) {
            var overwrite = null;
            for (n = 0; n < mapctl.geofences.length - 1; n++) {
                if (geofencename === mapctl.geofences[n]._name) {
                    overwrite = mapctl.geofences[n]._name;
                }
            }
            if (overwrite !== null) {
                DlgBx.alert("GeoFence name exists");
            } else {
                console.log("Create GeoFence " + geofencename);
                var geofnce = {
                    "_map": mapctl.mapid,
                    "_id": geofencename + "_GeoFence",
                    "_name": geofencename,
                    "_type": "geofence",
                    "_location": [lat, lng],
                    "_points": [lat, lng]
                };
                mapctl.geofences.push(geofnce);
                mapctl.geofenceselected = geofnce;
                GeoService.addCesiumPoint(geofnce, 'RED');
                DbService.updateEntityDb(mapctl.mapid, geofencename, '_geofence', lat + "," + lng);
                mapctl.selectGeoFence(geofnce, true);
            }
        });
    };
    mapctl.addGeoFencePoint = function (geofid, lat, lng) {
        console.log("addGeoFencePoint ");
        var len = mapctl.geofences[geofid]._points.length;
        var pt = [];
        pt._id = geofid + len;
        pt._points = [mapctl.geofences[geofid]._points[len - 2], mapctl.geofences[geofid]._points[len - 1]];
        pt._points.push(lat);
        pt._points.push(lng);
        pt._color = 'LIGHTYELLOW';
        console.log('addGeoFencePoint ' + pt._id);
        GeoService.addCesiumPolyline(pt);
        mapctl.geofences[geofid]._points.push(lat);
        mapctl.geofences[geofid]._points.push(lng);
        DbService.updateEntityDb(mapctl.mapid, geofid, '_geofence', mapctl.geofences[geofid]._points);
    };
    mapctl.removeGeoFencePoint = function () {
        var geofid = mapctl.geofenceselected._id;
        var len = mapctl.geofences[geofid]._points.length;
        if (len > 2) {
            var id = geofid + (len - 2);
            console.log('removeGeoFencePoint ' + id);
            GeoService.removeEntity(id);
            mapctl.geofences[geofid]._points.length = len - 2;
            DbService.updateEntityDb(mapctl.mapid, geofid, '_geofence', mapctl.geofences[geofid]._points);
        }
    };
    mapctl.removeAllGeoFencePoints = function (geofid) {
        var geofid = mapctl.geofenceselected._id;
        var len = mapctl.geofences[geofid]._points.length;
        if (len > 2) {
            for (i = 0; i < len; i += 2) {
                GeoService.removeEntity(geofid + i);
            }
            mapctl.geofences[geofid]._points.length = 2;
            DbService.updateEntityDb(mapctl.mapid, geofid, '_geofence', mapctl.geofences[geofid]._points);
        }
    };
    mapctl.showTrace = function (track) {
        console.log("showTrace");
        mapctl.showPP = true;
        GeoService.showTrace(track);
    };
    mapctl.selMapVw = function (m, mctl) {
        if (mapctl.mselected === m) {
            mctl.openTab(m);
        } else {
            console.log(m + " selected");
            mapctl.mselected = m;
            SocketService.setMapView(m, $scope);
        }
    };
    SocketService.socket.on('update mapviews', function (data) {
        console.log('update mapviews');
        mapctl.mapviews = data.mapviews;
        //console.log(usrctl.mapviews);
        DbService.updateRecord('User', 'mapviews', data.mapviews);
    });
    SocketService.socket.on('update networks', function (data) {
        console.log('update networks');
        mapctl.networks = data.networks;
        //console.log(usrctl.networks);
        DbService.updateRecord('User', 'networks', data.networks);
    });
    SocketService.socket.on('track connected', function (data) {
        console.log("Unit connected " + data.id);
        SocketService.setMap(mapctl.mapid, mapctl.map);
        //msgctl.messages.push({text: "Unit " + data.socketid + " connected"});
    });
    SocketService.socket.on('load mapview', function (data) {
        console.log('********* load mapview' + data.id+" "+data.mapview);
        SocketService.map_socket.on('publish msg', function (data) {
            console.log('msg published');
        });
    });
});
//messageCtl handles networks, and messaging
TacMap.controller('messageCtl', function ($scope, DbService, GeoService, SocketService) {
    var msgctl = this;
    msgctl.netadd = false;
    msgctl.maptxt = "";
    msgctl.nettxt = "";
    msgctl.netsel = "";
    msgctl.currnet = "";
    msgctl.addmap = false;
    msgctl.messages = [];
    msgctl.tracks = [];
    msgctl.networks = {};
    msgctl.addNet = function (mapid, networks, newnet) {
        if (typeof networks[mapid] !== 'undefined') {
            if (typeof networks[mapid][newnet] !== 'undefined') {
                DlgBx.alert('Duplicate Value .. Try Again');
            } else if (newnet.length !== 0) {
                SocketService.createNet(mapid, newnet);
                newnet = "";
            }
        } else if (newnet !== "") {
            SocketService.createNet(mapid, newnet);
            newnet = "";
        }
    };
    msgctl.joinNet = function (val) {
        if (msgctl.netsel[val]) {
            SocketService.joinNet(msgctl.user.endpoint.mapview, val);
        } else {
            SocketService.leaveNet(stctl.user.endpoint.mapview, val);
        }
    };
    msgctl.sendReport = function (msgobj) {
        //default ui
        SocketService.sendMessage(msgobj, msgobj.network);
    };
    msgctl.setPosition = function (uid, sentto, net, lat, lon) {
        console.log("moveUnit: " + uid);
        GeoService.sdatasources[mapctl.mapid].entities.getById(uid).position = Cesium.Cartesian3.fromDegrees(lon, lat);
        msgctl.sendReport({
            user: uid, to: sentto, time: new Date(), position: [lat, lon], network: net
        });
    };
});
//menuCtrl controls menus
TacMap.controller('menuCtrl', function () {
    var mctl = this;
    //initiate an array to hold all active tabs
    mctl.activeTabs = [];
    //check if the tab is active
    mctl.isOpenTab = function (tab) {
        //check if this tab is already in the activeTabs array
        if (mctl.activeTabs.indexOf(tab) > -1) {
            //if so, return true
            return true;
        } else {
            //if not, return false
            return false;
        }
    };
    //function to 'open' a tab
    mctl.openTab = function (tab) {
        //check if tab is already open
        if (mctl.isOpenTab(tab)) {
            //if it is, remove it from the activeTabs array
            mctl.activeTabs.splice(mctl.activeTabs.indexOf(tab), 1);
        } else {
            //if it's not, add it!
            mctl.activeTabs.push(tab);
        }
    };
    //function to leave a tab open if open or open if not
    mctl.leaveOpenTab = function (tab) {
        //check if tab is already open
        if (!mctl.isOpenTab(tab)) {
            //if it is not open, add to array
            mctl.activeTabs.push(tab);
        }
    };
});