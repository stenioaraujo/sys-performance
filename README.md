Sys-Performance
===============
Sys-Performance is a simple system monitor for Ubuntu and Nginx. It uses Node.js and shell commands to retrieve CPU, ram, bandwidth and Nginx information.  The app works as an API and as a Socket.io server. For accessing the API one only needs to access the server at the chosen port. For using the Socket.io implementation one needs to set up the client folder in a webserver and/or locale. Although the API shows more information than the client page, the client page keeps you updated with real-time information about your server. Please let me know any issue.

Client's interface
------------------

![Client's interface](https://lh3.googleusercontent.com/l1g34wmHJuV2sYJHtB2k1YCW9VkGfzmVauDzbv_5ibI=w1202-h609-no)

Installation
------------

First of all, the app relies upon some CLI commands. Although a basic Ubuntu installation has the ***free*** command, it is still necessary to install ***vnstat***. The app also uses a third developed software ***cpu_usage*** that should go together with the ***server.js***. That cpu_usage was created by [Paul Colby](http://colby.id.au).

 - Dependencies
	 - vnstat
	 - Node.js
	 - npm

Make sure to install all the dependencies before continuing.

    sudo apt-get install nodejs npm vnstat

The app also relies upon the Nginx module ***stub_status*** to work fully. If you don`t have a Nginx webserver and/or the ***stub_status*** module on, The Nginx option will not show a valid information.
For default the app retrieves the ***stub_status*** information from the path ***/status*** (if it is another one, change the variable ***NGINX.path*** in the ***server.js***) from ***127.0.0.1*** (the server where the app is).

> If you wanna turn on the ***stub_status*** module on your Nginx server, follow [this link](http://nginx.org/en/docs/http/ngx_http_stub_status_module.html).

Server
------
Clone this repository in your server and open the folder ***server***. Then install the dependencies that are described within the ***package.json*** file. For that you only need to run:

    npm install

Now it is ready to be executed:

    npm start

If you don`t change any default value, the API is visible at http://your_server:8081

Client
------
The client folder can localized in any webserver, or you may put it in your local computer. It is necessary to updated your server address in the ***index.html***. Where there are ***THE_SERVER_IP/HOSTNAME_HERE***, put your server address.
Well done, the client is ready to connect to the socket.io server.
