# node-red-contrib-fred

Node built on top of the Node-Red core web socket node. It adds FRED user API key authentication headers to web socket messages to access private web socket listeners on FRED.

The package.json file contains a config property 'hostType' that can be 'client' (default) or 'server'.

To configure FRED nodes to run on a FRED server, execute this before installing:

npm config set node-red-contrib-fred:hostType server

Setting to client (default) will ensure only the fred-client nodes are available for connecting to FRED from a device like a PC or Pi.  When set to server, only the fred-server nodes will be available (for FRED deployment).

During the postinstall phase, the rewriteHtml.js script runs to modify the fred.html code.



