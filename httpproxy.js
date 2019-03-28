var http = require('http');
var net = require('net');
var url = require('url');

var BROWSER_LOCAL_PORT = 6511; //local port for http proxy
var SERVER_REMOTE_PORT = 8893;//amazon open port
//var SERVER_SOKET_PROXY_ADDR = '127.0.0.1';
var SERVER_SOKET_PROXY_ADDR = 'xx';//'amazaon server ip';
var HTTP_PROXY_PORT = 9999;
var command = 'localhost';//default command

process.on('uncaughtException', function (err) {
    console.log('\nError!!!!');
    console.log(err);
});

function usage(hostprocess, scriptfile) {
    console.log('usage:');
    var hostandscript = hostprocess + ' ' + scriptfile;
    console.log('\t' + hostandscript + '  localhost');
    console.log('\t' + hostandscript + '  proxy');
}

if (process.argv.length >= 3) {
    command = process.argv[2];
}

if (command === 'localhost') {
    socketProxyListen(BROWSER_LOCAL_PORT, SERVER_REMOTE_PORT, SERVER_SOKET_PROXY_ADDR);
} else if (command === 'proxy') {
    httpProxyListen(HTTP_PROXY_PORT);
    socketProxyListen(SERVER_REMOTE_PORT, HTTP_PROXY_PORT, '127.0.0.1');
} else {
    usage(process.argv[0], process.argv[1]);
    return;
}

function en_de_crypt(data) {
    for (var i = 0; i < data.length; i++) {
        data[i] += 128;
    }
    return data;
}

function httpProxyListen(httpListenPort) {
    function request(cReq, cRes) {
        var reqUrl = url.parse(cReq.url);
        console.log('request url = ' + reqUrl.hostname + reqUrl.path);
        //remove connection header
        delete cReq.headers['connection'];
        delete cReq.headers['proxy-connection'];
        delete cReq.headers['Keep-Alive'];
        cReq.headers['Connection'] = 'close';
        var options = {
            hostname: reqUrl.hostname,
            port: reqUrl.port || 80,
            path: reqUrl.path,
            method: cReq.method,
            headers: cReq.headers
        };
        var pReq = http.request(options, function (pRes) {
            cRes.writeHead(pRes.statusCode, pRes.headers);
            pRes.pipe(cRes);
        }).on('error', function (e) {
            console.log('pReq error');
            cRes.end();
        });

        cReq.pipe(pReq);
    }

    function connect(cReq, cSock) {
        var reqUrl = url.parse('http://' + cReq.url);
        console.log('connect url = ' + reqUrl.hostname);

        var pSock = net.connect(reqUrl.port, reqUrl.hostname, function () {
            //cSock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            cSock.write('HTTP/1.1 200 Connection established\r\nConnection: close\r\n\r\n');
            pSock.pipe(cSock);
        }).on('error', function (e) {
            cSock.end();
        });
        cSock.pipe(pSock);
    }

    http.createServer()
        .on('request', request)
        .on('connect', connect)
        .listen(httpListenPort, '0.0.0.0');
    console.log('HTTP server accepting connection on port: ' + httpListenPort);
}

function socketProxyListen(socketPort, nextProxyPort, nextProxyAddr) {
    var server = net.createServer(function (socket) {
        socket.pause();
        var serviceSocket = new net.Socket();
        serviceSocket.connect(parseInt(nextProxyPort), nextProxyAddr, function () {
            socket.resume();
        });
        serviceSocket.on('data', function (data) {
            socket.write(en_de_crypt(data));
        }).on('close', function () {
            console.log('service disconnected from proxy');
            socket.end();
        }).on('error', function (err) {
            console.log('service Error: ' + err.toString());
            socket.end();
        });

        socket.on('data', function (data) {
            serviceSocket.write(en_de_crypt(data));
        }).on('close', function () {
            console.log('Client disconnected from Browser');
            serviceSocket.end();
        }).on('error', function (err) {
            console.log('Browser socket Error: ' + err.toString());
            serviceSocket.end();
        });
    });

    server.listen(socketPort);
    console.log('TCP server accepting connection on port: ' + socketPort);
}
