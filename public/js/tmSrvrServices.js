/* global TacMapServer, TacMapUnit */
// ***** SERVER SERVICES ******//
TacMapServer.factory('GeoService', function () {
    var geosvc = {
    };
    geosvc.entities =[];
    geosvc.missionid = null;
    geosvc.sdatasources =[];
    geosvc.polypoints =[];
    geosvc.ppdatasources =[];
    geosvc.initGeodesy = function (missionid, missiondata) {
        console.log("initGeodesy " + missionid);
        geosvc.missionid = missionid;
        geosvc.sdatasources[geosvc.missionid] = new Cesium.CustomDataSource(geosvc.missionid);
        viewer.dataSources.add(geosvc.sdatasources[geosvc.missionid]);
        geosvc.ppdatasources[geosvc.missionid] = new Cesium.CustomDataSource(geosvc.missionid + "PP");
        viewer.dataSources.add(geosvc.ppdatasources[geosvc.missionid]);
        //console.log(missiondata);
        var polygons = missiondata.Mission.Polygons.Polygon;
        var entities = missiondata.Mission.Entities.Entity;
        geosvc.entities = missiondata.Mission.Entities.Entity;
        geosvc.addPolygons(polygons);
        geosvc.addEntities(entities);
        //console.log(geosvc.movementsegments);
        viewer.zoomTo(geosvc.sdatasources[geosvc.missionid].entities.getById("Default"));
    };
    geosvc.addEntities = function (entities) {
        //console.log('addEntities ' + entities.length);
        for (i = 0; i < entities.length; i++) {
            if (entities[i]._location.length > 0) {
                geosvc.addCesiumBillBoard(entities[i]);
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
    geosvc.addStoredPolypoints = function (entity) {
        //console.log("addStoredWaypoints: " + entity._id);
        var w = entity.polypoints;
        var uid = entity._id;
        geosvc.polypoints[uid] =[];
        geosvc.polypoints[uid].push(w[0]);
        for (p = 1; p < w.length; p++) {
            geosvc.polypoints[uid].push(w[p]);
            var arr =[w[p - 1][1], w[p - 1][0], w[p][1], w[p][0]];
            geosvc.ppdatasources[geosvc.missionid].entities.add({
                id: uid + 'PP' + geosvc.polypoints[uid].length,
                polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArray(arr),
                    width: 1,
                    material: Cesium.Color.LIGHTYELLOW
                }
            });
        }
    };
    geosvc.addPolygons = function (polygons) {
        for (i = 0; i < polygons.length; i++) {
            if (polygons[i]._locations.length > 0) {
                geosvc.addCesiumPolygon(polygons[i]);
            }
        }
    };
    geosvc.addCesiumPolygon = function (poly) {
        //console.log('addPolygon');
        var loc = poly._locations;
        //console.log(loc);
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        //Cartesian wants long, lat
        geosvc.sdatasources[geosvc.missionid].entities.add({
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
        //console.log('addPolygon');
        var loc = poly._locations;
        //console.log(loc);
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        //Cartesian wants long, lat
        geosvc.sdatasources[geosvc.missionid].entities.add({
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
    geosvc.addCesiumBillBoard = function (entity) {
        var loc = entity._location;
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        geosvc.sdatasources[geosvc.missionid].entities.add({
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
    msgsvc.missionid;
    msgsvc.connected = false;
    msgsvc.sending = false;
    msgsvc.lastSendingTime = 0;
    msgsvc.users =[];
    msgsvc.socket = io();
    // Sends a message
    msgsvc.setMission = function (name, missiondata) {
        msgsvc.socket.emit('set mission', {
            missionid: name, missiondata: missiondata
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
    msgsvc.connectServer = function (data, sname, missionjson) {
        console.log(data.message + " " + data.socketid);
        msgsvc.connected = true;
        msgsvc.missionid = sname;
        //console.log(missionjson);
        msgsvc.socket.emit('server connected', {
            message: 'server', socketid: data.socketid, missionid: msgsvc.missionid, missiondata: missionjson
        });
    };
    msgsvc.disconnectServer = function (data) {
        console.log("Server Disconnected " + data.socketid);
        msgsvc.connected = false;
        msgsvc.socket.emit('server disconnected', {
            message: 'server', socketid: data.socketid, mission: msgsvc.missionid
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