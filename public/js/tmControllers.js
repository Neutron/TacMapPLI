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

TacMap.controller('viewCtl', function () {
    var vwctl = this;
    vwctl.msgLog = "views/msgLog.html";
    vwctl.mapStore = "views/mapStore.html";
    vwctl.userProfile = "views/userProfile.html";
    vwctl.mapviews = "views/mapViews.html";
    vwctl.mapentities = "views/mapEntities.html";
    vwctl.networks = "views/networks.html";
    //initiate an array to hold all active tabs
    vwctl.activeTabs = [];
    //check if the tab is active
    vwctl.isOpenTab = function (tab) {
        //check if this tab is already in the activeTabs array
        if (vwctl.activeTabs.indexOf(tab) > -1) {
            //if so, return true
            return true;
        } else {
            //if not, return false
            return false;
        }
    };
    //function to 'open' a tab
    vwctl.openTab = function (tab) {
        //check if tab is already open
        if (vwctl.isOpenTab(tab)) {
            //if it is, remove it from the activeTabs array
            vwctl.activeTabs.splice(vwctl.activeTabs.indexOf(tab), 1);
        } else {
            //if it's not, add it!
            vwctl.activeTabs.push(tab);
        }
    };
    //function to leave a tab open if open or open if not
    vwctl.leaveOpenTab = function (tab) {
        //check if tab is already open
        if (!vwctl.isOpenTab(tab)) {
            //if it is not open, add to array
            vwctl.activeTabs.push(tab);
        }
    };
});

TacMap.controller('userCtl', function ($scope, DbService, SocketService, DlgBx) {
    var usrctl = this;
    usrctl.endpoint = {};
    //UI Views
    usrctl.edituserid = "";
    usrctl.editmapviewid = "";
    usrctl.editnetworkid = "";
    usrctl.editprofile = false;

    usrctl.editProfile = function (ep) {
        usrctl.edituserid = ep.userid;
        usrctl.editmapviewid = ep.mapviewid;
        usrctl.editnetworkid = ep.networkid;
        usrctl.editprofile = true;
    };
    usrctl.cancelEdit = function () {
        usrctl.editprofile = false;
    };
    usrctl.saveProfile = function () {
        usrctl.endpoint.userid = usrctl.edituserid;
        //Update namespace if mapview name changed
        if (usrctl.endpoint.networkid !== usrctl.editnetworkid) {
            SocketService.deleteNet(usrctl.endpoint.mapviewid, usrctl.endpoint.networkid);
            SocketService.createNet(usrctl.editmapviewid, usrctl.editnetworkid);
            if (usrctl.endpoint.mapviewid !== usrctl.editmapviewid) {
                usrctl.endpoint.userid = usrctl.edituserid;
                usrctl.endpoint.mapviewid = usrctl.editmapviewid;
                usrctl.endpoint.networkid = usrctl.editnetworkid;
                //SocketService.changeMap(usrctl.endpoint.mapviewid);
                SocketService.initMapView(usrctl.endpoint);
                DbService.updateRecord('User', 'user', usrctl.endpoint);
            }
        } else if (usrctl.endpoint.mapviewid !== usrctl.editmapviewid) {
            usrctl.endpoint.userid = usrctl.edituserid;
            usrctl.endpoint.mapviewid = usrctl.editmapviewid;
            usrctl.endpoint.networkid = usrctl.editnetworkid;
            //SocketService.changeMap(usrctl.endpoint.mapviewid);
            SocketService.initMapView(usrctl.endpoint);
            DbService.updateRecord('User', 'user', usrctl.endpoint);
        } else {
            usrctl.endpoint.userid = usrctl.edituserid;
            usrctl.endpoint.mapviewid = usrctl.editmapviewid;
            usrctl.endpoint.networkid = usrctl.editnetworkid;
            DbService.updateRecord('User', 'user', usrctl.endpoint);
        }
        usrctl.editprofile = false;
    };
    usrctl.registerEndpoint = function (data) {
        DbService.getRecord('User', 'user', function (usr) {
            // console.log(usr);
            if (usr === null) {
                DlgBx.prompt("New User: ", "Enter User Name: ", data["socketid"].substring(4, 10)).then(function (uname) {
                    usrctl.endpoint.socketid = $scope.socketID;
                    usrctl.endpoint.userid = uname;
                    usrctl.endpoint.networkid = uname + '-Net';
                    usrctl.endpoint.mapviewid = uname + '-Map';
                    DbService.addRecord('User', "user", usrctl.endpoint);
                    console.log('User registered');
                    //console.log(usrctl.endpoint.mapview.viewdata);
                    //Initialize namespace for current mapview.
                    SocketService.initMapView(usrctl.endpoint);
                });
            } else {
                usrctl.endpoint = usr.data;
                usrctl.endpoint.socketid = $scope.socketID;
                SocketService.initMapView(usrctl.endpoint);
            }
        });
    };
    //Sorts list by key name 
    usrctl.sortByKey = function (array, key) {
        return array.sort(function (a, b) {
            var x = a[key];
            var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    };
    SocketService.socket.on('load mapview', function (data) {
        // console.log(data);
        usrctl.endpoint = data;
    });
    SocketService.socket.on('connection', function (data) {
        $scope.socketID = data.socketid;
        console.log('user connect ' + $scope.socketID);
        usrctl.registerEndpoint(data);
    });
    SocketService.socket.on('update endpointlist', function (data) {
        console.log('update endpointlist');
        //console.log(usrctl.endpoints);
        DbService.updateRecord('User', 'endpoints', data.endpointlist);
    });
});

//mapCtl handles creation, editing and display of Map Views
//Map Views contain polygons, tracks, geofences, etc.
TacMap.controller('mapCtl', function ($scope, DbService, GeoService, SocketService, DlgBx, $http) {
    var mapctl = this;
    var ellipsoid = scene.globe.ellipsoid;
    mapctl.currentMap = 'Default Map';
    mapctl.currmapData = [];
    mapctl.maplist = [{name: "Default Map"}];
    mapctl.trackselected = null;
    mapctl.geofenceselected = null;
    mapctl.mapurl = "";
    mapctl.editgeofencechecked = false;
    mapctl.editlocchecked = false;
    mapctl.import = false;
    mapctl.polygons = [];
    mapctl.entities = [];
    mapctl.tracks = [];
    mapctl.geofences = [];
    mapctl.maps = [];
    mapctl.geofencelist = [];
    mapctl.loc = [];
    mapctl.mapid = "";
    mapctl.network = "";
    mapctl.report_to = "";
    mapctl.mousepos = {};
    //*******************************************//

    mapctl.exportMapView = function () {
        console.log("exportMapView");
        DlgBx.prompt("Enter Export Save As Name:", mapctl.currentMap).then(function (newname) {
            if (newname === 'Default Map') {
                DlgBx.alert("You Can't' Overwrite the Default Map");
            } else {
                var overwrite = null;
                for (n = 0; n < mapctl.maplist.length; n++) {
                    if (newname === mapctl.maplist[n].map) {
                        overwrite = mapctl.maplist[n].map;
                    }
                }
                if (overwrite !== null) {
                    DlgBx.confirm("Warning", "This Action will Overwrite Map", overwrite).then(function (yes) {
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
                        store.find(mapctl.currentMap).then(function (scen) {
                            var map = scen.data;
                            $http.post("/json/" + newname.replace(' ', '') + '.json', map).success(function () {
                                console.log("Saved " + newname + " to /json/" + newname.replace(' ', '') + ".json");
                                mapctl.maplist.push({
                                    name: newname
                                });
                                DbService.updateDbFile('Resources', 'maps.json', mapctl.maplist, "/json/maps.json", $http);
                            });
                        });
                    });
                }
            }
            mapctl.import = false;
        });
    };
    //Get map data file from node.js server and save to indexedDB
    mapctl.getMapFile = function (savedmap) {
        console.log("Get File: " + savedmap.name + ", " + savedmap.url);
        $http.get(savedmap.url).success(function (sdata) {
            DlgBx.prompt("Enter Save As Name or Overwrite", savedmap.name).then(function (newname) {
                if (newname === "Default Map") {
                    DlgBx.alert("You Can't' Overwrite the Default Map");
                } else {
                    var overwrite = null;
                    var overwriteid = null;
                    for (i = 0; i < mapctl.maplist.length; i++) {
                        if (newname === mapctl.maplist[i].value) {
                            overwrite = mapctl.maplist[i].value;
                            console.log(overwrite);
                            overwriteid = mapctl.maplist[i].value;
                            break;
                        }
                    }
                    if (overwrite !== null) {
                        console.log(overwrite);
                        DlgBx.confirm("Warning", "This Action will Overwrite Map " + overwrite).then(function (yes) {
                            if (yes) {
                                mapctl.currmapData = sdata;
                                mapctl.overwriteMapView(overwrite);
                            }
                        });
                    } else {
                        console.log("Save " + newname);
                        mapctl.currmapData = sdata;
                        DbService.dB.openStore("Maps", function (store) {
                            store.insert({
                                name: newname, data: sdata
                            }).then(function () {
                                mapctl.maplist.push({
                                    name: newname
                                });
                                mapctl.currentMap = newname;
                                mapctl.loadMapView(savedmap.name);
                            });
                        });
                    }
                }
            });
        });
    };
    //Saves changes to loaded map to indexedDB
    mapctl.updateMapView = function (mapdata) {
        DbService.dB.openStore("Maps", function (store) {
            store.upsert({
                name: mapctl.currentMap, data: mapdata
            });
        });
    };
    mapctl.overwriteMapView = function (mapid) {
        console.log("overwriteMapView: " + mapid);
        DbService.dB.openStore("Maps", function (store) {
            store.find(mapid).then(function () {
                store[ "delete"](mapid).then(function () {
                    DbService.dB.openStore("Maps", function (store) {
                        store.insert({
                            name: mapid, data: mapctl.currmapData
                        });
                    });
                });
            });
        });
    };
    mapctl.deleteMapView = function (currentmap) {
        if (mapctl.currentMap === 'Default Map') {
            DlgBx.alert("Can't delete Default Map");
        } else {
            DlgBx.confirm("Warning", "Confirm deletion of Map: " + currentmap.name).then(function (yes) {
                console.log("Confirm response: " + mapctl.currentMap);
                if (yes && mapctl.currentMap !== 'Default Map') {
                    console.log("Delete from Idb: " + currentmap.name);
                    DbService.dB.openStore("Maps", function (store) {
                        store[ "delete"](currentmap.name);
                    });
                    var na = [];
                    for (i = 0; i < mapctl.maplist.length; i++) {
                        if (mapctl.maplist[i].name !== currentmap.name) {
                            na.push(mapctl.maplist[i]);
                        }
                    }
                    mapctl.maplist = na;
                    mapctl.loadMapView(mapctl.maplist[0]);
                    DbService.updateDbFile('Resources', 'maps.json', mapctl.maplist, "/json/maps.json", $http);
                }
            });
        }
    };
    //Saves current map to IndexedDB and node.js server with new name ensuring no duplicate name
    mapctl.saveMapView = function (currentmap) {
        console.log("saveMapView");
        DlgBx.prompt("Enter Save As Name or Overwrite", currentmap.name).then(function (newname) {
            var overwrite = null;
            for (n = 0; n < mapctl.maplist.length; n++) {
                if (newname === mapctl.maplist[n].name) {
                    overwrite = mapctl.maplist[n].name;
                }
            }
            if (overwrite !== null) {
                DlgBx.confirm("Warning", "This Action will Overwrite Map", overwrite).then(function (yes) {
                    if (yes) {
                        console.log("Save " + overwrite);
                        mapctl.overwriteMapView(overwrite);
                        mapctl.currentMap = currentmap;
                        mapctl.loadMapView(overwrite);
                    }
                });
            } else {
                console.log("Save " + newname);
                mapctl.copyMapView(mapctl.currentMap, newname);
                mapctl.currentMap = newname;
                mapctl.maplist.push({
                    name: newname
                });
                //mapctl.loadMapView(mapctl.currentMap);
                DbService.updateDbFile('Resources', 'maps.json', mapctl.maplist, "/json/maps.json", $http);
            }
        });
    };
    //Copies current map assuming name already deconflicted
    mapctl.copyMapView = function (currentmap, newmapid) {
        console.log("Copy " + currentmap + " to " + newmapid);
        DbService.dB.openStore("Maps", function (store) {
            store.find(currentmap).then(function (map) {
                var u = map.url;
                //console.log(u);
                var newurl = u.substring(u.lastIndexOf('/') + 1) + newmapid;
                DbService.dB.openStore("Maps", function (store) {
                    store.insert({
                        name: newmapid, url: newurl, data: map.data
                    });
                });
            });
        });
    };
    //Loads map data from IndexedDB and calls GeoService to initialize Cesium View
    mapctl.loadMapView = function (mapname) {
        console.log("loadMapView " + mapname);
        viewer.dataSources.remove(GeoService.sdatasources[mapctl.currentMap]);
        DbService.dB.openStore("Maps", function (store) {
            store.find(mapname).then(function (sc) {
                if (typeof sc.data !== 'undefined') {
                    mapctl.currmapData = sc.data;
                    DbService.setUserMapData(mapctl.currentMap, mapctl.currmapData, function (mdta) {
                        mapctl.mapname = mdta.name;
                        GeoService.initGeodesy(mapctl.mapname, mdta.data);
                    });
                }
            });
        });
        mapctl.currentMap = mapname;
    };
    //Loads XML defined maps from node.js server, checks if indexedDB storage is current and
    //updates if necessary
    mapctl.initUserMapView = function (mapid) {
        console.log("initUserMapView");
        mapctl.currentMap = mapid;
        DbService.getUserMapData(mapctl.currentMap, function (umapdata) {
            if (umapdata === null) {
                mapctl.loadDefaultMap(mapctl.currentMap);
            } else {
                //console.log(umapdata);
                mapctl.currmapData = umapdata.data;
                mapctl.tracks = mapctl.currmapData.Map.Tracks.Track;
                mapctl.geofences = mapctl.currmapData.Map.GeoFences.GeoFence;
                GeoService.initGeodesy(mapctl.currentMap, mapctl.currmapData);
            }
        });
    };
    //
    mapctl.loadDefaultMap = function () {
        console.log("loadDefaultMap");
        DbService.dB.openStore('Resources', function (mstore) {
            mstore.getAllKeys().then(function (keys) {
                if (keys.indexOf('maps.json') === -1) {
                    $http.get('xml/maps.xml').success(function (resdata, status, headers) {
                        var maps = DbService.xj.xml_str2json(resdata);
                        for (i = 0; i < maps.Maps.Map.length; i++) {
                            var u = maps.Maps.Map[i]._url;
                            mapctl.mapurl = u;
                            var n = maps.Maps.Map[i]._name;
                            if (u.substring(u.indexOf('.')) === '.xml') {
                                mapctl.syncResource(maps.Maps.Map[i]._url, function (jdata) {
                                    mapctl.currmapData = jdata;
                                    DbService.setUserMapData(mapctl.currentMap, mapctl.currmapData, function (mdta) {
                                        if (jdata.Map._name !== 'Default Map') {
                                            mapctl.maplist.push({
                                                name: jdata.Map._name
                                            });
                                        }
                                        if (jdata.Map._name === 'Default Map') {
                                            //console.log('init geo');
                                            mapctl.tracks = mapctl.currmapData.Map.Tracks.Track;
                                            mapctl.geofences = mapctl.currmapData.Map.GeoFences.GeoFence;
                                            GeoService.initGeodesy(mdta.name, mdta.data);
                                        }
                                    });
                                });
                            } else {
                                $http.get(u).success(function (jsondata, status, headers) {
                                    var jsmod = headers()[ 'last-modified'];
                                    mapctl.currmapData = jsondata;
                                    mapctl.dB.openStore('Maps', function (mstore) {
                                        mstore.upsert({
                                            name: n, url: u, lastmod: jsmod, data: jsondata
                                        });
                                        $http.post("/json/maps.json", angular.toJson(mapctl.sortByKey(mapctl.maplist, 'id')));
                                        DbService.setUserMapData(mapctl.currentMap, mapctl.currmapData);
                                        mapctl.tracks = mapctl.currmapData.Map.Tracks.Track;
                                        mapctl.geofences = mapctl.currmapData.Map.GeoFences.GeoFence;
                                    });
                                });
                            }
                        }
                    });
                } else {
                    mstore.find('maps.json').then(function (dbrec) {
                        mapctl.maplist = dbrec.data;
                        mapctl.loadMapView('Default Map');
                    });
                }
            });
        });
    };
    //
    mapctl.loadUserMap = function () {
        DbService.getUser(function (udata) {
            if (typeof (udata) !== 'undefined') {
                mapctl.currentMap = udata._mapviewid;
                mapctl.getMapData(mapctl.currentMap, function (umapdta) {
                    mapctl.currmapData = umapdta;
                    GeoService.initGeodesy(mapctl.currentMap, mapctl.currmapData);
                });
            }
        });
    };

    //
    //Compares last modified dates between server file and indexedDb file
    //updates indexeDB and passes current data to callback function
    mapctl.syncResource = function (url, callback) {
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
    //Deletes data stores in Browser IndexedDB
    mapctl.clearDb = function () {
        console.log("Clear DB");
        DlgBx.prompt("Warning", "Confirm Deletion of Local Data").then(function () {
            viewer.dataSources.remove(GeoService.sdatasources[mapctl.currentMap]);
            viewer.dataSources.remove(GeoService.ppdatasources[mapctl.currentMap]);
            DbService.dB.openStore('Resources', function (store) {
                store.clear();
            });
            DbService.dB.openStore('Map', function (store) {
                store.clear();
            });
        });
    };
    //*******************************************//
    mapctl.lftClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    mapctl.lftClickHandler.setInputAction(function (mouse) {
        mapctl.mousepos = mouse.position;
        var pickedObject = scene.pick(mouse.position);
        if (mapctl.editgeofencechecked && mapctl.geofenceselected !== null) {
            var gf = mapctl.geofences[mapctl.mapview][mapctl.geofenceselected._id];
            mapctl.addGeoFencePoint(mapctl.geofenceselected._id, gf._location[0], gf._location[1]);
            mapctl.editgeofencechecked = false;
            mapctl.geofenceselected = null;
            // console.log(mapctl.geofences[mapctl.mapview]);
        }
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
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
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
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    //Saves loaded map to IndexedDb with new name and updates map list
    mapctl.selectTrack = function (unit, zoomto) {
        mapctl.mapid = GeoService.mapid;
        mapctl.trackselected = GeoService.sdatasources[mapctl.mapid].entities.getById(unit._id);
        //console.log(mapctl.trackselected);
        //DlgBx.alert("Track Selected");
        mapctl.loc = mapctl.getLoc(mapctl.trackselected);
        if (zoomto) {
            GeoService.sdatasources[GeoService.mapid].selectedEntity = mapctl.trackselected;
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
        mapctl.mapid = GeoService.mapid;
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
        mapctl.mapid = GeoService.mapid;
        if (typeof entity._id !== 'undefined') {
            GeoService.sdatasources[mapctl.mapid].entities.getById(entity._id).position = Cesium.Cartesian3.fromDegrees(lng, lat);
            DbService.updateTrackDb(mapctl.mapid, entity._id, '_location', lat + "," + lng, function (mdata) {
                console.log("publish view");
                SocketService.publishView(mdata.name, mdata.data);
                //mapctl.selectTrack(entity);
            });

        } else {
            mapctl.addTrack(lat, lng);
        }
    };
    mapctl.newTrack = function (mapid, network, report_to) {
        console.log('newTrack in ' + mapid);
        mapctl.network = network;
        mapctl.report_to = report_to;
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
                console.log(mapctl.currmapData);
                var trck = {
                    "_icon": "img/tacicon.png",
                    "_id": trackname + "_Track",
                    "_location": [lat, lng],
                    "_name": trackname,
                    "_map": mapctl.mapid,
                    "_network": mapctl.network,
                    "_report_to": mapctl.report_to,
                    "_height": 25,
                    "_width": 25
                };
                mapctl.tracks.push(trck);
                mapctl.trackselected = trck;
                GeoService.addCesiumBillboard(trck);
                //GeoService.addCesiumPoint(trck, 'BLUE');
                //mapctl.currmapData.Map.Tracks.Track.push(trck);
                //mapctl.currmapData.Map.Tracks[mapctl.currmapData.Map.Tracks.Track.length+1]=trck;
                mapctl.currmapData.Map.Tracks.Track = mapctl.tracks;
                DbService.setUserMapData(mapctl.currentMap, mapctl.currmapData, function () {
                    mapctl.selectTrack(trck, true);
                });
            }
        });
    };
    mapctl.newGeofence = function (mapid) {
        console.log('new GeoFence in ' + mapid);
        mapctl.mapview = mapid;
        mapctl.editgeofencechecked = true;
        mapctl.geofenceselected = null;
    };
    mapctl.addGeoFence = function (lat, lng) {
        console.log("addGeoFence");
        mapctl.mapid = GeoService.mapid;
        if (typeof mapctl.geofences === 'undefined') {
            mapctl.geofences = [];
        }
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
                    "_id": geofencename + "_GeoFence",
                    "_name": geofencename,
                    "_map": mapctl.mapview,
                    "_location": [lat, lng],
                    "_points": [lat, lng]
                };
                //mapctl.geofences.push(geofnce);
                //mapctl.geofences.push(geofnce);
                //mapctl.geofencelist.push(geofnce);
                mapctl.geofenceselected = geofnce;
                GeoService.addCesiumPoint(geofnce, 'RED');
                mapctl.currmapData.Map.GeoFences.push(geofnce);
                DbService.updateMapViewFile(mapctl.currentMap, mapctl.currentData, mapctl.mapurl);
                mapctl.selectGeoFence(geofnce, true);
            }
        });
    };
    mapctl.addGeoFencePoint = function (geofid, lat, lng) {
        console.log("addGeoFencePoint " + geofid);
        //console.log(mapctl.geofences[mapctl.mapview][geofid]);
        var len = mapctl.geofences[mapctl.mapview][geofid]['_points'].length;
        var pt = [];
        pt._id = geofid + len;
        pt._points = [mapctl.geofences[mapctl.mapview][geofid]._points[len - 2], mapctl.geofences[mapctl.mapview][geofid]._points[len - 1]];
        pt._points.push(lat);
        pt._points.push(lng);
        pt._color = 'LIGHTYELLOW';
        // console.log('addGeoFencePoint ' + pt._id);
        GeoService.addCesiumPolyline(pt);
        mapctl.geofences[mapctl.mapview][geofid]._points.push(lat);
        mapctl.geofences[mapctl.mapview][geofid]._points.push(lng);
        DbService.updateEntityDb(mapctl.currentMap, geofid, '_geofence', mapctl.geofences[mapctl.mapview][geofid]._points);
    };
    mapctl.removeGeoFencePoint = function () {
        mapctl.mapid = GeoService.mapid;
        var geofid = mapctl.geofenceselected._id;
        var len = mapctl.geofences[mapctl.mapview][geofid]._points.length;
        if (len > 2) {
            var id = geofid + (len - 2);
            console.log('removeGeoFencePoint ' + id);
            GeoService.removeEntity(id);
            mapctl.geofences[mapctl.mapview][geofid]._points.length = len - 2;
            DbService.updateEntityDb(mapctl.currentMap, geofid, '_geofence', mapctl.geofences[mapctl.mapview][geofid]._points);
        }
    };
    mapctl.removeAllGeoFencePoints = function (geofid) {
        mapctl.mapid = GeoService.mapid;
        var geofid = mapctl.geofenceselected._id;
        var len = mapctl.geofences[mapctl.mapview][geofid]._points.length;
        if (len > 2) {
            for (i = 0; i < len; i += 2) {
                GeoService.removeEntity(geofid + i);
            }
            mapctl.geofences[geofid]._points.length = 2;
            DbService.updateEntityDb(mapctl.currentMap, geofid, '_geofence', mapctl.geofences[mapctl.mapview][geofid]._points);
        }
    };
    //
    mapctl.showTrace = function (track) {
        console.log("showTrace");
        mapctl.showPP = true;
        GeoService.showTrace(track);
    };
    mapctl.selMapVw = function (m, vwctl) {
        mapctl.mapview = m;
        if (mapctl.mselected === m) {
            vwctl.openTab(m);
        } else {
            console.log(m + " selected");
            mapctl.mselected = m;
            if (m !== mapctl.currentMap) {
                mapctl.initUserMapView(m, function () {
                    SocketService.setMapView(m);
                })
            }
        }
    };
    mapctl.mapSelected = function (m) {
        return mapctl.mselected === m;
    };
    //
    mapctl.getMapData = function (callback) {
        DbService.getUserMapData(mapctl.currentMap, function (umapdta) {
            if (typeof (umapdta) === 'undefined') {
                DbService.setUserMapData(mapctl.currentMap, mapctl.currmapData, callback);
            } else {
                mapctl.currmapData = umapdta;
                DbService.setUserMapData(mapctl.currentMap, umapdta, callback);
            }
        });
    };
    //
//    SocketService.socket.on('connection', function () {
//        mapctl.initMapView();
//    });
    SocketService.socket.on('load mapview', function (endpoint) {
        mapctl.ep = endpoint;
        mapctl.initUserMapView(endpoint.mapviewid);
    });
    SocketService.socket.on('update view', function (vwdata) {
        console.log('update view');
        DbService.setUserMapData(vwdata.mapviewid, vwdata.viewdata, function (mapdata) {
            if (mapctl.currentMap === mapdata.name) {
                GeoService.updateView(mapdata.name, mapdata.data);
            }
        });
    });
    SocketService.socket.on('update mapviewlist', function (data) {
        console.log('update mapviewlist');
        mapctl.mapviews = data.mapviewlist;
        console.log(mapctl.mapviews);
        DbService.updateRecord('User', 'mapviews', data.mapviewlist);
    });
    SocketService.socket.on('track connected', function (data) {
        console.log("Unit connected " + data.id);
        SocketService.setMap(mapctl.mapid, mapctl.map);
        //msgctl.messages.push({text: "Unit " + data.socketid + " connected"});
    });
//    SocketService.socket.on('load mapview', function (data) {
//        console.log('********* load mapview' + data.socketid + " " + data.mapviewid);
//        //mapctl.loadUserMap();
//        SocketService.map_socket.on('publish msg', function (data) {
//            console.log('msg published');
//        });
//    });
});
//netCtl handles networks
TacMap.controller('netCtl', function (DbService, SocketService, DlgBx, $http) {
    var netctl = this;
    netctl.netadd = false;
    netctl.nettxt = "";
    netctl.netsel = "";
    netctl.currnet = "";
    netctl.addNet = function (netlist, netname, mapdata) {
        if (typeof netlist[netname] !== 'undefined') {
            DlgBx.alert('Duplicate Value .. Try Again');
        } else if (netname.length !== 0) {
            console.log("Save " + netname);
            DbService.dB.openStore("Nets", function (store) {
                store.insert({
                    name: netname, data: netctl.currmapData
                });
            });
            netctl.currnet = netname;
            DbService.updateDbFile('Resources', 'nets.json', netlist, "/json/nets.json", $http);
            SocketService.createMapView(netname, mapdata);
        }
    };
    SocketService.socket.on('update networklist', function (data) {
        console.log('update networklist');
        netctl.networks = data.networklist;
        //console.log(usrctl.networks);
        DbService.updateRecord('User', 'networks', data.networklist);
    });
});
//messageCtl handles messages
TacMap.controller('messageCtl', function (GeoService, SocketService) {
    var msgctl = this;
    msgctl.maptxt = "";
    msgctl.addmap = false;
    msgctl.messages = [];
    msgctl.tracks = [];

    msgctl.sendReport = function (msgobj) {
        //default ui
        SocketService.sendMessage(msgobj, msgobj.network);
    };
    msgctl.setPosition = function (mapid, uid, sentto, net, lat, lon) {
        console.log("moveUnit: " + uid);
        GeoService.sdatasources[mapid].entities.getById(uid).position = Cesium.Cartesian3.fromDegrees(lon, lat);
        msgctl.sendReport({
            user: uid, to: sentto, time: new Date(), position: [lat, lon], network: net
        });
    };
});




