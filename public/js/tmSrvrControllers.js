/* global resources */
// ***** SERVER CONTROLLERS ******//
TacMapServer.controller('storeCtl', function ($scope, $http, DbService, GeoService, MsgService, DlgBx) {
    var stctl = this;
    stctl.maplist = [{
            id: 0, name: 'Default Map'
        }];
    stctl.map = [];
    stctl.currmap = [];
    $scope.selmap = stctl.maplist[0];
    console.log("storeCtl");
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
                                    id: stctl.maplist.length - 1, name: newname.replace(' ', '') + ".json", url: "/json/" + newname.replace(' ', '') + ".json"
                                });
                                DbService.dB.openStore('Resources', function (store) {
                                    store.upsert({
                                        name: "maps.json", url: "/json/maps.json", data: stctl.maplist
                                    }).then(function () {
                                        store.find("maps.json").then(function (st) {
                                            $http.put('/json/maps.json', st.data);
                                        });
                                    });
                                });
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
            DlgBx.prompt("Enter Save As Name or Overwrite", savedmap.map).then(function (newname) {
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
                                    id: stctl.maplist.length - 1, name: newname
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
    stctl.updateDb = function (entityId, fieldname, value) {
        DbService.dB.openStore("Maps", function (store) {
            store.find($scope.selmap.name).then(function (map) {
                stctl.map = map.data;
                for (i = 0; i < stctl.map.Map.Entities.Entity.length; i++) {
                    if (stctl.map.Map.Entities.Entity[i]._id === entityId) {
                        stctl.map.Map.Entities.Entity[i][fieldname] = value;
                    }
                }
            }).then(function () {
                store.upsert({
                    name: $scope.selmap.name, data: stctl.map
                });
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
                    name: newmapid, data: map.data
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
                        name: mapid, data: mapctl.map
                    });
                });
            });
        });
    };
    stctl.deleteMap = function (currentmap) {
        if ($scope.selmap.id === 0) {
            DlgBx.alert("Can't delete Default Map");
        } else {
            DlgBx.confirm("Confirm deletion of Map: " + currentmap.value).then(function (yes) {
                console.log("Confirm response: " + $scope.selmap.id);
                if (yes && $scope.selmap.id !== 0) {
                    console.log("Delete from Idb: " + currentmap.value);
                    DbService.dB.openStore("Maps", function (store) {
                        store[ "delete"](currentmap.value);
                    });
                    var na = [];
                    for (i = 0; i < stctl.maplist.length; i++) {
                        if (stctl.maplist[i].value !== currentmap.value) {
                            na.push(stctl.maplist[i]);
                        }
                    }
                    stctl.maplist = na;
                    stctl.loadMap(stctl.maplist[na.length - 1]);
                } else {
                }
            });
        }
    };
    stctl.saveMap = function (currentmap) {
        console.log("saveMap");
        DlgBx.prompt("Enter Save As Name or Overwrite", currentmap.value).then(function (newname) {
            var overwrite = null;
            var overwriteid = null;
            for (n = 0; n < stctl.maplist.length - 1; n++) {
                if (newname === stctl.maplist[n].value) {
                    overwrite = stctl.maplist[n].value;
                    overwriteid = stctl.maplist[n].value;
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
                    id: stctl.maplist.length - 1, name: newname
                });
                stctl.currmap = currentmap;
                stctl.loadMap(stctl.maplist[stctl.maplist.length - 1]);
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
                    name: "maps.json", url: resources[1], data: mapctl.maplist
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
    MsgService.socket.on('init server', function (data) {
        console.log('init server: ' + data.mapid);
        $http.get('xml/maps.xml').success(function (resdata, status, headers) {
            var maps = DbService.xj.xml_str2json(resdata);
            for (i = 0; i < maps.Maps.Map.length; i++) {
                var u = maps.Maps.Map[i]._url;
                var n = maps.Maps.Map[i]._name;
                if (u.substring(u.indexOf('.')) === '.xml') {
                    DbService.syncResource($scope, $http, maps.Maps.Map[i]._id, maps.Maps.Map[i]._url, stctl, GeoService);
                } else {
                    $http.get(u).success(function (jsondata, status, headers) {
                        DbService.dB.openStore('Maps', function (mstore) {
                            console.log(n);
                            mstore.upsert({
                                name: n, url: u, data: jsondata
                            });
                            $http.post("/json/maps.json", angular.toJson(stctl.sortByKey(stctl.maplist, 'id')));
                        });
                    });
                }
            }
        });
    });
});
TacMapServer.controller('mapCtl', function ($indexedDB, $scope, $http, GeoService, DbService, MsgService, DlgBx) {
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
            mapctl.addGeoFencePoint(Cesium.Math.toDegrees(mapctl.geofenceselected,cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
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
        //console.log(entity._id);
        if (typeof entity._id !== 'undefined') {
            GeoService.sdatasources[$scope.selmap.name].entities.getById(entity._id).position = Cesium.Cartesian3.fromDegrees(lng, lat);
            mapctl.updateDb(entity._id, '_location', lat + "," + lng);
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
            for (n = 0; n < mapctl.tracks.length - 1; n++) {
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
                    "_location": [lat,lng]
                };
                mapctl.tracks.push(trck);
                mapctl.trackselected = trck;
                GeoService.addCesiumPoint(trck, 'BLUE');
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
                    "_location": [lat,lng],
                    "_points": [lat,lng]
                };
                mapctl.geofences.push(geofnce);
                mapctl.geofenceselected = geofnce;
                GeoService.addCesiumPoint(geofnce, 'RED');
            }
        });
    };
    mapctl.addGeoFencePoint = function (geofid,lat, lng) {
        mapctl.geofences[geofid].points.push([lat,lng]);
        console.log(mapctl.geofences[geofid]);
    };
    mapctl.showTrace = function (track) {
        console.log("showTrace");
        mapctl.showPP = true;
        GeoService.showTrace(track);
    };
    MsgService.socket.on('connection', function (data) {
        MsgService.serverid = data.socketid;
        MsgService.connectServer(data, $scope.selmap.name, mapctl.map);
    });
    MsgService.socket.on('track connected', function (data) {
        console.log("Unit connected " + data.id);
        MsgService.setMap($scope.selmap.name, mapctl.map);
        //msgctl.messages.push({text: "Unit " + data.socketid + " connected"});
    });
});
TacMapServer.controller('messageCtl', function ($indexedDB, $scope, $interval, DbService, GeoService, MsgService) {
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
    MsgService.socket.on('user joined', function (data) {
        //console.log('Unit ' + data.userid + ' Joined Network: ' + data.netname);
        msgctl.messages.push({
            text: 'Unit ' + data.userid + ' Joined Network: ' + data.netname
        });
    });
    MsgService.socket.on('user left', function (data) {
        console.log('Unit ' + data.userid + ' Left Network: ' + data.netname);
        msgctl.messages.push({
            text: 'Unit ' + data.userid + ' Left Network: ' + data.netname
        });
    });
    MsgService.socket.on('server joined', function (data) {
        //console.log('Joined Network: ' + data.netname);
        msgctl.messages.push({
            text: 'Joined Network: ' + data.netname
        });
    });
    MsgService.socket.on('server left', function (data) {
        //console.log('Left Network: ' + data.netname);
        msgctl.messages.push({
            text: 'Left Network: ' + data.netname
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