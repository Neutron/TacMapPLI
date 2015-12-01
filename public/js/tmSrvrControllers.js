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
/* global resources, TacMapServer, Cesium, scene, angular, stctl, viewer, usrctl */
// ***** SERVER CONTROLLERS ******//
TacMapServer.controller('storeCtl', function ($scope, $http, DbService, GeoService, MsgService, DlgBx) {
    var stctl = this;
    stctl.maplist = [{
            id: 0, name: 'Default Map', url: 'json/defaultmap.json'
        }];
    $scope.selmap = stctl.maplist[0];
    stctl.mapview = [];
    stctl.newnet = "";
    stctl.map = [];
    stctl.newmap = [];
    stctl.currmap = [];
    stctl.networks = [];
    stctl.publishmap = false;
    stctl.msgLog = "views/msgLog.html";
    stctl.planMaps = "views/planMaps.html";
    stctl.userProfile = "views/userProfile.html";
    stctl.clearDb = function () {
        console.log("Clear DB");
        DlgBx.confirm("Confirm Deletion of Local Data").then(function () {
            viewer.dataSources.remove(GeoService.sdatasources[$scope.selmap.name]);
            viewer.dataSources.remove(GeoService.ppdatasources[$scope.selmap.name]);
            DbService.dB.openStore('Resources', function (store) {
                store.clear();
            });
            DbService.dB.openStore('Map', function (store) {
                store.clear();
            });
        });
    };
    stctl.exportMap = function () {
        console.log("exportMap");
        DlgBx.prompt("Enter Export Save As Name:", $scope.selmap.name).then(function (newname) {
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
                        store.find($scope.selmap.name).then(function (scen) {
                            var map = scen.data;
                            $http.post("/json/" + newname.replace(' ', '') + '.json', map).success(function () {
                                console.log("Saved " + newname + " to /json/" + newname.replace(' ', '') + ".json");
                                stctl.maplist.push({
                                    id: stctl.maplist.length, name: newname.replace(' ', ''), url: "/json/" + newname.replace(' ', '') + ".json"
                                });
                                DbService.updateDbFile('Resources', 'maps.json', stctl.maplist, "/json/maps.json", $http);
//                                DbService.dB.openStore('Resources', function (store) {
//                                    store.upsert({
//                                        name: "maps.json", url: "/json/maps.json", data: stctl.maplist
//                                    }).then(function () {
//                                        store.find("maps.json").then(function (st) {
//                                            $http.put('/json/maps.json', st.data);
//                                        });
//                                    });
//                                });
                            });
                        });
                    });
                }
            }
            stctl.import = false;
        });
    };
    stctl.importMap = function () {
        stctl.import = true;
    };
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
                                stctl.map = sdata;
                                stctl.overwriteMap(overwrite);
                            }
                        });
                    } else {
                        console.log("Save " + newname);
                        stctl.map = sdata;
                        DbService.dB.openStore("Maps", function (store) {
                            store.insert({
                                name: newname, data: sdata
                            }).then(function () {
                                stctl.maplist.push({
                                    id: stctl.maplist.length, name: newname
                                });
                                stctl.currmap = {
                                    id: stctl.maplist.length - 1, name: newname
                                };
                                stctl.loadMap(savedmap);
                            });
                        });
                    }
                }
            });
        });
    };
    stctl.updateMap = function () {
        DbService.dB.openStore("Maps", function (store) {
            store.upsert({
                name: $scope.selmap.name, data: mapctl.map
            });
        });
    };
    stctl.copyMap = function (currentmap, newmapid) {
        DbService.dB.openStore("Maps", function (store) {
            store.find(currentmap).then(function (map) {
                store.insert({
                    name: newmapid, url: map.url, data: map.data
                });
            });
        });
    };
    stctl.overwriteMap = function (mapid) {
        console.log("overwriteMap: " + mapid);
        DbService.dB.openStore("Maps", function (store) {
            store.find(mapid).then(function () {
                store[ "delete"](mapid).then(function () {
                    store.insert({
                        name: mapid, data: stctl.map
                    });
                });
            });
        });
    };
    stctl.deleteMap = function (currentmap) {
        if ($scope.selmap.id === 0) {
            DlgBx.alert("Can't delete Default Map");
        } else {
            DlgBx.confirm("Confirm deletion of Map: " + currentmap.name).then(function (yes) {
                console.log("Confirm response: " + $scope.selmap.id);
                if (yes && $scope.selmap.id !== 0) {
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
    stctl.saveMap = function (currentmap) {
        console.log("saveMap");
        DlgBx.prompt("Enter Save As Name or Overwrite", currentmap.name).then(function (newname) {
            var overwrite = null;
            var overwriteid = null;
            for (n = 0; n < stctl.maplist.length; n++) {
                if (newname === stctl.maplist[n].name) {
                    overwrite = stctl.maplist[n].name;
                    overwriteid = stctl.maplist[n].name;
                }
            }
            if (overwrite !== null) {
                DlgBx.confirm("This Action will Overwrite Map", overwrite).then(function (yes) {
                    if (yes) {
                        console.log("Save " + overwrite);
                        stctl.overwriteMap(overwrite);
                        stctl.currmap = currentmap;
                        stctl.loadMap({
                            id: overwriteid, name: overwrite
                        });
                    }
                });
            } else {
                console.log("Save " + newname);
                stctl.copyMap($scope.selmap.name, newname);
                stctl.maplist.push({
                    id: stctl.maplist.length, name: newname, url: '/json/' + newname + '.json"'
                });
                stctl.currmap = currentmap;
                stctl.loadMap(stctl.maplist[stctl.maplist.length - 1]);
                DbService.updateDbFile('Resources', 'maps.json', stctl.maplist, "/json/maps.json", $http);
            }
        });
    };
    stctl.loadMap = function (nextmap) {
        console.log("loadMap " + nextmap.name);
        //console.log("Current Map:" + stctl.currmap.value);
        $scope.netselected = [];
        viewer.dataSources.remove(GeoService.sdatasources[$scope.selmap.name]);
        console.log();
        DbService.dB.openStore("Maps", function (store) {
            store.find(nextmap.name).then(function (sc) {
                GeoService.initGeodesy($scope, nextmap.name, sc.data);
                stctl.currmap = nextmap;
                MsgService.setMap(nextmap.name, sc.data);
            });
        });
        $scope.selmap = nextmap;
    };
    stctl.addFile = function (map, filename, data) {
        $http.post("/json/" + filename, data).success(function () {
            console.log("Saved " + map + " to /json/" + filename + ".json");
            stctl.maplist.push({
                id: stctl.maplist.length - 1, name: filename, url: "/json/" + filename
            });
            DbService.dB.openStore('Resources', function (store) {
                store.upsert({
                    name: "maps.json", url: resources[1], data: stctl.maplist
                }).then(function () {
                    $http.post("/json/maps.json", stctl.maplist).success(
                            function () {
                                console.log("Updated File List");
                            });
                });
            });
        });
    };
    stctl.overwriteFile = function (map, filename, data) {
        $http.post("/json/" + filename, data).success(function () {
            console.log("Saved " + map + " to /json/" + filename + ".json");
        });
    };
    stctl.sortByKey = function (array, key) {
        return array.sort(function (a, b) {
            var x = a[key];
            var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    };
    stctl.saveMapView = function (viewname) {
        var camera = $scope.viewer.scene.camera;
        var viewdata = {
            position: camera.position.clone(),
            direction: camera.direction.clone(),
            up: camera.up.clone(),
            right: camera.right.clone(),
            transform: camera.transform.clone(),
            frustum: camera.frustum.clone()
        };
        DbService.dB.openStore('Maps', function (mstore) {
            console.log("Save Map View: " + viewname);
            mstore.upsert({
                name: viewname, data: viewdata
            });
        });
    };
    MsgService.socket.on('new connection', function (data) {
        console.log('new connection: ' + data.id);
        DbService.initMaps($scope, $http, stctl, GeoService);
    });
});
TacMapServer.controller('userCtl', function ($scope, DbService, MsgService, DlgBx) {
    var usrctl = this;
//    $scope.user = [];
//    $scope.user.id = $scope.socketID;
//    $scope.user.name = 'User';
//    $scope.user.mapview = $scope.user.name + '-Map';
//    $scope.user.network = $scope.user.name + '-Net';
    usrctl.usernames = [];
    usrctl.editprofile = false;
    usrctl.saveUserData = function () {
        DbService.dB.openStore('User', function (mstore) {
            console.log("Save User Data: " + usrctl.user.name);
            mstore.upsert({
                name: usrctl.user.name, data: usrctl.user
            });
        });
    };
    usrctl.loadUserData = function () {
        DbService.dB.openStore('User', function (mstore) {
            console.log("Load User Data: " + $scope.user.name);
            mstore.find($scope.user.name).then(function (dbres) {
                $scope.user = dbres.data;
                $scope.user.id = $scope.socketID;
            });
        });
    };
    usrctl.publishUserData = function () {
        MsgService.publishEntity(usrctl.user);
    };
    MsgService.socket.on('connection', function (data) {
        $scope.socketID = data.socketid;
        console.log('connection ' + $scope.socketID);
        DbService.getUsers(function (ulist) {
            usrctl.usernames=ulist;
            usrctl.registerUser(data,ulist);
        });
    });
    usrctl.registerUser = function (data,ulist) {
        DlgBx.prompt("Enter User Name: ", '').then(function (uname) {
            if (ulist.indexOf(uname) === -1) {
                DbService.initUser($scope, uname, function (usr) {
                    MsgService.connectEndpoint(data, $scope.selmap.name, usr);
                });
            } else {
                DlgBx.alert("Name In Use").then(function () {
                    usrctl.registerUser(data,ulist);
                });
            }
        });
    };
});
TacMapServer.controller('mapCtl', function ($scope, DbService, GeoService, MsgService, DlgBx) {
    var mapctl = this;
    var ellipsoid = scene.globe.ellipsoid;
    mapctl.trackselected = null;
    mapctl.geofenceselected = null;
    mapctl.currmap = [];
    mapctl.editgeofencechecked = false;
    mapctl.editlocchecked = false;
    mapctl.import = false;
    //
    mapctl.maps = [];
    mapctl.entities = [];
    mapctl.tracks = [];
    mapctl.geofences = [];
    mapctl.loc = [];
    //
    mapctl.lftClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    mapctl.lftClickHandler.setInputAction(function (mouse) {
        var pickedObject = scene.pick(mouse.position);
        if (typeof pickedObject !== 'undefined') {
            if (Cesium.defined(pickedObject) && pickedObject.id.billboard || pickedObject.id.ellipsoid || pickedObject.id.point) {
                mapctl.selectTrack(pickedObject.id);
            } else {
                mapctl.trackselected = null;
                mapctl.geofenceselected = null;
                mapctl.loc = [];
                $scope.$apply();
            }
        } else {
            mapctl.trackselected = null;
            mapctl.geofenceselected = null;
            mapctl.loc = [];
            $scope.$apply();
        }
    },
            Cesium.ScreenSpaceEventType.LEFT_CLICK);
    mapctl.rtClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    mapctl.rtClickHandler.setInputAction(function (mouse) {
        //console.log("edit: " + mapctl.editgeofencechecked);
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
    mapctl.selectTrack = function (u, zoomto) {
        mapctl.trackselected = GeoService.sdatasources[$scope.selmap.name].entities.getById(u._id);
        mapctl.loc = mapctl.getLoc(mapctl.trackselected);
        if (zoomto) {
            GeoService.sdatasources[$scope.selmap.name].selectedEntity = mapctl.trackselected;
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
        mapctl.geofenceselected = GeoService.sdatasources[$scope.selmap.name].entities.getById(u._id);
        mapctl.loc = mapctl.getLoc(mapctl.geofenceselected);
        if (zoomto) {
            GeoService.sdatasources[$scope.selmap.name].selectedEntity = mapctl.geofenceselected;
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
        mapctl.polyselected = GeoService.sdatasources[$scope.selmap.name].entities.getById(p._id);
        mapctl.polyselectedid = mapctl.polyselected._id;
        mapctl.loc = mapctl.getLoc(mapctl.polyselected);
        if (zoomto) {
            GeoService.sdatasources[$scope.selmap.name].selectedEntity = mapctl.polyselected;
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
            GeoService.sdatasources[$scope.selmap.name].entities.getById(entity._id).position = Cesium.Cartesian3.fromDegrees(lng, lat);
            DbService.updateEntityDb($scope.selmap.name, entity._id, '_location', lat + "," + lng);
            mapctl.selectTrack(entity);
        } else {
            mapctl.addTrack(lat, lng);
        }
    };
    //  
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
                    "_id": trackname + "_Track",
                    "_name": trackname,
                    "_type": "track",
                    "_location": [lat, lng]
                };
                mapctl.tracks.push(trck);
                mapctl.trackselected = trck;
                GeoService.addCesiumPoint(trck, 'BLUE');
                DbService.updateEntityDb($scope.selmap.name, trackname, '_location', lat + "," + lng);
            }
        });
    };
    //  
    mapctl.addGeoFence = function (lat, lng) {
        console.log("addPolyline");
        DlgBx.prompt("No GeoFence Selected .. Enter Name to Create new GeoFence", "").then(function (geofencename) {
            var overwrite = null;
            for (n = 0; n < mapctl.tracks.length - 1; n++) {
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
                    "_type": "geofence",
                    "_location": [lat, lng],
                    "_points": [lat, lng]
                };
                mapctl.geofences[geofnce._id] = geofnce;
                mapctl.geofenceselected = geofnce;
                GeoService.addCesiumPoint(geofnce, 'RED');
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
    };
    mapctl.removeGeoFencePoint = function () {
        var geofid = mapctl.geofenceselected._id;
        var len = mapctl.geofences[geofid]._points.length;
        if (len > 2) {
            var id = geofid + (len - 2);
            console.log('removeGeoFencePoint ' + id);
            GeoService.removeEntity(id);
            mapctl.geofences[geofid]._points.length = len - 2;
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
        }
    };
    mapctl.showTrace = function (track) {
        console.log("showTrace");
        mapctl.showPP = true;
        GeoService.showTrace(track);
    }
    MsgService.socket.on('track connected', function (data) {
        console.log("Unit connected " + data.id);
        MsgService.setMap($scope.selmap.name, mapctl.map);
        //msgctl.messages.push({text: "Unit " + data.socketid + " connected"});
    });
});
TacMapServer.controller('messageCtl', function ($scope, DbService, GeoService, MsgService) {
    var msgctl = this;
    msgctl.messages = [];
    msgctl.tracks = [];
    msgctl.sendReport = function (msgobj) {
        //default ui
        MsgService.sendMessage(msgobj, msgobj.network);
    };
    msgctl.moveUnit = function (uid, sentto, net, lat, lon) {
        console.log("moveUnit: " + uid);
        GeoService.sdatasources[$scope.selmap.name].entities.getById(uid).position = Cesium.Cartesian3.fromDegrees(lon, lat);
        msgctl.sendReport({
            user: uid, to: sentto, time: new Date(), position: [lat, lon], network: net
        });
    };
    MsgService.socket.on('error', console.error.bind(console));
    MsgService.socket.on('message', console.log.bind(console));
    MsgService.socket.on('msg sent', function (data) {
        msgctl.messages.push({
            text: "POSREP " + data.net + " " + data.message.user
        });
        GeoService.sdatasources[$scope.selmap.name].entities.getById(data.message.user).position = Cesium.Cartesian3.fromDegrees(data.message.position[1], data.message.position[0]);
    });
    MsgService.socket.on('user disconnected', function (data) {
        console.log("Unit disconnected " + data.socketid);
        msgctl.messages.push({
            text: "Unit " + data.socketid + " disconnected"
        });
    });
    MsgService.socket.on('endpoint joined', function (data) {
        //console.log('Unit ' + data.userid + ' Joined Network: ' + data.netname);
        msgctl.messages.push({
            text: data.userid + ' Joined Network: ' + data.netname
        });
    });
    MsgService.socket.on('endpoint left', function (data) {
        console.log('Unit ' + data.userid + ' Left Network: ' + data.netname);
        msgctl.messages.push({
            text: data.userid + ' Left Network: ' + data.netname
        });
    });
    MsgService.socket.on("start map", function () {
        msgctl.running = true;
        $scope.$apply();
    });
    MsgService.socket.on("stop map", function () {
        msgctl.running = false;
        $scope.$apply();
    });
    MsgService.socket.on("set time", function (data) {
        msgctl.time = data.time;
        $scope.$apply();
    });
    msgctl.timeCalc = function (timeobj) {
        var day = timeobj.Day;
        var hr = timeobj.HourTime;
        var min = timeobj.MinuteTime;
        var sec = timeobj.SecondTime;
        var month = timeobj.MonthNumeric;
        var yr = timeobj.Year4Digit;
        var d = new Date(yr, month, day, hr, min, sec);
        return d.getTime();
    };
});
TacMapServer.controller('menuCtrl', function ($scope) {
    //initiate an array to hold all active tabs
    $scope.activeTabs = [];
    //check if the tab is active
    $scope.isOpenTab = function (tab) {
        //check if this tab is already in the activeTabs array
        if ($scope.activeTabs.indexOf(tab) > -1) {
            //if so, return true
            return true;
        } else {
            //if not, return false
            return false;
        }
    };
    //function to 'open' a tab
    $scope.openTab = function (tab) {
        //check if tab is already open
        if ($scope.isOpenTab(tab)) {
            //if it is, remove it from the activeTabs array
            $scope.activeTabs.splice($scope.activeTabs.indexOf(tab), 1);
        } else {
            //if it's not, add it!
            $scope.activeTabs.push(tab);
        }
    };
    //function to leave a tab open if open or open if not
    $scope.leaveOpenTab = function (tab) {
        //check if tab is already open
        if (!$scope.isOpenTab(tab)) {
            //if it is not open, add to array
            $scope.activeTabs.push(tab);
        }
    };
});