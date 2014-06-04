
module.exports = CrowdProcess;

function CrowdProcess(token, program, data, onData, onEnd, onError) {

    createJob(program, function(jobId) {
        getErrors(jobId, onError);
        getResults(jobId, data.length, onData);
        createTasks(jobId);
    });

    function createJob(program, cb) {
        var payload = JSON.stringify({
            "program": program
        });

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.crowdprocess.com/jobs', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader("Authorization", "Token " + token);

        xhr.onreadystatechange = function() {
            if(xhr.readyState == 4 && xhr.status == 201) {
                var res = JSON.parse(xhr.responseText);
                if(cb) {
                    cb(res.id);
                }
            }
        };
        xhr.onerror = function(error) {
            console.error(xhr.statusText);
            if(onError) {
                onError(error);
            }
        };
        xhr.send(payload);
    }

    function createTasks(jobId) {
        var payload = data.map(JSON.stringify).join('\n');

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.crowdprocess.com/jobs/' + jobId + '/tasks', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader("Authorization", "Token " + token);

        xhr.onerror = function(error) {
            console.error(xhr.statusText);
            if(onError) {
                onError(error);
            }
        };
        xhr.send(payload);
    }

    function getErrors(jobId, cb) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.crowdprocess.com/jobs/' + jobId + '/errors?stream=true');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader("Authorization", "Token " + token);
        xhr.seenBytes = 0;

        xhr.onreadystatechange = function() {
            if(xhr.readyState > 2) {
                var newData = xhr.responseText.substr(xhr.seenBytes);
                
                var lastIndex = newData.lastIndexOf('\n') + 1; // include '\n'
                if(lastIndex > 0) {
                    var lines = newData.substring(0, lastIndex).split(/\r?\n/);
                    lines.pop();
                    lines.map(function(data) {
                        onError(JSON.parse(data));
                    });
                    xhr.seenBytes += lastIndex; 
                }
            }
        };

        xhr.send();
    }

    function getResults(jobId, nTasks, cb) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://api.crowdprocess.com/jobs/' + jobId + '/results?stream=true');
        xhr.setRequestHeader("Authorization", "Token " + token);
        xhr.seenBytes = 0;

        var timer = setInterval(handle, 300);

        // xhr.onreadystatechange =
        function handle() {
            if(xhr.readyState > 2) {
                var newData = xhr.responseText.substr(xhr.seenBytes);
                /*
                var lastIndex = newData.lastIndexOf('\n') + 1; // include '\n'
                if(lastIndex > 0) {
                    var lines = newData.substring(0, lastIndex).split(/\r?\n/);
                    lines.pop();
                    lines.map(function(data) {
                        onData(JSON.parse(data));
                        nTasks--;
                    });
                    xhr.seenBytes += lastIndex; 
                }
                */
                for(var begin = 0, end = newData.indexOf('\n') + 1; end > 0; end = newData.indexOf('\n', begin) + 1) {
                    var data = newData.substr(begin, end - begin);
                    onData(JSON.parse(data));
                    nTasks--;
                    xhr.seenBytes += end - begin;
                    begin = end;
                }
            }
            if(nTasks == 0) {
                xhr.abort();
                clearInterval(timer);
                if(onEnd) {
                    onEnd();
                }
            }
        };

        xhr.send(null);
    }
}