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
/* global Cesium, angular, stctl */
var databasename = "tacmapPliDb";
var storestructure = [
    ['Resources', 'id', true, [['url', 'url', true], ['lastmod', 'lastmod', false], ['data', 'data', false]]],
    ['Maps', 'id', true, [['url', 'url', false], ['lastmod', 'lastmod', false], ['data', 'data', false]]],
    ['User', 'id', true, [['data', 'data', false]]]
];

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3MTg2YTliMi05YWYzLTQ0MzgtYWRjNS01NjRlOGY4NjgwZGUiLCJpZCI6ODU3Nywic2NvcGVzIjpbImFzciIsImdjIl0sImlhdCI6MTU1MjMyNzk0Mn0.-bqHZmN7eaGyZPP_tSEklGadxL9WTBJLEfiQkd0fFkw';
var compression = false;
var viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    timeline: false,
    infoBox: false,
    selectionIndicator: true,
    baseLayerPicker: true,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    /*  imageryProvider: new Cesium.BingMapsImageryProvider({
         url: '//dev.virtualearth.net',
         key: 'AtO-6nT2HLG-BF4IvAbGvEppiYqeW9W4KSemE-7wVH_9GgWnThseKQdwe4-xj-S0',
         mapStyle: Cesium.BingMapsStyle.AERIAL_WITH_LABELS
     }), */
    imageryProvider: new Cesium.BingMapsImageryProvider({
        url: '//dev.virtualearth.net',
        key: 'Av-awJpLri3lhryWXBPHSNRjL8J6AGncSSvX8VNSlk2ESgesZhwkfCh8a0EX0n1i',
        mapStyle: Cesium.BingMapsStyle.AERIAL_WITH_LABELS
    }),
    homeButton: false,
    geocoder: false
    /*  imageryProvider: new Cesium.GoogleEarthEnterpriseMapsProvider({
         url: "https://earth.localdomain"
     }), */
    /* imageryProvider: new Cesium.BingMapsImageryProvider({
        url: '//dev.virtualearth.net',
        key: 'AtO-6nT2HLG-BF4IvAbGvEppiYqeW9W4KSemE-7wVH_9GgWnThseKQdwe4-xj-S0',
        mapStyle: Cesium.BingMapsStyle.AERIAL_WITH_LABELS
    }), */
});
var scene = viewer.scene;
var TacMap = angular.module("TacMap", ["indexedDB"]);
var msgLog = "views/msgLog.html";
var mapStore = "views/mapStore.html";
var userProfile = "views/userProfile.html";
var mapEntities = "views/mapEntities.html";
var userdata = [];

TacMap.config(function ($indexedDBProvider) {
    $indexedDBProvider.connection(databasename).upgradeDatabase(1, function (event, db, tx) {
        console.log("initDb");
        for (var i = 0; i < storestructure.length; i++) {
            //console.log("add store " + storestructure[i][0] + " key:" + storestructure[i][1] + " autoinc:" + storestructure[i][2]);
            var objectStore = db.createObjectStore(storestructure[i][0], {
                keyPath: storestructure[i][1], autoIncrement: storestructure[i][2]
            });
            var indices = storestructure[i][3];
            for (var j = 0; j < indices.length; j++) {
                //console.log("add index " + indices[j][0] + " ref:" + indices[j][1] + " unique:" + indices[j][2]);
                objectStore.createIndex(indices[j][0], indices[j][1], {
                    unique: indices[j][2]
                });
            }
        }
    });
});

