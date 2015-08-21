var http = require("http");
var os = require("os");
var exec = require('child_process').exec;

var CPU_TOTAL = 0, CPU_IDLE = 0;
var CACHE_MESSAGE = "";
var BANDWIDTH_LIMIT = 1024; // GiB. $5 plan DigitalOcean Bandwidth limit

// Information if the server runs on Nginx. If there is no Basic HTTP Authentication, don`t change the values for user and pass.
var NGINX = {
	hostname: "127.0.0.1",
	port: 80,
	path: "/status",
	authentication: {
		user: "USER",
		pass: "PASS"
	}}; // The page that shows information of the stub_status module.

var HTTP_PORT = 8081;
var SOCKET_IO_PORT = 3000;
var INTERVAL = 1000; // The interval in milliseconds between each update

var parseResponse = function(response, format, message) {
	if (format === "json") {
		response.setHeader("Content-Type", "application/json; charset=utf-8");
		response.setHeader("Canche-Control", "no-store");
		response.setHeader("Access-Control-Allow-Origin", "*");
		
		response.end(JSON.stringify(message));
	} else {
		throw "The specified format is not implemeted.";
	}
}

//callback(uptime)
//uptime {seconds, formated}, formated = weeks, days, hours, minutes, seconds, milliseconds
var getUptime = function(callback) {
	var uptime = os.uptime(); // uptime in seconds
	var periods = ["week", "day", "hour", "minute", "second", "millisecond"];
	var period_seconds = [604800, 86400, 3600, 60, 1, 0.001];
	var up = uptime;
	var formated = "";
	var temp;
	
	(function loop(i, limit) {
		if (i === limit) {
			callback({seconds: uptime, formated: formated.trim()});
		} else {
			if (up >= period_seconds[i]) {
				temp = parseInt(up/period_seconds[i]);
				formated += temp + " "+periods[i]+"(s) ";
				up -= temp * period_seconds[i];
			}
			loop(++i, limit);
		}
	})(0, periods.length);
};

// callback(cpuInfo)
// cpuInfo {cpu_usage, cpus} cpu_usage = %
var getCpuInfo = function(callback) {
	var cpuInfo = {};
	
	exec("./cpu_usage "+CPU_TOTAL+" "+CPU_IDLE, function(error, stdout, stderr) {
		if (error || stderr) {
			callback(error || stderr);
			return;
		}
		
		var cpu_variables = /(\d+) (\d+) (\d+)/.exec(stdout);
		var cpu_usage = cpu_variables[1];
		CPU_TOTAL = cpu_variables[2];
		CPU_IDLE = cpu_variables[3];
		
		cpuInfo.cpu_usage = cpu_usage;
		cpuInfo.cpus = os.cpus();
		
		callback(cpuInfo);
	})
}

// callback(info)
// info {active_connections, accepted_connections, handled_connections, requested_connections, reading, writing, waiting}
var getNginxInfo = function(callback) {
	var options = {
		hostname: NGINX.hostname,
		port: NGINX.port,
		path: NGINX.path,
		headers: {
			Authorization: "Basic " + new Buffer(NGINX.authentication.user+":"+NGINX.authentication.pass).toString("base64")
		}
	};
	
	http.request(options, function(res) {
		var data = "";
		
		res.on("data", function(chunk) {
			data += chunk;
		}).on("end", function() {
			data = /[^0-9]*(\d+)+[^0-9]*(\d+)[^0-9]*(\d+)[^0-9]*(\d+)[^0-9]*(\d+)[^0-9]*(\d+)[^0-9]*(\d+)/.exec(data).slice(1,8);
			
			var info = {
				active_connections: data[0],
				accepted_connections: data[1],
				handled_connections: data[2],
				requested_connections: data[3],
				reading: data[4],
				writing: data[5],
				waiting: data[6]
			};
			
			callback(info);
		});
	}).on("error", function(err) {
		callback("Information not retrieved");
	}).end();
}

// calback(memory);
// memory {ram, buffer, swap}
var getMemory = function(callback) {
	var total = os.totalmem();
	var free = os.freemem();
	var used = total - free;
	var memories = {};
	
	exec("free", function (error, stdout, stderr) {		
		var ram = []; //[total, used, free]
		var buffer = [];
		var swap = [];
		
		if (error || stderr) {
			callback(error || stderr);
		} else {
			ram = /Mem:[^0-9]+(\d+)[^0-9]+(\d+)[^0-9]+(\d+)/.exec(stdout).slice(1,4);
			buffer = /cache:[^0-9]+(\d+)[^0-9]+(\d+)/.exec(stdout).slice(1,4);
			swap = /Swap:[^0-9]+(\d+)[^0-9]+(\d+)[^0-9]+(\d+)/.exec(stdout).slice(1,4);
			
			memories.ram = ram && {total: ram[0], used: ram[1], free: ram[2]};
			memories.buffer = buffer && {total: +buffer[0] + +buffer[1], used: buffer[0], free: buffer[1]};
			memories.swap = swap && {total: swap[0], used: swap[1], free: swap[2]};
			
			callback(memories);
		}
	});
}

// callback(bandwidth)
// bandwidth {start_date, used:{received, transferred}}
// all the data is in GB
var getBandwidth = function(callback) {
	var start_date = "-";
	
	// callback(sizeConverted)
	var convertToGB = function(size, unit, callback) {
		var sizeConverted = NaN;
		
		if (unit === "KiB") {
			sizeConverted = size / (1024*1024);
		} else if (unit === "MiB") {
			sizeConverted = size/1024;
		} else if (unit === "GiB") {
			sizeConverted = size;
		} else if (unit === "TiB") {
			sizeConverted = size * 1024;
		}
		
		callback(sizeConverted);
	}
	
	exec("vnstat -m", function(error, stdout, stderr) {
		stdout = stdout.split("\n")[5].trim();

		var bandwidth = /(.{6,7})[^0-9]+([0-9.]+ [^ ]+)[^0-9]+([0-9.]+ [^ ]+)[^0-9]+([0-9.]+ [^ ]+)/g.exec(stdout).slice(1,5);
		
		var start_date = bandwidth[0];
		var received = bandwidth[1].split(" "); // [size, unit]
		var transferred = bandwidth[2].split(" ");
		var total = bandwidth[3].split(" ");
		convertToGB(+received[0], received[1], function(received) {
			convertToGB(+transferred[0], transferred[1], function(transferred) {
				convertToGB(+total[0], total[1], function(total) {
					bandwidth = {
						start_date: start_date,
						used: {
							received: received,
							transferred: transferred,
							total: total
						}
					}
					
					callback(bandwidth);
				});
			});
		});
	});
}

//callback(loadAvg)
//loadAvg {1min, 5min, 15min}
var getLoadAvg = function(callback) {
	var load = os.loadavg();
	
	callback({"1": load[0], "5": load[1], "15": load[2]});
}

var apiGET = function(req, res) {
	if (req.url === "/") {
		res.statusCode = 200;
		
		parseResponse(res, "json", CACHE_MESSAGE);
	} else {
		res.statusCode = 400;
		
		parseResponse(res, "json", {error: "This API doesn't have the resource " + req.url.split("?")[0]});
	}
}

var server = http.createServer(function(req, res) {
	if (req.method === "GET") {
		apiGET(req, res);
	} else {
		res.statusCode = 400;
		parseResponse(res, "json", {error: "This API doesn't work with the method " + req.method});
	}
});
server.listen(HTTP_PORT);

var io = require("socket.io").listen(SOCKET_IO_PORT);

io.on("connection", function(socket) {
	socket.on("BANDWIDTH_LIMIT", function(limit) {
		if (+limit > 0)
			BANDWIDTH_LIMIT = limit;
	});
});

setInterval(function() { // It updates the system information each INTERVAL seconds. When a request is received, the API only returns the stored info.
	getUptime(function(uptime) {
		getBandwidth(function(bandwidth) {
			getNginxInfo(function(nginxInfo) {
				getCpuInfo(function(cpuInfo) {
					getLoadAvg(function(loadAvg) {
						getMemory(function(memory) {
							var message = {
								uptime: uptime,
								cpu: cpuInfo,
								load_average: loadAvg,
								nginx: nginxInfo,
								memory: memory,
								bandwidth: bandwidth
							};							
							message.bandwidth.limit = BANDWIDTH_LIMIT;
							
							CACHE_MESSAGE = message;

							io.emit("system_performance", message);
						});
					})
				});
			});
		});
	})
}, INTERVAL);
