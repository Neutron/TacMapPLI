/* global resources */
// ***** SERVER CONTROLLERS ******//
TacMapServer.controller('storeCtl', function ($indexedDB, $scope, $http, GeoService, MsgService, DlgBx) {
    var stctl = this;
    console.log("storeCtl");
    stctl.xj = new X2JS();
    var dB = $indexedDB;
    var ellipsoid = scene.globe.ellipsoid;
    stctl.trackselected = [];
    stctl.graphicselected = [];
    stctl.currmission = [];
    stctl.editchecked = false;
    stctl.editlocchecked = false;
    stctl.import = false;
    //
    stctl.entities = [];
    stctl.tracks = [];
    stctl.mission = [];
    stctl.missionlist = [];
    stctl.polypoints = [];
    stctl.loc = [];
    stctl.showPP = true;
    $scope.selmission = {
        id: 0, name: 'Default Mission'
    };
    //
    stctl.lftClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    stctl.lftClickHandler.setInputAction(function (mouse) {
        var pickedObject = scene.pick(mouse.position);
        if (Cesium.defined(pickedObject) && pickedObject.id.position !== undefined && pickedObject.id.billboard) {
            stctl.selectUnit(pickedObject.id);
        } else {
            stctl.loc = [];
            stctl.trackselected = null;
            $scope.$apply();
        }
    },
            Cesium.ScreenSpaceEventType.LEFT_CLICK);
    stctl.rtClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    stctl.rtClickHandler.setInputAction(function (mouse) {
        //console.log("edit: " + stctl.editchecked);
        var cartesian = viewer.camera.pickEllipsoid(mouse.position, ellipsoid);
        if (stctl.editchecked && cartesian && stctl.trackselected !== null) {
            //console.log("trackselected: " + stctl.trackselected._id);
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            stctl.addPolypoint(stctl.loc, Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
        }
        if (stctl.editlocchecked && cartesian && stctl.trackselected !== null) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            stctl.setLocation(stctl.trackselected, Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
        }
    },
            Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    stctl.selectUnit = function (u, zoomto) {
        stctl.trackselected = GeoService.sdatasources[$scope.selmission.name].entities.getById(u._id);
        stctl.trackselectedid = stctl.trackselected._id;
        stctl.loc = stctl.getLoc(stctl.trackselected);
        if (zoomto) {
            GeoService.sdatasources[$scope.selmission.name].selectedEntity = stctl.trackselected;
            viewer.selectedEntity = stctl.trackselected;
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(stctl.loc[1], stctl.loc[0], 10000.0),
                duration: 1
            });
        } else {
            $scope.$apply();
        }
    };
    stctl.selectPolygon = function (p, zoomto) {
        stctl.polyselected = GeoService.sdatasources[$scope.selmission.name].entities.getById(p._id);
        stctl.polyselectedid = stctl.polyselected._id;
        stctl.loc = stctl.getLoc(stctl.polyselected);
        if (zoomto) {
            GeoService.sdatasources[$scope.selmission.name].selectedEntity = stctl.polyselected;
            viewer.selectedEntity = stctl.polyselected;
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(stctl.loc[1], stctl.loc[0], 10000.0),
                duration: 1
            });
        } else {
            $scope.$apply();
        }
    };

    stctl.getLoc = function (entity) {
        var cartesian = entity.position.getValue();
        var cartographic = ellipsoid.cartesianToCartographic(cartesian);
        var latitudeString = Cesium.Math.toDegrees(cartographic.latitude);
        var longitudeString = Cesium.Math.toDegrees(cartographic.longitude);
        entity.description = "Location: " + latitudeString + ", " + longitudeString;
        return ([latitudeString, longitudeString]);
    };

    stctl.setLocation = function (entity, lat, lng) {
        if (entity !== null) {
            GeoService.sdatasources[$scope.selmission.name].entities.getById(entity._id).position = Cesium.Cartesian3.fromDegrees(lng, lat);
            stctl.removeAllPp();
            stctl.updateDb(entity._id, '_location', lat + "," + lng);
            stctl.selectUnit(entity);
        } else {

        }
    };
    //
    stctl.addTrack = function (lat, lng) {
        console.log("addUnit");
        DlgBx.prompt("No Track Selected .. Enter Name to Create Track", "").then(function (trackname) {
            var overwrite = null;
            var overwriteid = null;
            for (n = 0; n < stctl.missionlist.length - 1; n++) {
                if (newname === stctl.missionlist[n].value) {
                    overwrite = stctl.missionlist[n].value;
                    overwriteid = stctl.missionlist[n].value;
                }
            }
            if (overwrite !== null) {
                DlgBx.confirm("This Action will Overwrite Mission", overwrite).then(function (yes) {
                    if (yes) {
                        console.log("Save " + overwrite);
                        stctl.overwriteMission(overwrite);
                        stctl.currmission = currentmission;
                        stctl.loadMission({
                            id: overwriteid, name: overwrite
                        });
                    }
                });
            } else {
                console.log("Save " + newname);
                stctl.copyMission($scope.selmission.name, newname);
                stctl.missionlist.push({
                    id: stctl.missionlist.length - 1, name: newname
                });
                stctl.currmission = currentmission;
                stctl.loadMission(stctl.missionlist[stctl.missionlist.length - 1]);
            }
        });
    };
    stctl.addPolypoint = function (startpt, lat, lng) {
        if (GeoService.polypoints[stctl.polyselected._id]) {
            stctl.polypoints[stctl.polyselected._id] = GeoService.polypoints[stctl.polyselected._id];
        }
        if (!stctl.polypoints[stctl.polyselected._id]) {
            stctl.polypoints[stctl.polyselected._id] = [];
            stctl.polypoints[stctl.polyselected._id].push([startpt[0], startpt[1]]);
        }
        if (stctl.polypoints[stctl.polyselected._id].length === 0) {
            stctl.polypoints[stctl.polyselected._id].push([startpt[0], startpt[1]]);
        }
        stctl.polypoints[stctl.polyselected._id].push([lat, lng]);
        GeoService.polypoints[stctl.polyselected._id] = stctl.polypoints[stctl.polyselected._id];
        var obj = stctl.polypoints[stctl.polyselected._id];
        var len = obj.length;
        //console.log("len: " + len);
        if (len > 1) {
            var arr = [obj[len - 2][1], obj[len - 2][0], obj[len - 1][1], obj[len - 1][0]];
            GeoService.ppdatasources[$scope.selmission.name].entities.add({
                id: stctl.polyselected._id + 'PP' + stctl.polypoints[stctl.polyselected._id].length,
                polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArray(arr),
                    width: 1,
                    material: Cesium.Color.LIGHTYELLOW
                }
            });
            stctl.updateDb(stctl.polyselected._id, "polypoints", stctl.polypoints[stctl.polyselected._id]);
        }
    };
    stctl.removeLastPp = function () {
        stctl.polypoints[stctl.polyselected._id] = GeoService.polypoints[stctl.polyselected._id];
        if (stctl.polypoints[stctl.polyselected._id]) {
            if (stctl.polyselected && stctl.polypoints[stctl.polyselected._id].length > 1) {
                console.log("Remove Polypoint " + stctl.polyselected._id + 'PP' + stctl.polypoints[stctl.polyselected._id].length);
                GeoService.ppdatasources[$scope.selmission.name].entities.removeById(stctl.polyselected._id + 'PP' + stctl.polypoints[stctl.polyselected._id].length);
                stctl.polypoints[stctl.polyselected._id].splice(-1, 1);
                GeoService.polypoints[stctl.polyselected._id] = stctl.PP[stctl.polyselected._id];
                stctl.updateDb(stctl.polyselected._id, "polypoints", stctl.polypoints[stctl.polyselected._id]);
            }
        }
    };
    stctl.removeAllWp = function () {
        if (GeoService.polypoints[stctl.trackselected._id]) {
            stctl.polypoints[stctl.trackselected._id] = GeoService.polypoints[stctl.trackselected._id];
        }
        if (stctl.polypoints[stctl.trackselected._id]) {
            var len = stctl.polypoints[stctl.trackselected._id].length;
            for (ln = len; ln > 0; ln--) {
                GeoService.ppdatasources[$scope.selmission.name].entities.removeById(stctl.trackselected._id + 'PP' + ln);
            }
        }
        stctl.polypoints[stctl.trackselected._id] = [];
        GeoService.polypoints[stctl.trackselected._id] = [];
        stctl.updateDb(stctl.trackselected._id, "polypoints", stctl.polypoints[stctl.trackselected._id]);
    };
    //
    stctl.saveMission = function (currentmission) {
        console.log("saveMission");
        DlgBx.prompt("Enter Save As Name or Overwrite", currentmission.value).then(function (newname) {
            var overwrite = null;
            var overwriteid = null;
            for (n = 0; n < stctl.missionlist.length - 1; n++) {
                if (newname === stctl.missionlist[n].value) {
                    overwrite = stctl.missionlist[n].value;
                    overwriteid = stctl.missionlist[n].value;
                }
            }
            if (overwrite !== null) {
                DlgBx.confirm("This Action will Overwrite Mission", overwrite).then(function (yes) {
                    if (yes) {
                        console.log("Save " + overwrite);
                        stctl.overwriteMission(overwrite);
                        stctl.currmission = currentmission;
                        stctl.loadMission({
                            id: overwriteid, name: overwrite
                        });
                    }
                });
            } else {
                console.log("Save " + newname);
                stctl.copyMission($scope.selmission.name, newname);
                stctl.missionlist.push({
                    id: stctl.missionlist.length - 1, name: newname
                });
                stctl.currmission = currentmission;
                stctl.loadMission(stctl.missionlist[stctl.missionlist.length - 1]);
            }
        });
    };
    stctl.loadMission = function (nextmission) {
        console.log("loadMission " + nextmission.name);
        //console.log("Current Mission:" + stctl.currmission.value);
        $scope.netselected = [];
        viewer.dataSources.remove(GeoService.sdatasources[$scope.selmission.name]);
        viewer.dataSources.remove(GeoService.ppdatasources[$scope.selmission.name]);
        dB.openStore("Missions", function (store) {
            store.find(nextmission.name).then(function (sc) {
                stctl.entities = sc.data.Mission.Entities.Entity;
                GeoService.initGeodesy(nextmission.name, sc.data, $scope);
                stctl.currmission = nextmission;
                MsgService.setMission(nextmission.name, sc.data);
            });
        });
        $scope.selmission = nextmission;
    };
    stctl.hidePolypoints = function () {
        stctl.showPP = false;
        GeoService.hideAllPP();
    };
    stctl.showPolypoints = function () {
        console.log("showPolypoints");
        stctl.showPP = true;
        GeoService.showAllPP();
    };
    //
    stctl.clearDb = function () {
        console.log("Clear DB");
        DlgBx.confirm("Confirm Deletion of Local Data").then(function () {
            viewer.dataSources.remove(GeoService.sdatasources[$scope.selmission.name]);
            viewer.dataSources.remove(GeoService.ppdatasources[$scope.selmission.name]);
            dB.openStore('Resources', function (store) {
                store.clear();
            });
            dB.openStore('Mission', function (store) {
                store.clear();
            });
        });
    };
    stctl.exportMission = function () {
        console.log("exportMission");
        DlgBx.prompt("Enter Export Save As Name:", $scope.selmission.name).then(function (newname) {
            if (newname === 'Default Mission') {
                DlgBx.alert("You Can't' Overwrite the Default Mission");
            } else {
                var overwrite = null;
                for (n = 0; n < stctl.missionlist.length; n++) {
                    if (newname === stctl.missionlist[n].mission) {
                        overwrite = stctl.missionlist[n].mission;
                    }
                }
                if (overwrite !== null) {
                    DlgBx.confirm("This Action will Overwrite Mission", overwrite).then(function (yes) {
                        if (yes) {
                            console.log("Export " + overwrite);
                            dB.openStore("Missions", function (store) {
                                store.find(overwrite).then(function (scen) {
                                    var mission = scen.data;
                                    //console.log(mission);
                                    $http.put("/json/" + overwrite.replace(' ', '') + '.json', mission);
                                });
                            });
                        }
                    });
                } else {
                    console.log("Export " + newname);
                    dB.openStore("Missions", function (store) {
                        store.find($scope.selmission.name).then(function (scen) {
                            var mission = scen.data;
                            $http.post("/json/" + newname.replace(' ', '') + '.json', mission).success(function () {
                                console.log("Saved " + newname + " to /json/" + newname.replace(' ', '') + ".json");
                                stctl.missionlist.push({
                                    id: stctl.missionlist.length - 1, name: newname.replace(' ', '') + ".json", url: "/json/" + newname.replace(' ', '') + ".json"
                                });
                                dB.openStore('Resources', function (store) {
                                    store.upsert({
                                        name: "missions.json", url: "/json/missions.json", data: stctl.missionlist
                                    }).then(function () {
                                        store.find("missions.json").then(function (st) {
                                            $http.put('/json/missions.json', st.data);
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
    stctl.importMission = function () {
        stctl.import = true;
    };
    stctl.getFile = function (savedmission) {
        console.log("Get File: " + savedmission.name + ", " + savedmission.url);
        $http.get(savedmission.url).success(function (sdata) {
            DlgBx.prompt("Enter Save As Name or Overwrite", savedmission.mission).then(function (newname) {
                if (newname === "Default Mission") {
                    DlgBx.alert("You Can't' Overwrite the Default Mission");
                } else {
                    var overwrite = null;
                    var overwriteid = null;
                    for (i = 0; i < stctl.missionlist.length; i++) {
                        if (newname === stctl.missionlist[i].value) {
                            overwrite = stctl.missionlist[i].value;
                            console.log(overwrite);
                            overwriteid = stctl.missionlist[i].value;
                            break;
                        }
                    }
                    if (overwrite !== null) {
                        console.log(overwrite);
                        DlgBx.confirm("This Action will Overwrite Mission " + overwrite).then(function (yes) {
                            if (yes) {
                                stctl.mission = sdata;
                                stctl.overwriteMission(overwrite);
                            }
                        });
                    } else {
                        console.log("Save " + newname);
                        stctl.mission = sdata;
                        dB.openStore("Missions", function (store) {
                            store.insert({
                                name: newname, data: sdata
                            }).then(function () {
                                stctl.missionlist.push({
                                    id: stctl.missionlist.length - 1, name: newname
                                });
                                stctl.currmission = {
                                    id: stctl.missionlist.length - 1, name: newname
                                };
                                stctl.loadMission(savedmission);
                            });
                        });
                    }
                }
            });
        });
    };
    //
    stctl.updateDb = function (entityId, fieldname, value) {
        dB.openStore("Missions", function (store) {
            store.find($scope.selmission.name).then(function (mission) {
                stctl.mission = mission.data;
                for (i = 0; i < stctl.mission.Mission.Entities.Entity.length; i++) {
                    if (stctl.mission.Mission.Entities.Entity[i]._id === entityId) {
                        stctl.mission.Mission.Entities.Entity[i][fieldname] = value;
                    }
                }
            }).then(function () {
                store.upsert({
                    name: $scope.selmission.name, data: stctl.mission
                });
            });
        });
    };
    stctl.updateMission = function () {
        dB.openStore("Missions", function (store) {
            store.upsert({
                name: $scope.selmission.name, data: stctl.mission
            });
        });
    };
    stctl.copyMission = function (currentmission, newmissionid) {
        dB.openStore("Missions", function (store) {
            store.find(currentmission).then(function (mission) {
                store.insert({
                    name: newmissionid, data: mission.data
                });
            });
        });
    };
    stctl.overwriteMission = function (missionid) {
        console.log("overwriteMission: " + missionid);
        dB.openStore("Missions", function (store) {
            store.find(missionid).then(function () {
                store[ "delete"](missionid).then(function () {
                    store.insert({
                        name: missionid, data: stctl.mission
                    });
                });
            });
        });
    };
    stctl.deleteMission = function (currentmission) {
        if ($scope.selmission.id === 0) {
            DlgBx.alert("Can't delete Default Mission");
        } else {
            DlgBx.confirm("Confirm deletion of Mission: " + currentmission.value).then(function (yes) {
                console.log("Confirm response: " + $scope.selmission.id);
                if (yes && $scope.selmission.id !== 0) {
                    console.log("Delete from Idb: " + currentmission.value);
                    dB.openStore("Missions", function (store) {
                        store[ "delete"](currentmission.value);
                    });
                    var na = [];
                    for (i = 0; i < stctl.missionlist.length; i++) {
                        if (stctl.missionlist[i].value !== currentmission.value) {
                            na.push(stctl.missionlist[i]);
                        }
                    }
                    stctl.missionlist = na;
                    stctl.loadMission(stctl.missionlist[na.length - 1]);
                } else {
                }
            });
        }
    };
    //
    stctl.addFile = function (mission, filename, data) {
        $http.post("/json/" + filename, data).success(function () {
            console.log("Saved " + mission + " to /json/" + filename + ".json");
            stctl.missionlist.push({
                id: stctl.missionlist.length - 1, name: filename, url: "/json/" + filename
            });
            dB.openStore('Resources', function (store) {
                store.upsert({
                    name: "missions.json", url: resources[1], data: stctl.missionlist
                }).then(function () {
                    $http.post("/json/missions.json", stctl.missionlist).success(
                            function () {
                                console.log("Updated File List");
                            });
                });
            });
        });
    };
    stctl.overwriteFile = function (mission, filename, data) {
        $http.post("/json/" + filename, data).success(function () {
            console.log("Saved " + mission + " to /json/" + filename + ".json");
        });
    };
    //
    stctl.togglePolypoints = function () {
        if (stctl.showPP) {
            stctl.showPolypoints();
        } else {
            stctl.hidePolypoints();
        }
    };
    //
    stctl.sortByKey = function (array, key) {
        return array.sort(function (a, b) {
            var x = a[key];
            var y = b[key];
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        });
    };
    //
    stctl.syncResource = function (msnid, $http, url, dB, stctl, GeoService) {
        $http.get(url).success(function (resdata, status, headers) {
            var mod = headers()[ 'last-modified'];
            var filename = url.substring(url.lastIndexOf('/') + 1);
            var jdata = stctl.xj.xml_str2json(resdata);
            var mname = jdata.Mission._name;
            var jname = mname.replace(' ', '').toLowerCase();
            stctl.missionlist.push({
                id: msnid, name: mname, url: 'json/' + jname + '.json'
            });
            dB.openStore('Missions', function (mstore) {
                mstore.upsert({
                    name: mname, url: 'json/' + jname + '.json', data: jdata
                }).then(function () {
                    dB.openStore('Resources', function (store) {
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
                        if (filename === 'DefaultMission.xml') {
                            console.log('init geo');
                            stctl.mission = jdata;
                            stctl.entities = jdata.Mission.Entities.Entity;
                            GeoService.initGeodesy(jdata.Mission._name, jdata);
                            $scope.selmission.name = jdata.Mission._name;
                        }
                        ;
                    });
                });
            });

        }).error(function () {
            console.log('Error getting resource');
        });
    };
    //
    MsgService.socket.on('connection', function (data) {
        MsgService.serverid = data.socketid;
        MsgService.connectServer(data, $scope.selmission.name, stctl.mission);
    });
    MsgService.socket.on('track connected', function (data) {
        console.log("Unit connected " + data.id);
        MsgService.setMission($scope.selmission.name, stctl.mission);
        //msgctl.messages.push({text: "Unit " + data.socketid + " connected"});
    });
    MsgService.socket.on('init server', function (data) {
        console.log('init server: ' + data.missionid);
        $scope.selmission.name = data.scenarioname;
        $http.get('xml/missions.xml').success(function (resdata, status, headers) {
            var msns = stctl.xj.xml_str2json(resdata);
            for (i = 0; i < msns.Missions.Mission.length; i++) {
                var u = msns.Missions.Mission[i]._url;
                var n = msns.Missions.Mission[i]._name;
                console.log(n);
                if (u.substring(u.indexOf('.')) === '.xml') {
                    stctl.syncResource(msns.Missions.Mission[i]._id, $http, msns.Missions.Mission[i]._url, dB, stctl, GeoService);
                } else {
                    stctl.missionlist.push({
                        id: msns.Missions.Mission[i]._id, name: n, url: u
                    });
                    $http.get(u).success(function (jsondata, status, headers) {
                        dB.openStore('Missions', function (mstore) {
                            console.log(n);
                            mstore.upsert({
                                name: n, url: u, data: jsondata
                            });
                            $http.post("/json/missions.json", angular.toJson(stctl.sortByKey(stctl.missionlist, 'id')));
                        });
                    });
                }
            }
        });
    });
});
TacMapServer.controller('messageCtl', function ($indexedDB, $scope, $interval, GeoService, MsgService) {
    var msgctl = this;
    msgctl.dB = $indexedDB;
    msgctl.messages = [];
    msgctl.tracks = [];
    msgctl.sendReport = function (msgobj) {
        //default ui
        MsgService.sendMessage(msgobj, msgobj.network);
    };
    msgctl.moveUnit = function (uid, sentto, net, lat, lon) {
        console.log("moveUnit: " + uid);
        GeoService.sdatasources[$scope.selmission.name].entities.getById(uid).position = Cesium.Cartesian3.fromDegrees(lon, lat);
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
        GeoService.sdatasources[$scope.selmission.name].entities.getById(data.message.user).position = Cesium.Cartesian3.fromDegrees(data.message.position[1], data.message.position[0]);
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
    MsgService.socket.on("start mission", function () {
        msgctl.running = true;
        $scope.$apply();
    });
    MsgService.socket.on("stop mission", function () {
        msgctl.running = false;
        $scope.$apply();
    });
    MsgService.socket.on("set time", function (data) {
        msgctl.time = data.time;
        $scope.$apply();
    });
    //
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