const SERVER_URL = 'http://54.218.38.47/';
const LOCATIONS= {'wpt_agent_north_virginia_wptdriver': 'N. Virginia',
    'wpt_agent_oregon_wptdriver': 'Oregon',
    'agent_california_wptdriver': 'California',
    'agent_ohio_wptdriver': 'Ohio'};
let pendingKeys = [];

function hitServer() {
    toggleLoader();
    pendingKeys = [];
    let url_ids = {};
    getURLs().then((urls) => {
        if (!urls.length) {
            alert('Please select a text file with urls');
            return;
        }
        let fullURLs = getFullURls(urls);
        $('.status').html("Pending request: " + fullURLs.length);
        Promise.all(fullURLs.map(fetch)).then((values) => {
            let pendingDownloads = [];
            _.forEach(values, (val) => {
                url_ids[val[0]] = val[1];
                pendingKeys.push(val[0]);
            });
            const intervalID = setInterval(() => {
                Promise.all(pendingKeys.map(process)).then((vals) => {
                    _.forEach(vals, (val) => {
                        _.pull(pendingKeys, val);
                        if (val) pendingDownloads.push(val);
                    });
                    $('.status').html("Pending request: " + pendingKeys.length);
                    if (!pendingKeys.length) {
                        clearInterval(intervalID);
                        //$('#container').append($('<button onclick="download()">Download</button>'));
                        batchDownload(pendingDownloads);
                    } else {
                        console.log('wait....')
                    }
                });
            }, pendingKeys.length * 500);
        })
    });
}
function cancelPending() {
    _.forEach(pendingKeys, (key) => {
        let cancelURL = SERVER_URL + 'cancelTest.php?test=' + key;
        $.get(cancelURL);
    });
}
function toggleLoader() {
    $('.toggle').toggleClass('hide');
}
function getFullURls(urls) {
    let prefix = SERVER_URL + 'runtest.php?priority=6&runs=1&mv=1&video=0&f=xml&fvonly=1&k=33f6b472561edfcf6130b2a65b687104f9ed5d62&url=';
    let encodedURL;
    let fullList = [];
    _.forEach(urls, (url) => {
        if (url) {
            encodedURL = prefix + encodeURIComponent(url);
            _.forEach(_.keys(LOCATIONS), (location) => {
                fullList.push(encodedURL + '&location=' + location + '.Cable');
            })
        }
    });
    return fullList;
}

function getURLs() {
    let file = document.getElementById('file').files[0];
    return new Promise((resolve, reject) => {
        if (file) {
            let reader = new FileReader();
            reader.readAsText(file, "UTF-8");
            reader.onload = function (evt) {
                resolve(_.split(evt.target.result, '\n'));
            };
            reader.onerror = function (evt) {
                resolve([]);
            }
        } else {
            resolve([]);
        }
    })
}

/*function readTextFile(file) {
    let rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status === 0)
            {
                let allText = rawFile.responseText;
                alert(allText);
            }
        }
    }
    rawFile.send(null);
}*/
function process(id) {
    let checkURL = SERVER_URL + 'testStatus.php?test=' + id;
    return new Promise((resolve, reject) => {
        $.get(checkURL, (data, status) => {
            if (status === 'success') {
                if (data.statusCode === 200 || data.statusCode === 402) {
                    resolve(id);
                }
                resolve();
            }
        }, 'json')
    })
}

function convertToCSV(objArray) {
    let array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let headers = ['url', 'summary', 'location', 'loadTime'];
    array.unshift(headers);
    let result = "data:text/csv;charset=utf-8,";
    for (let i = 0; i < array.length; i++) {
        let line = '';
        for (let index in array[i]) {
            if (line !== '') line += ',';

            line += array[i][index];
        }
        result += line + '\r\n';
    }
    return result;
}

function batchDownload(tids) {
    $('.status').html("Building CSV......");
    Promise.all(tids.map(download)).then((content) => {
        toggleLoader();
        let csvContent = convertToCSV(content);
        let encodedUri = encodeURI(csvContent);
        let link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", Date.now() + ".csv");
        document.body.appendChild(link);
        link.click();
    })
}

function download(id) {
    let fullURL = SERVER_URL + 'jsonResult.php?test=' + id;
    let fields = ['loadTime'];
    return new Promise((resolve, reject) => {
        $.get(fullURL, (data, status) => {
            if (data.statusCode === 200) {
                let result = _.pick(data.data, ['url', 'summary']);
                result.location = LOCATIONS[_.split(data.data.location, ':')[0]];
                result.loadTime = _.get(data.data.runs[1].firstView, fields);
                resolve(result);
            } else {
                resolve();
            }
        })
    })
}

function fetch(url) {
    return new Promise((resolve, reject) => {
        $.get(url, (data, status) => {
            if (status === 'success') {
                let $data = $(data);
                let statusCode = $data.find('statusCode')[0].innerHTML;
                let testId = $data.find('testId')[0].innerHTML;
                debugger;
                if (statusCode === '200') {
                    resolve([testId, url])
                }
            }
        }, 'xml');
    });
}