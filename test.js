var numChunks = 10;
var chunkSize = 1024;

try {
  var u = new URL(window.location);
  var params = new URLSearchParams(u.search.substr(1));
  var override = ~~params.get('chunks');
  if (override > 0) {
    numChunks = override;
  }
} catch(e) {
  // if we can't get an numChunks override, just use default
}

runTest(numChunks);

function runTest(numChunks) {
  var suite = new Benchmark.Suite();

  display('Testing ' + numChunks + ' chunks per operation.');

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
  })
  .on('error', function (event) {
    display('Error has occured: "' + event.target.error.message + '" in ' +
            event.target.name);
  })
  .run();
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
