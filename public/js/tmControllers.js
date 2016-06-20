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
/* global resources, TacMap, Cesium, scene, angular, stctl, viewer, usrctl,$scope,DbService, SocketService, GeoService, DlgBx */ // ***** CONTROLLERS ******//

//viewCtl handles the interface
TacMap.controller('viewCtl', function() {
    var vwctl = this;
    vwctl.msgLog = "views/msgLog.html";
    vwctl.mapStore = "views/mapStore.html";
    vwctl.userProfile = "views/userProfile.html";
    vwctl.mapviews = "views/mapViews.html";
    vwctl.mapentities = "views/mapEntities.html";
    vwctl.networks = "views/networks.html";
    vwctl.info = "views/infobox.html";
    vwctl.tree = "views/unitTree.html";
    vwctl.treenode = "views/unitTreeNode.html";
    vwctl.infosec = "views/infosecForm.html";
    vwctl.editbox = "views/editunitbox.html";
    vwctl.editgeofence = "views/geofence.html";
    //initiate an array to hold all active tabs
    vwctl.activeTabs = [];
    //check if the tab is active
    vwctl.isOpenTab = function(tab) {
        //check if this tab is already in the activeTabs array
        if (vwctl.activeTabs.indexOf(tab) > -1) {
            //if so, return true
            return true;
        }
        else {
            //if not, return false
            return false;
        }
    };
    //function to 'open' a tab
    vwctl.openTab = function(tab) {
        //check if tab is already open
        if (vwctl.isOpenTab(tab)) {
            //if it is, remove it from the activeTabs array
            vwctl.activeTabs.splice(vwctl.activeTabs.indexOf(tab), 1);
        }
        else {
            //if it's not, add it!
            vwctl.activeTabs.push(tab);
        }
    };
    //function to leave a tab open if open or open if not
    vwctl.leaveOpenTab = function(tab) {
        //check if tab is already open
        if (!vwctl.isOpenTab(tab)) {
            //if it is not open, add to array
            vwctl.activeTabs.push(tab);
        }
    };

});
// userCtl handles initial user registraton and persists user data
TacMap.controller('userCtl', function($scope, $http, DbService, GeoService, SocketService, DlgBx, $q) {
    var usrctl = this;
    usrctl.endpoint = {};
    usrctl.newuserid = "";
    usrctl.seluser = "";
    usrctl.selunit = {};
    usrctl.selnet = {};
    usrctl.unitlist = [];
    usrctl.users = [];
    usrctl.map = "";
    //UI Views
    usrctl.edituserid = "";
    usrctl.editmapviewid = "";
    usrctl.editnetworkid = "";
    usrctl.editprofile = false;
    usrctl.endpoints = {};
    usrctl.reslist = {};
    usrctl.units = function() {
        if (GeoService.mapid === null) {
            usrctl.map = "Default Map";
            DbService.getMapData(usrctl.map, function(umapdata) {
                if (umapdata !== null) {
                    return umapdata.Map.Tracks.Track;
                }
                else {
                    return [];
                }
            });
        }
        else {
            usrctl.map = GeoService.mapid;
            DbService.getMapData(GeoService.mapid, function(umapdata) {
                if (umapdata !== null) {
                    return umapdata.Map.Tracks.Track;
                }
                else {
                    return [];
                }
            });
        }

    }
    usrctl.nets = function() {
        if (GeoService.mapid === null) {
            DbService.getMapData('Default Map', function(umapdata) {
                if (umapdata !== null) {
                    return umapdata.Map.Networks.Network;
                }
                else {
                    return [];
                }
            });
        }
        else {
            DbService.getMapData(GeoService.mapid, function(umapdata) {
                if (umapdata !== null) {
                    return umapdata.Map.Networks.Network;
                }
                else {
                    return [];
                }
            });
        }
    }
    usrctl.getUsers = function() {
        console.log("getUsers");
        var defer = $q.defer();
        usrctl.users = [];
        DbService.dB.openStore('User', function(store) {
            store.getAllKeys().then(function(keys) {
                for (var k in keys) {
                    usrctl.users.push(keys[k]);
                }
                usrctl.users.push("New User");
                console.log(usrctl.users);
            }).then(function() {
                defer.resolve(true);
            })
        });
    };
    usrctl.editProfile = function(ep) {
        usrctl.edituserid = ep.user_id;
        usrctl.editmapviewid = ep.map_id;
        usrctl.editnetworkid = ep.network_id;
        usrctl.editprofile = true;
    };
    usrctl.cancelEdit = function() {
        usrctl.editprofile = false;
    };
    usrctl.updateUserList = function() {
        DbService.getKeys('User', function(kys) {
            usrctl.userlist = [];
            for (var k in kys) {
                usrctl.userlist.push({
                    k: kys[k]
                })
            }

        });
    }
    usrctl.saveProfile = function() {
        usrctl.endpoint.user_id = usrctl.edituserid;
        //Update namespace if mapview name changed
        if (usrctl.endpoint.network_id !== usrctl.editnetworkid) {
            SocketService.deleteNet(usrctl.endpoint);
            SocketService.createNet(usrctl.editmapviewid, usrctl.editnetworkid);
            if (usrctl.endpoint.map_id !== usrctl.editmapviewid) {
                usrctl.endpoint.user_id = usrctl.edituserid;
                usrctl.endpoint.map_id = usrctl.editmapviewid;
                usrctl.endpoint.network_id = usrctl.editnetworkid;
                SocketService.initMapView(usrctl.endpoint);
                DbService.updateRecord('User', usrctl.endpoint.user_id, usrctl.endpoint, usrctl.updateUserList);
            }
        }
        else if (usrctl.endpoint.map_id !== usrctl.editmapviewid) {
            usrctl.endpoint.user_id = usrctl.edituserid;
            usrctl.endpoint.map_id = usrctl.editmapviewid;
            usrctl.endpoint.network_id = usrctl.editnetworkid;
            SocketService.initMapView(usrctl.endpoint);
            DbService.updateRecord('User', usrctl.endpoint.user_id, usrctl.endpoint, usrctl.updateUserList);
        }
        else {
            usrctl.endpoint.user_id = usrctl.edituserid;
            usrctl.endpoint.map_id = usrctl.editmapviewid;
            usrctl.endpoint.network_id = usrctl.editnetworkid;
            DbService.updateRecord('User', usrctl.endpoint.user_id, usrctl.endpoint, usrctl.updateUserList);
        }
        usrctl.editprofile = false;
    };
    usrctl.registerEndpoint = function(data) {
        console.log("registerEndpoint");
        DbService.getKeys('User', function(kys) {
            if (kys === null) {
                usrctl.newUnitUser(data);
            }
            else {
                usrctl.userlist = [];
                for (var k in kys) {
                    usrctl.userlist[kys[k]] = kys[k];
                }
                usrctl.userlist["New Unit"] = "New Unit";
                DlgBx.select("Select Unit View: ", "", usrctl.userlist).then(function(uname) {
                    if (uname === "New Unit") {
                        usrctl.newUser(data);
                    }
                    else {
                        if (uname === "") {
                            uname = "Admin";
                        }
                        usrctl.endpoint = {
                            socketid: $scope.socketID,
                            user_id: uname
                        };
                        usrctl.endpoint.socketid = $scope.socketID;
                        SocketService.initMapView(usrctl.endpoint);
                    }
                });
            }
        });
    };
    usrctl.newUnitUser = function(data) {
        DlgBx.prompt("New Unit: ", "Enter Unit Name: ", data["socketid"].substring(4, 10)).then(function(uname) {
            usrctl.endpoint = {
                socketid: $scope.socketID,
                user_id: uname.toLowerCase,
                user_name: uname
            };
            DbService.addRecord('User', usrctl.endpoint.user_id, usrctl.endpoint, usrctl.updateUserList);
            console.log('User registered');
            SocketService.initMapView(usrctl.endpoint);
        });
    };
    usrctl.userExists = function(newusr) {
        for (var u in usrctl.users) {
            if (usrctl.users[u] === newusr) {
                return true;
            }
        }

    }
    SocketService.socket.on('load map', function(ep) {
        // console.log(data);
        usrctl.endpoint = ep;
    });
    SocketService.socket.on('connection', function(data) {
        $scope.socketID = data.socketid;
        console.log('user connect ' + $scope.socketID);
        DbService.loadResources(function(udata) {
            if (typeof udata.Units !== "undefined") {
                usrctl.unitlist = udata.Units.Unit;
                for (var u in usrctl.unitlist) {
                    DbService.updateRecord("User", usrctl.unitlist[u]._id, usrctl.unitlist[u]);
                }
                usrctl.registerEndpoint(data);
            }
        })
    });
    SocketService.socket.on('update endpoints', function(eplist) {
        console.log('update endpointlist');
        usrctl.endpoints = eplist;
        //console.log(usrctl.endpoints);
        DbService.updateRecord('User', 'endpoints', eplist);
    });
});

//mapCtl handles creation, editing and display of Map Views
TacMap.controller('mapCtl', function($scope, DbService, GeoService, SocketService, MsgService, DlgBx, $http) {
    var mapctl = this;
    var ellipsoid = scene.globe.ellipsoid;
    mapctl.currentMap = 'Default Map';
    mapctl.currmapData = [];
    mapctl.maplist = {};
    mapctl.trackselected = null;
    mapctl.mapurl = "";
    mapctl.editlocchecked = false;
    mapctl.import = false;
    mapctl.polygons = [];
    mapctl.entities = [];
    mapctl.tracks = [];
    mapctl.geofences = [];
    mapctl.networks = [];
    mapctl.maps = [];
    mapctl.loc = [];
    mapctl.mapid = "";
    mapctl.network = "";
    mapctl.report_to = "";
    mapctl.mousepos = {};
    mapctl.editunit = false;
    mapctl.draginfo = "true";
    mapctl.netsel = [];
    mapctl.editpos = {};
    mapctl.editid = "";
    mapctl.editname = "";
    mapctl.editreport_to = "";
    mapctl.editechelon = "";
    mapctl.editnetwork = "";
    mapctl.infosectypes = ['Unit', 'Echelon', 'Network', 'GeoFence'];
    mapctl.infosectype = "";
    mapctl.echelons = ['Person', 'Team', 'Squad', 'Platoon', 'Company', 'Batallion', 'Regiment', 'Division', 'Force', 'All'];
    mapctl.infosecval = "";
    mapctl.newgeofence = false;
    mapctl.geofencelist = [];
    mapctl.editgeofence = false;
    mapctl.editgeofencename = "";
    mapctl.editgeofencepts = false;
    mapctl.geofenceselected = null;
    mapctl.geofencepts = [];
    mapctl.unittracks = [];

    //*******************************************//
    mapctl.getMapName=function(){
        return mapctl.mapid;
    }
    //Copies current map assuming name already deconflicted
    mapctl.saveMap = function(currentmap, newmapid) {
        console.log("Copy " + currentmap + " to " + newmapid);
        DbService.dB.openStore("Maps", function(store) {
            store.find(currentmap).then(function(map) {
                var u = map.url;
                //console.log(u);
                var newurl = u.substring(u.lastIndexOf('/') + 1) + newmapid;
                DbService.dB.openStore("Maps", function(store) {
                    store.insert({
                        id: newmapid,
                        url: newurl,
                        data: map.data
                    });
                });
            });
        });
    };
    //Loads map.  If Not in Maps store, initializes from Resources.
    mapctl.loadMap = function(userid) {
        DbService.getRecord("Maps", userid, function(jdata) {
            if (jdata === null) {
                console.log("loadMap defaultmap");
                DbService.getRecord("Resources", "defaultmap", function(jdata) {
                    //console.log(jdata);
                    mapctl.currmap = userid;
                    mapctl.currmapData = jdata.data;
                    mapctl.currmapData.id = userid;
                    mapctl.getUnitTracks(userid);
                    mapctl.tracks = mapctl.unittracks;
                    mapctl.currmapData.Map.Tracks.Track = mapctl.tracks;
                    //mapctl.tracks = mapctl.currmapData.Map.Tracks.Track;
                    mapctl.networks = mapctl.currmapData.Map.Networks.Network;
                    mapctl.geofences = mapctl.currmapData.Map.GeoFences.GeoFence;
                    DbService.updateMapData(userid, mapctl.currmapData, function(mdta) {
                        GeoService.initGeodesy(userid, mdta.data, mapctl.syncTracks);
                    });
                })
            }
            else {
                console.log("loadMap " + userid);
                mapctl.currmap = userid;
                mapctl.currmapData = jdata.data;
                mapctl.currmapData.id = userid;
                mapctl.tracks = mapctl.currmapData.Map.Tracks.Track;
                mapctl.networks = mapctl.currmapData.Map.Networks.Network;
                mapctl.geofences = mapctl.currmapData.Map.GeoFences.GeoFence;
                GeoService.initGeodesy(userid, jdata.data, mapctl.syncTracks);
            }
        });

    };

    mapctl.getUnitTracks = function(trckid) {
        if (trckid === "Admin") {
            mapctl.unittracks = mapctl.currmapData.Map.Tracks.Track;
        }
        else {
            var trck = mapctl.getById(mapctl.currmapData.Map.Tracks.Track, trckid);
            for (var t in mapctl.currmapData.Map.Tracks.Track) {
                if (mapctl.currmapData.Map.Tracks.Track[t]._network === trck._network) {
                    mapctl.unittracks.push(mapctl.currmapData.Map.Tracks.Track[t]);
                }
            }
        }
    };
    //Publish Tracks to SocketIO
    mapctl.syncTracks = function(mapdta) {
        console.log("syncTracks");
        SocketService.syncTracks(mapdta.Map.Tracks.Track);
    };
    //Deletes data stores in Browser IndexedDB
    mapctl.clearDb = function() {
        console.log("Clear DB");
        DlgBx.prompt("Warning", "Confirm Deletion of Local Data").then(function() {
            viewer.dataSources.remove(GeoService.sdatasources[mapctl.currentMap]);
            viewer.dataSources.remove(GeoService.ppdatasources[mapctl.currentMap]);
            DbService.dB.openStore('Resources', function(store) {
                store.clear();
            });
            DbService.dB.openStore('Map', function(store) {
                store.clear();
            });
        });
    };
    //*******************************************//
    mapctl.lftClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    mapctl.lftClickHandler.setInputAction(function(mouse) {
        mapctl.mousepos = mouse.position;
        var pickedObject = scene.pick(mouse.position);
        if (mapctl.editgeofence && mapctl.geofenceselected !== null) {
            mapctl.addGeoFencePoint(mapctl.geofencepts[0], mapctl.geofencepts[1]);
        }
        else if (typeof pickedObject !== 'undefined') {
            if (Cesium.defined(pickedObject) && pickedObject.id.billboard || pickedObject.id.ellipsoid || pickedObject.id.point) {
                mapctl.selectTrack(pickedObject.id);
            }
            else {
                mapctl.trackselected = null;
                mapctl.geofenceselected = null;
                mapctl.editlocchecked = false;
                mapctl.loc = [];
                $scope.$apply();
            }
        }
        else {
            mapctl.trackselected = null;
            mapctl.geofenceselected = null;
            mapctl.editlocchecked = false;
            mapctl.editunit = false;
            mapctl.loc = [];
            $scope.$apply();
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    mapctl.rtClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    mapctl.rtClickHandler.setInputAction(function(mouse) {
        mapctl.mousepos = mouse.position;
        var cartesian = viewer.camera.pickEllipsoid(mouse.position, ellipsoid);
        if (mapctl.editlocchecked && cartesian && mapctl.trackselected !== null) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            mapctl.setLocation(mapctl.trackselected, Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
        }
        else if (mapctl.editlocchecked && cartesian && mapctl.trackselected === null) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            mapctl.addTrack(Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
        }
        else if (mapctl.editgeofencepts && cartesian) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            mapctl.addGeoFencePoint(Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
        }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    //
    mapctl.selectPolygon = function(p, zoomto) {
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
        }
        else {
            $scope.$apply();
        }
    };
    mapctl.getLoc = function(entity) {
        var cartesian = entity.position.getValue();
        var cartographic = ellipsoid.cartesianToCartographic(cartesian);
        var latitudeString = Cesium.Math.toDegrees(cartographic.latitude);
        var longitudeString = Cesium.Math.toDegrees(cartographic.longitude);
        entity.description = "Location: " + latitudeString + ", " + longitudeString;
        return ([latitudeString, longitudeString]);
    };
    mapctl.setLocation = function(entity, lat, lng) {
        //console.log(entity);
        mapctl.mapid = GeoService.mapid;
        if (typeof entity._id !== 'undefined') {
            var chg = [];
            chg['_location'] = lat + "," + lng;
            chg['_timestamp'] = Date.now();
            DbService.updateTrackDb(mapctl.mapid, entity._id, chg, function(mdata) {
                //console.log(mdata);
                mapctl.currmapData = mdata.data;
                GeoService.sdatasources[mapctl.mapid].entities.getById(entity._id).position = Cesium.Cartesian3.fromDegrees(lng, lat);
                MsgService.postMsg('/msg/', {
                    scktid: SocketService.scktid,
                    scktmsg: 'POSREP',
                    payload: {
                        unit_id: entity._id,
                        latitude: lat,
                        longitude: lng,
                        visibility: entity._visibility
                    }
                });
            });

        }
        else {
            mapctl.addTrack(lat, lng);
        }
    };
    mapctl.newTrack = function(mapid, network, report_to) {
        console.log('newTrack in ' + mapid);
        mapctl.network = network;
        mapctl.report_to = report_to;
        mapctl.mapid = mapid;
        mapctl.editlocchecked = true;
        mapctl.trackselected = null;
    };
    mapctl.addTrack = function(lat, lng) {
        console.log("addTrack");
        DlgBx.prompt("No Track Selected .. Enter Name to Create Track", "").then(function(trackname) {
            var overwrite = null;
            for (var n = 0; n < mapctl.tracks.length; n++) {
                if (trackname === mapctl.tracks[n]._name) {
                    overwrite = mapctl.tracks[n]._name;
                }
            }
            if (overwrite !== null) {
                DlgBx.alert("Track name exists");
            }
            else {
                console.log("Create track " + trackname);
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
                console.log(mapctl.tracks);
                mapctl.tracks.push(trck);
                mapctl.trackselected = trck;
                GeoService.addCesiumBillboard(trck);
                mapctl.currmapData.Map.Tracks.Track = mapctl.tracks;
                DbService.updateMapData(mapctl.currentMap, mapctl.currmapData, function() {
                    mapctl.selectTrack(trck, true);
                });
            }
        });
    };
    mapctl.createTrack = function(unitid, lat, lng) {
        console.log("Create track " + unitid);
        var trck = {
            "_icon": "img/tacicon.png",
            "_id": unitid + "_Track",
            "_location": [lat, lng],
            "_name": unitid,
            "_map": mapctl.mapid,
            "_network": mapctl.network,
            "_report_to": mapctl.report_to,
            "_height": 25,
            "_width": 25
        };
        mapctl.tracks.push(trck);
        mapctl.trackselected = trck;
        GeoService.addCesiumBillboard(trck);
        mapctl.currmapData.Map.Tracks.Track = mapctl.tracks;
        DbService.updateMapData(mapctl.currentMap, mapctl.currmapData, function() {
            mapctl.selectTrack(trck, true);
        });
    };
    //
    mapctl.selectTrack = function(unit, zoomto) {
        mapctl.editunit = false;
        mapctl.mapid = GeoService.mapid;
        mapctl.trackselected = mapctl.getById(mapctl.tracks, unit._id);
        // console.log(mapctl.trackselected);
        var tracksel = GeoService.sdatasources[mapctl.mapid].entities.getById(unit._id);
        // console.log(tracksel);
        // DlgBx.alert("Track Selected");
        mapctl.loc = mapctl.getLoc(tracksel);
        if (zoomto) {
            GeoService.sdatasources[GeoService.mapid].selectedEntity = tracksel;
            viewer.selectedEntity = tracksel;
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(mapctl.loc[1], mapctl.loc[0], 10000.0),
                duration: 1
            });
        }
        else {
            $scope.$apply();
        }

    };
    //
    mapctl.newGeofence = function() {
        mapctl.mapid = GeoService.mapid;
        console.log('new GeoFence in ' + mapctl.mapid);
        //console.log(mapctl.geofences);
        mapctl.newgeofence = true;
        mapctl.geofenceselected = null;
        mapctl.editgeofencename = "";
    };
    mapctl.editGeofence = function(indx) {
        console.log('Edit GeoFence ' + mapctl.geofences[indx]._id);
        mapctl.editgeofenceid = mapctl.geofences[indx]._id;
        mapctl.editgeofencename = mapctl.geofences[indx]._name;
        mapctl.newgeofence = false;
        mapctl.mapid = GeoService.mapid;
        mapctl.geofenceselected = mapctl.geofences[indx];
        //console.log(mapctl.geofenceselected)
        mapctl.editgeofence = true;
        mapctl.editgeofencepts = true;
    };

    mapctl.removeGeoFence = function(indx) {
        DlgBx.confirm("Delete GeoFence " + mapctl.geofenceselected._name, "This cannot be undone").then(function(yes) {
            if (yes) {
                GeoService.sdatasources[GeoService.mapid].entities.removeById(mapctl.geofenceselected._id);
                mapctl.geofences.splice(indx, 1);
                mapctl.currmapData.Map.GeoFences.GeoFence = mapctl.geofences;
                DbService.updateMapData(GeoService.mapid, mapctl.currmapData, function() {
                    mapctl.editgeofence = false;
                });
            }
            else {
                console.log("Delete Geofence cancelled");
            }
        });
    };

    mapctl.cancelGeofEdit = function(indx) {
        console.log("cancelGeofEdit " + mapctl.geofences[indx]._id);
        DbService.getGeoFence(mapctl.mapid, mapctl.geofences[indx]._id, function(geof) {
            GeoService.updateCesiumPolyline(mapctl.geofences[indx]._id, geof);
            mapctl.editgeofencename = "";
            mapctl.editgeofence = false;
            mapctl.editgeofencepts = false;
        })
    };
    mapctl.saveGeofenceName = function() {
        if (mapctl.editgeofencename !== "") {
            mapctl.editgeofencepts = true;
            mapctl.mapid = GeoService.mapid;
            if (mapctl.geofences === "") {
                mapctl.geofences = [];
            }
            mapctl.geofences = mapctl.currmapData.Map.GeoFences.GeoFence;
            var geofnce = {
                "_id": mapctl.editgeofencename.toLowerCase(),
                "_name": mapctl.editgeofencename,
                "_location": [],
                "_points": []
            };
            mapctl.geofenceselected = geofnce;
            mapctl.geofences.push(geofnce);
            mapctl.currmapData.Map.GeoFences.GeoFence = mapctl.geofences;
            DbService.updateMapData(mapctl.mapid, mapctl.currmapData, function() {
                //console.log(mapctl.geofences);
                mapctl.editgeofencename = "";
                mapctl.newgeofence = false;
            });
        }
    };
    mapctl.saveGeofenceEdit = function(indx) {
        mapctl.geofences[indx]._name = mapctl.editgeofencename;
        mapctl.geofences[indx]._id = mapctl.editgeofencename.toLowerCase();
        mapctl.currmapData.Map.GeoFences.GeoFence = mapctl.geofences;
        GeoService.updateCesiumPolyline(mapctl.editgeofenceid, mapctl.geofences[indx]);
        DbService.updateMapData(GeoService.mapid, mapctl.currmapData, function() {
            mapctl.editgeofence = false;
            mapctl.editgeofencepts = false;
        });
    };


    mapctl.geoFenceExists = function(gfname) {
        for (var n in mapctl.geofences) {
            if (gfname === mapctl.geofences[n]._name) {
                return true;
            }
        }

    };
    mapctl.addGeoFencePoint = function(lat, lng) {
        var geofncesel = mapctl.geofenceselected;
        console.log("addGeoFencePoint " + geofncesel._id + " " + lat + " " + lng);
        mapctl.geofencepts = geofncesel._points.toString();
        var len;
        if (!Array.isArray(mapctl.geofencepts)) {
            mapctl.geofencepts = mapctl.geofencepts.replace(/\s|\"|\[|\]/g, "").split(",");
            len = mapctl.geofencepts.length;
        }
        else {
            len = mapctl.geofencepts.length;
        }
        var pt = [];
        pt._id = geofncesel._id + len;
        pt._points = [mapctl.geofencepts[len - 2], mapctl.geofencepts[len - 1]];
        pt._points.push(lat);
        pt._points.push(lng);
        pt._color = 'LIGHTYELLOW';
        mapctl.geofencepts.push(lat);
        mapctl.geofencepts.push(lng);
        if (len === 0) {
            geofncesel._location = [lat, lng];
            GeoService.addCesiumPoint(geofncesel, 'RED');
            mapctl.selectGeoFence(geofncesel, true);
            mapctl.geofenceselected._points = mapctl.geofencepts.toString();

        }
        else {
            GeoService.addCesiumPolyline(pt);
            mapctl.geofenceselected._points = mapctl.geofencepts.toString();
        }
    };
    //
    mapctl.removeGeoFencePoint = function(indx) {
        var geofid = mapctl.geofences[indx]._id;
        mapctl.geofencepts = mapctl.geofences[indx]._points;
        var len;
        if (!Array.isArray(mapctl.geofencepts)) {
            mapctl.geofencepts = mapctl.geofencepts.replace(/\s|\"|\[|\]/g, "").split(",");
            len = mapctl.geofencepts.length;
        }
        else {
            len = mapctl.geofencepts.length;
        }
        console.log("removeGeoFencePoint " + len);
        if (len === 2) {
            mapctl.geofencepts.length = len - 2;
            mapctl.geofences[indx]._location = [];
            mapctl.geofences[indx]._points = mapctl.geofencepts.toString();
            GeoService.updateCesiumPolyline(mapctl.editgeofenceid, mapctl.geofences[indx]);
        }
        else if (len > 0) {
            mapctl.geofencepts.length = len - 2;
            mapctl.geofences[indx]._points = mapctl.geofencepts.toString();
            GeoService.updateCesiumPolyline(mapctl.editgeofenceid, mapctl.geofences[indx]);
        }
    };
    mapctl.removeAllGeoFencePoints = function(indx) {
        var geofncesel = mapctl.geofences[indx];
        var geofid = geofncesel._id;
        mapctl.geofencepts = geofncesel._points.toString();
        var len;
        if (!Array.isArray(mapctl.geofencepts)) {
            mapctl.geofencepts = mapctl.geofencepts.replace(/\s|\"|\[|\]/g, "").split(",");
            len = mapctl.geofencepts.length;
        }
        else {
            len = mapctl.geofencepts.length;
        }
        mapctl.geofencepts.length = 0;
        mapctl.geofences[indx]._points = mapctl.geofencepts.toString();
        GeoService.updateCesiumPolyline(mapctl.editgeofenceid, mapctl.geofences[indx]);
    };
    mapctl.updateGeoFences = function(geofence) {
        console.log(mapctl.geofences);
        var gfncs = [];
        for (var n = 0; n < mapctl.geofences.length; n++) {
            if (mapctl.geofences[n]._id === geofence._id) {
                gfncs.push(geofence);
            }
            else {
                gfncs.push(mapctl.geofences[n]);
            }
        }
        mapctl.geofences = gfncs;
        mapctl.currmapData.Map.GeoFences.GeoFence = mapctl.geofences;
        DbService.updateMapData(mapctl.currentMap, mapctl.currmapData, function() {
            console.log(mapctl.geofences);
        });
    };
    //
    mapctl.selectGeoFence = function(gf, zoomto) {
        console.log(gf._id);
        mapctl.mapid = GeoService.mapid;
        mapctl.geofenceselected = mapctl.getById(mapctl.geofences, gf._id);
        // console.log(mapctl.geofenceselected);
        var geofencesel = GeoService.sdatasources[mapctl.mapid].entities.getById(gf._id);
        // console.log(geofencesel);
        var loc = mapctl.geofenceselected._location;
        if (loc.length > 0) {
            if (!Array.isArray(loc)) {
                loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
            }
            console.log(loc[1] + ", " + loc[0]);
            if (zoomto) {
                GeoService.sdatasources[mapctl.mapid].selectedEntity = geofencesel;
                viewer.selectedEntity = geofencesel;
                viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(loc[1], loc[0], 10000.0),
                    duration: 1
                });
            }
            else {
                $scope.$apply();
            }
        }
    };
    //
    mapctl.showTrace = function(track) {
        console.log("showTrace");
        mapctl.showPP = true;
        GeoService.showTrace(track);
    };
    mapctl.selMapVw = function(m, d, vwctl) {
        mapctl.mapview = m;
        if (mapctl.mselected === m) {
            vwctl.openTab(m);
        }
        else {
            console.log(m + " selected");
            mapctl.mselected = m;
            if (m !== mapctl.currentMap) {
                viewer.dataSources.remove(GeoService.sdatasources[mapctl.currentMap]);
                mapctl.currentMap = m;
                mapctl.currmapData = d;
                mapctl.tracks = mapctl.currmapData.Map.Tracks.Track;
                mapctl.geofences = mapctl.currmapData.Map.GeoFences.GeoFence;
                mapctl.maplist[mapctl.currentMap] = mapctl.currmapData;
                GeoService.initGeodesy(mapctl.currentMap, mapctl.currmapData, mapctl.syncTracks);
            }
        }
    };
    mapctl.mapSelected = function(m) {
        return mapctl.mselected === m;
    };
    //
    mapctl.getMapData = function(callback) {
        DbService.getUserMapData(mapctl.currentMap, function(umapdta) {
            if (typeof(umapdta) === 'undefined') {
                DbService.updateMapData(mapctl.currentMap, mapctl.currmapData, callback);
            }
            else {
                mapctl.currmapData = umapdta;
                DbService.updateMapData(mapctl.currentMap, umapdta, callback);
            }
        });
    };
    //
    mapctl.getById = function(jobj, id) {
        for (var x in jobj) {
            if (jobj[x]._id === id) {
                return jobj[x];
            }
        }
    };
    mapctl.getByName = function(jobj, nm) {
        for (var x in jobj) {
            if (jobj[x]._name === nm) {
                return jobj[x];
            }
        }
    };
    //

    mapctl.unitTree = function() {
        var s = {};
        for (var u in mapctl.tracks) {
            if (mapctl.parentUnit(mapctl.tracks[u])) {
                var id = mapctl.tracks[u]._id;
                s[id] = mapctl.tracks[u];
                if (mapctl.hasChildren(s[id])) {
                    var kids = mapctl.treeChildren(s[id]);
                    // console.log(kids);
                    for (var n in kids) {
                        s[id][kids[n]._id] = kids[n];
                    }
                }
            }
        }
        return s;
    };

    mapctl.parentUnit = function(unit) {
        if (unit._report_to === unit._id) {
            return true;
        }
        else {
            for (var u in mapctl.tracks) {
                if (mapctl.tracks[u]._id === unit._report_to) {
                    return false;
                }
            }
            return true;
        }
    };

    mapctl.hasChildren = function(unt) {
        for (var u in mapctl.tracks) {
            if (mapctl.tracks[u]._report_to === unt._id && mapctl.tracks[u]._id !== unt._id) {
                return true;
            }
        }
    };

    mapctl.treeChildren = function(p) {
        var k = {};
        for (var c in mapctl.tracks) {
            if (mapctl.tracks[c]._report_to === p._id && mapctl.tracks[c]._id !== p._id) {
                var id = mapctl.tracks[c]._id;
                k[id] = mapctl.tracks[c];
                if (mapctl.hasChildren(k[id])) {
                    var kds = mapctl.treeChildren(k[id]);
                    for (var n in kds) {
                        k[id][kds[n]._id] = kds[n];
                    }
                }
            }
        }
        return k;
    };
    mapctl.editUnit = function() {
        mapctl.editunit = true;
        mapctl.editlocchecked = false;
        mapctl.editid = mapctl.trackselected._id;
        mapctl.editname = mapctl.trackselected._name;
        mapctl.editechelon = mapctl.trackselected._echelon;
        mapctl.editreport_to = mapctl.trackselected._report_to;
        mapctl.editnetwork = mapctl.trackselected._network;
        mapctl.editvisibility = mapctl.trackselected._visibility;
        // var g = mapctl.getById(mapctl.geofences, 'airfield');
        //var loc = mapctl.trackselected._location.replace(/\s|\"|\[|\]/g, "").split(",");
        //var t = mapctl.withinGeoFence(loc, g);
        //console.log(t);
    };
    mapctl.joinNet = function(nsel) {

    };
    mapctl.cancelUnitEdit = function() {
        mapctl.editunit = false;
        mapctl.editid = "";
        mapctl.editname = "";
        mapctl.editechelon = "";
        mapctl.editreport_to = "";
        mapctl.editnetwork = "";
        mapctl.editvisibility = [];
        mapctl.infosectype = "";
        mapctl.infosecval = "";
    }
    mapctl.saveUnitEdit = function() {
        var chg = [];
        if (mapctl.editid !== mapctl.trackselected._id) {
            //mapctl.trackselected._id= mapctl.editid;
            chg['_id'] = mapctl.editid;
        }
        if (mapctl.editechelon !== mapctl.trackselected._echelon) {
            mapctl.trackselected._echelon = mapctl.editechelon;
            chg['_echelon'] = mapctl.editechelon;
        }
        if (mapctl.editname !== mapctl.trackselected._name) {
            mapctl.trackselected._name = mapctl.editname;
            chg['_name'] = mapctl.editname;
        }
        if (mapctl.editreport_to !== mapctl.trackselected._report_to) {
            mapctl.trackselected._report_to = mapctl.editreport_to;
            chg['_report_to'] = mapctl.editreport_to;
        }
        if (mapctl.editnetwork !== mapctl.trackselected._network) {
            mapctl.trackselected._network = mapctl.editnetwork;
            chg['_network'] = mapctl.editnetwork;
        }
        if (mapctl.editvisibility !== mapctl.trackselected._visibility) {
            mapctl.trackselected._visibility = mapctl.editvisibility;
            chg['_visibility'] = mapctl.editvisibility;
        }
        DbService.updateTrackDb(mapctl.mapid, mapctl.trackselected._id, chg, function(mdata) {
            mapctl.currmapData = mdata.data;
            if (mapctl.editid !== mapctl.trackselected._id) {
                console.log("Replace entity");
                GeoService.sdatasources[mapctl.mapid].entities.removeById(mapctl.trackselected._id);
                mapctl.trackselected._id = mapctl.editid;
                GeoService.addCesiumBillboard(mapctl.trackselected);
            }
            mapctl.cancelUnitEdit();
        });
    }

    mapctl.addInfoSecParam = function() {
        if (mapctl.infosectype !== "" && mapctl.infosecval !== "") {
            if (typeof mapctl.editvisibility === 'undefined') {
                mapctl.editvisibility = [];
                mapctl.editvisibility.push({
                    type: mapctl.infosectype,
                    value: mapctl.infosecval
                });
                mapctl.infosectype = "";
                mapctl.infosecval = "";
            }
            else {
                if (!mapctl.hasParam(mapctl.infosectype, mapctl.infosecval)) {
                    mapctl.editvisibility.push({
                        type: mapctl.infosectype,
                        value: mapctl.infosecval
                    });
                    mapctl.infosectype = "";
                    mapctl.infosecval = "";
                }
            }
        }
    };
    mapctl.removeInfoSecParam = function(indx) {
        console.log(indx);
        mapctl.trackselected._visibility.splice(indx, 1);
    };

    mapctl.hasParam = function(t, v) {
        for (var p in mapctl.editvisibilit) {
            if (mapctl.editvisibility[p].type === t && mapctl.editvisibility[p].value === v) {
                return true;
            }
        }
    };

    mapctl.withinGeoFence = function(loc, geofence) {
        var gpts = geofence._points.replace(/\s|\"|\[|\]/g, "").split(",");
        var temp = gpts.slice();
        var poly = [];
        while (temp.length) {
            poly.push(temp.splice(0, 2));
        }
        return pointInPolygon(loc, poly);
    };


    function pointInPolygon(point, vs) {
        // ray-casting algorithm based on
        // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
        var xi, xj, yi, yj, i, intersect,
            x = point[0] / 100,
            y = point[1] / 100,
            inside = false;
        for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            xi = vs[i][0] / 100,
                yi = vs[i][1] / 100,
                xj = vs[j][0] / 100,
                yj = vs[j][1] / 100,
                intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }


    SocketService.socket.on('load map', function(endpoint) {
        mapctl.ep = endpoint;
        mapctl.loadMap(endpoint.user_id);
        // SocketService.requestMaps();
    });

    SocketService.socket.on('update maps', function(maplist) {
        console.log('update maps');
        mapctl.maps = maplist;
        // console.log(mapctl.maps);
        DbService.updateRecord('Maps', m.id, m.data, function(rec) {

        });
        mapctl.maplist = [];
        for (var m in maplist) {
            mapctl.maplist.push({
                id: m.id
            });
            DbService.updateRecord('Maps', m.id, m.data);
        }
    });
    //
    // {scktmsg:'POSREP',unit_id:entity._id,latitude:lat,longitude:lng}
    SocketService.socket.on('POSREP', function(msg) {
        var uid = msg.payload.unit_id;
        var lat = msg.payload.latitude;
        var lng = msg.payload.longitude;
        var time = msg.payload.timestamp;
        console.log("POSREP Received for " + uid + " at " + Date.now());
        mapctl.mapid = GeoService.mapid;
        var entity = GeoService.sdatasources[mapctl.mapid].entities.getById(uid);
        if (typeof entity !== 'undefined') {
            if (msg.scktid !== SocketService.scktid) {
                var chg = [];
                chg['_location'] = lat + "," + lng;
                //chg['_timestamp'] = Date.now();
                chg['_timestamp'] = time;
                mapctl.trackselected._location = chg['_location'];
                mapctl.trackselected._timestamp = chg['_timestamp'];
                DbService.updateTrackDb(mapctl.mapid, uid, chg, function(mdata) {
                    mapctl.currmapData = mdata.data;
                    entity.position = Cesium.Cartesian3.fromDegrees(lng, lat);
                });
            }
            else {
                DbService.getMapData(mapctl.mapid, function(mdata) {
                    mapctl.currmapData = mdata.data;
                    entity.position = Cesium.Cartesian3.fromDegrees(lng, lat);
                });
            }

        }
        else {
            mapctl.createTrack(msg.unit_id, lat, lng);
        }
    });
    //
    SocketService.socket.on('update tracks', function(trackdata) {
        var sid = trackdata.scktid;
        var tracks = trackdata.tracks;
        console.log("update tracks");
        if (trackdata.scktid !== SocketService.scktid) {
            mapctl.tracks = mapctl.currmapData.Map.Tracks.Track;
            var tracklist = [];
            for (var tr in mapctl.tracks) {
                tracklist[mapctl.tracks[tr]._id] = mapctl.tracks[tr];
            }
            //console.log(tracks);
            mapctl.mapid = GeoService.mapid;
            for (var t in tracks) {
                if (tracklist[tracks[t]._id]) {
                    if (tracklist[tracks[t]._id]._timestamp < tracks[t]._timestamp) {
                        var loc = tracks[t]._location;
                        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
                        var chg = [];
                        chg['_location'] = loc;
                        chg['_timestamp'] = tracks[t]._timestamp;
                        DbService.updateTrackDb(mapctl.mapid, tracks[t]._id, chg, function(mdata) {
                            mapctl.currmapData = mdata.data;
                            var entity = GeoService.sdatasources[mapctl.mapid].entities.getById(tracks[t]._id);
                            entity.position = Cesium.Cartesian3.fromDegrees(loc[0], loc[1]);
                        });
                    }
                }
                //if mapctl.tracks[t]
            }
        }
    });
});

//messageCtl handles messages
TacMap.controller('messageCtl', function(GeoService, SocketService) {
    var msgctl = this;
    msgctl.maptxt = "";
    msgctl.addmap = false;
    msgctl.messages = [];
    msgctl.tracks = [];

    msgctl.sendReport = function(msgobj) {
        //default ui
        SocketService.sendMessage(msgobj, msgobj.network);
    };
    msgctl.setPosition = function(mapid, uid, sentto, net, lat, lon) {
        console.log("moveUnit: " + uid);
        GeoService.sdatasources[mapid].entities.getById(uid).position = Cesium.Cartesian3.fromDegrees(lon, lat);
        msgctl.sendReport({
            user: uid,
            to: sentto,
            time: new Date(),
            position: [lat, lon],
            network: net
        });
    };
});
//
TacMap.directive('draggable', ['$window', function($window) {
    return {
        restrict: 'A',
        link: function(scope, elm, attrs) {
            var startX, startY, initialMouseX, initialMouseY;
            elm.css({
                position: 'absolute'
            });

            elm.bind('mousedown', function($event) {
                $event.preventDefault();
                angular.element($window).bind('mouseup', mouseup);
                angular.element($window).bind('mousemove', mousemove);
                startX = elm.prop('offsetLeft');
                startY = elm.prop('offsetTop');
                initialMouseX = $event.clientX;
                initialMouseY = $event.clientY;
                return false;
            });

            function mousemove($event) {
                var dx = $event.clientX - initialMouseX;
                var dy = $event.clientY - initialMouseY;
                elm.css({
                    top: startY + dy + 'px',
                    left: startX + dx + 'px'
                });
                return false;
            }

            function mouseup() {
                angular.element($window).unbind('mouseup', mouseup);
                angular.element($window).unbind('mousemove', mousemove);
            }
        }

    };
}]);
//
TacMap.directive('draghandle', ['$window', function($window) {
    return {
        restrict: 'A',
        link: function(scope, elm, attrs) {
            var startX, startY, initialMouseX, initialMouseY;
            var container = null;
            elm.css({
                position: 'absolute',
                cursor: 'pointer'
            });

            elm.bind('mousedown', function($event) {
                container = attrs.$$element.parent();
                angular.element($window).bind('mouseup', mouseup);
                angular.element($window).bind('mousemove', mousemove);
                startX = container.prop('offsetLeft');
                startY = container.prop('offsetTop');
                initialMouseX = $event.clientX;
                initialMouseY = $event.clientY;
                return false;
            });

            function mousemove($event) {
                var dx = $event.clientX - initialMouseX;
                var dy = $event.clientY - initialMouseY;
                container.css({
                    top: startY + dy + 'px',
                    left: startX + dx + 'px'
                });
                return false;
            }

            function mouseup() {
                angular.element($window).unbind('mouseup', mouseup);
                angular.element($window).unbind('mousemove', mousemove);
            }
        }

    };
}]);