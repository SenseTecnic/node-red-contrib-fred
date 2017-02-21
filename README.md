# node-red-contrib-fred

This module provides a set of nodes for making it easier to connect to a FRED instance from a device like a Raspberry Pi.  

These nodes currently connect to FRED using web sockets.  These nodes are based on the built in web sockets modules that come with Node-RED.  As FRED evolves, the method of connecting to a FRED-hosted Node-RED may change.  Using these nodes will make sure your device flows will continue to connect to FRED using the most well supported protocol.

You can find detail tutorial of this node from [here](http://developers.sensetecnic.com/article/tutorial-connecting-device-node-red-to-cloud-node-red/).

## Install

```
cd ~/.node-red
npm install node-red-contrib-fred
```

Open your Node-RED instance and you should have a FRED input and output node available in the input and output categories.

## Connecting to FRED

On FRED, create an named endpoint for your Pi or PC to connect to.  For example, the following flow creates a private FRED input endpoint node called 'example' connected to a debug output node.

```
[{"id":"a7028d68.57b46","type":"fred-server","z":"dfb73258.cc266","endpoint":"example","private":true,"wholemsg":"false"},{"id":"629ac252.a200ac","type":"debug","z":"dfb73258.cc266","name":"","active":true,"console":"false","complete":"false","x":417.5,"y":274,"wires":[]},{"id":"76df0c2e.be7f14","type":"fred in","z":"dfb73258.cc266","name":"","server":"a7028d68.57b46","client":"","x":183,"y":274,"wires":[["629ac252.a200ac"]]}]
```

On your Pi or PC, create an endpoint with the same name that sends data to the FRED endpoint.

```
[{"id":"15d1c0df.836f1f","type":"fred-client","z":"a832565d.979308","endpoint":"example","private":true,"username":"mike","apikey":"api-key","wholemsg":"false"},{"id":"6b89d3c1.57de3c","type":"fred out","z":"a832565d.979308","name":"","server":"","client":"15d1c0df.836f1f","x":402,"y":280,"wires":[]},{"id":"780979d5.8621e8","type":"inject","z":"a832565d.979308","name":"","topic":"asdfasf","payload":"fasdfsaf","payloadType":"str","repeat":"","crontab":"","once":false,"x":185,"y":246,"wires":[["6b89d3c1.57de3c"]]}]
```

Note that if you create a public endpoint on FRED, the client  only needs your user name to access the FRED endpoint in your instance.  Replace the text 'api-key' in the flow above with your own API key before importing to your local Node-RED.

## Installing on FRED

This information only applies to installing these nodes on the FRED host, and is here (mostly) for FRED licensees.

The package.json file contains a config property 'hostType' that can be 'client' (default) or 'server'.

To configure FRED nodes to run on a FRED server, execute this before installing:

npm config set node-red-contrib-fred:hostType server

Setting to client (default) will ensure only the fred-client nodes are available for connecting to FRED from a device like a PC or Pi.  When set to `server`, only the fred-server nodes will be available.

During the postinstall phase, the rewriteHtml.js script runs to modify the fred.html code to indicate whether the client or server nodes should be made available in Node-RED.

Note that the FRED protocol and host is in the package.json file.  Change it after installation to run against test servers or other FRED deployments.

## Developers

```
cd ~\.node-red\node-modules
git clone https://github.com/SenseTecnic/node-red-contrib-fred.git
cd node-red-contrib-fred
npm install
```
