var auto = false;
var numChunks = 10;
var chunkSize = 1024;

try {
  var u = new URL(window.location);
  var params = new URLSearchParams(u.search.substr(1));
  var chunks = params.get('chunks');
  if (chunks === 'auto') {
    auto = true;
  } else if (~~chunks > 0) {
    numChunks = ~~chunks;
  }
  var size = ~~params.get('size');
  if (size > 0) {
    chunkSize = size;
  }
} catch(e) {
  // if we can't get an numChunks override, just use default
}

if (auto) {
  numChunks = 1;

  function nextTest() {
    if (numChunks >= 8192) {
      return;
    }
    numChunks *= 2;
    return runTest(numChunks).then(nextTest);
  }

  runTest(numChunks).then(nextTest);
} else {
  runTest(numChunks);
}

function runTest(numChunks) {
  return new Promise(function(resolve, reject) {
    var suite = new Benchmark.Suite();

    display('---------------');
    display('Testing ' + numChunks + ' chunks of ' + chunkSize + ' bytes per operation.');

    suite
    .add('sync', function (deferred) {
      executeSync(numChunks);
      deferred.resolve();
    }, { defer: true })
    .add('promise', function (deferred) {
      executePromise(numChunks).then(function () {
        deferred.resolve();
      });
    }, { defer: true })
    .on('cycle', function (event) {
      display(event.target.toString());
    })
    .on('complete', function (event) {
      display('Fastest is ' + this.filter('fastest').pluck('name'));
      resolve();
    })
    .on('error', function (event) {
      display('Error has occured: "' + event.target.error.message + '" in ' +
              event.target.name);
      reject(event.target);
    })
    .run();
  });
}

function display(value) {
  var resultList = document.getElementById('output');
  var result = document.createElement('div');
  result.textContent = value;
  resultList.appendChild(result);
}

function makePromiseReader(numChunks) {
  var data = new Array(numChunks);
  for (var i = 0; i < data.length; ++i) {
    data[i] = new ArrayBuffer(chunkSize);
  }
  var nextChunk = 0;

  return {
    read: function() {
      if (nextChunk >= data.length) {
        return Promise.resolve({ value: undefined, done: true });
      }
      return Promise.resolve({ value: data[nextChunk++], done: false });
    }
  };
}

function executePromise(numChunks) {
  var reader = makePromiseReader(numChunks);

  return reader.read().then(handleChunk);

  function handleChunk(result) {
    if (result.done) {
      return;
    }

    // Avoid loop being optimized away
    if (result.value[0] > 0) {
      throw new Error('this should never happen');
    }

    return reader.read().then(handleChunk);
  }
}

function makeSyncReader(numChunks) {
  var data = new Array(numChunks);
  for (var i = 0; i < data.length; ++i) {
    data[i] = new ArrayBuffer(chunkSize);
  }
  var nextChunk = 0;

  return {
    read: function() {
      if (nextChunk >= data.length) {
        return { value: undefined, done: true };
      }
      return { value: data[nextChunk++], done: false };
    }
  };
}

function executeSync(numChunks) {
  var reader = makeSyncReader(numChunks);
  var result;

  while (true) {
    result = reader.read();

    if (result.done) {
      return;
    }

    // Avoid loop being optimized away
    if (result.value[0] > 0) {
      throw new Error('this should never happen');
    }
  }
}

function execute(numChunks) {
  var syncTime = executeSync(numChunks);
  return executePromise(numChunks).then(function (dur) {
    return { numChunks: numChunks, sync: syncTime, promise: dur };
  });
}
