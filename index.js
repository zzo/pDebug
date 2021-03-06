var pDebug = function(obj) {
    this.port = obj && obj.port || 5858;
    this.host = obj && obj.host || 'localhost';
    this.seq  = 0;
    this.outstandingRequests = {};
    this.eventHandler = obj && obj.eventHandler;
};

pDebug.prototype = {
    connect: function(callback) {
        var net             = require('net')
            , inHeader      = true
            , body          = ''
            , currentLength = 0
            , _this         = this
        ;

        this.client = net.connect(this.port, this.host, callback);

        this.client.on('data', function(data) {
            var lines = data.toString().split('\r\n')
                , response
                , requestSeq
                , req
            ;

            lines.forEach(function(line) {
                var vals;

                if (!line) { 
                    inHeader = false;
                    return;
                }

                if (inHeader) {
                    vals = line.split(':');
                    if (vals[0] === 'Content-Length') {
                        currentLength = parseInt(vals[1], 10);
                    }
                } else {
                    body += line;
                }
            });

            if (body.length === currentLength) {
                inHeader = true;
                if (body) {
                    response = JSON.parse(body);
                    requestSeq = response.request_seq;
                    if (_this.outstandingRequests[requestSeq]) {
                        req = _this.outstandingRequests[requestSeq];
                        if (req.callback) {
                            req.callback.call(req.thisp || _this, req, response);
                        }
                        delete _this.outstandingRequests[requestSeq];
                    } else {
                        if (response.type === 'event' && _this.eventHandler) {
                            _this.eventHandler.call(_this, response);
                        } else if (response.type !== 'event') {
                            console.log('unknown/unexpected message from server!');
                            console.log(response);
                        } else {
                            // an event w/no event listener - eat it
                        }
                    }
                    body = '';
                }
            } 
        });

        this.client.on('end', function() {
          console.log('client disconnected');
        });
     }
    , disconnect: function() {
        this.client.end();
    }
    , send: function(obj, callback, thisp) {
        var str
            , cL = "Content-Length:"
        ;

        obj.seq = ++this.seq;
        obj.type = 'request';

        str = JSON.stringify(obj);
        this.client.write(cL + str.length + "\r\n\r\n" + str);

        obj.callback   = callback;
        obj.thisp      = thisp;
        this.outstandingRequests[this.seq] = obj;

    }
};

module.exports = {
    pDebug: pDebug
};
