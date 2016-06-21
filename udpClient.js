#!/user/bin/env node

// Require the dgram module     
var dgram = require('dgram');
var udpPort= 33333;

client = dgram.createSocket('udp4');

//client.bind(udpPort);

// Accept input  via standard input
process.stdin.resume();

// Listen for incoming standard input
process.stdin.on('data', function (data) {
    // Send all data to the client.
    //client.setBroadcast(true);
    client.send(data, 0,data.length,udpPort,'192.168.225.5');
});

// Listen for messages from client
client.on('message', function (message) {
    console.log("Client: " + message.toString());
});

console.log("To send a message, " +
    "type now and press return.");